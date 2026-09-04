using System.Collections.Concurrent;
using System.Threading.Channels;
using ChatBotServer.Data;
using ChatBotServer.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatBotServer.Services;

/// <summary>
/// Singleton sliding-window rate limiter.
///
/// Strategy: per-IP per-bot window (minute / hour / day).
/// Config is loaded from the database and cached for 60 seconds so IT can
/// update limits in ChatBotAdmin without restarting the server.
/// Request events are flushed to the database in background batches every
/// 5 seconds. Logs older than 7 days are pruned once per hour.
/// </summary>
public sealed class RateLimitService : IDisposable
{
    // ── Sliding windows ────────────────────────────────────────────────────
    // Key = "{botId}:{clientIp}"  Value = ordered queue of UTC millisecond timestamps
    private readonly ConcurrentDictionary<string, Queue<long>> _windows = new();

    // ── Config cache ───────────────────────────────────────────────────────
    private RateLimitConfig _global = new(); // safe defaults
    private Dictionary<Guid, RateLimitConfig> _botOverrides = [];
    private DateTime _configLoadedAt = DateTime.MinValue;
    private readonly SemaphoreSlim _configLock = new(1, 1);
    private static readonly TimeSpan ConfigTtl = TimeSpan.FromSeconds(60);

    // ── Log queue ──────────────────────────────────────────────────────────
    private readonly Channel<RequestLog> _logQueue =
        Channel.CreateBounded<RequestLog>(new BoundedChannelOptions(50_000)
        {
            FullMode = BoundedChannelFullMode.DropOldest
        });

    private readonly IDbContextFactory<AppDbContext> _factory;
    private readonly ILogger<RateLimitService> _logger;
    private readonly CancellationTokenSource _cts = new();
    private readonly Task _drainTask;
    private DateTime _lastPurge = DateTime.MinValue;

    public RateLimitService(
        IDbContextFactory<AppDbContext> factory,
        ILogger<RateLimitService> logger)
    {
        _factory   = factory;
        _logger    = logger;
        _drainTask = Task.Run(() => DrainLoopAsync(_cts.Token));
    }

    // ── Public API ─────────────────────────────────────────────────────────

    private static readonly string DefaultUnavailableMessage =
        "The chat service is temporarily unavailable. Please try again later.";

    /// <summary>
    /// Returns (killActive: true, message) when the service kill switch is on.
    /// Call this before <see cref="IsAllowedAsync"/>.
    /// </summary>
    public async ValueTask<(bool KillActive, string Message)> GetServiceStatusAsync()
    {
        await EnsureConfigFreshAsync();
        if (!_global.ServiceEnabled)
            return (true, _global.UnavailableMessage ?? DefaultUnavailableMessage);
        return (false, string.Empty);
    }

    /// <summary>
    /// Returns true when the request is within configured limits.
    /// Adds the timestamp to the window if allowed.
    /// Always enqueues a <see cref="RequestLog"/> for background persistence.
    /// </summary>
    public async ValueTask<bool> IsAllowedAsync(Guid botId, string clientIp)
    {
        await EnsureConfigFreshAsync();

        var cfg = _botOverrides.TryGetValue(botId, out var over) ? over : _global;

        if (!cfg.IsEnabled)
        {
            EnqueueLog(botId, clientIp, throttled: false);
            return true;
        }

        var key = $"{botId}:{clientIp}";
        var allowed = CheckAndRecord(key, cfg.RequestsPerMinute, cfg.RequestsPerHour, cfg.RequestsPerDay);
        EnqueueLog(botId, clientIp, throttled: !allowed);
        return allowed;
    }

    // ── Sliding-window check ───────────────────────────────────────────────

    private bool CheckAndRecord(string key, int rpm, int rph, int rpd)
    {
        var q = _windows.GetOrAdd(key, _ => new Queue<long>());
        lock (q)
        {
            var nowMs   = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var cutDay  = nowMs - 86_400_000L;
            var cutHour = nowMs - 3_600_000L;
            var cutMin  = nowMs - 60_000L;

            // Prune entries older than 24 h (the longest window we track)
            while (q.Count > 0 && q.Peek() < cutDay)
                q.Dequeue();

            // Count within each window (queue is in insertion order = ascending)
            int dayCount = 0, hourCount = 0, minCount = 0;
            foreach (var t in q)
            {
                dayCount++;
                if (t >= cutHour) hourCount++;
                if (t >= cutMin)  minCount++;
            }

            if (dayCount >= rpd || hourCount >= rph || minCount >= rpm)
                return false;

            q.Enqueue(nowMs);
            return true;
        }
    }

    // ── Config refresh ─────────────────────────────────────────────────────

    private async ValueTask EnsureConfigFreshAsync()
    {
        if (DateTime.UtcNow - _configLoadedAt < ConfigTtl)
            return;

        await _configLock.WaitAsync();
        try
        {
            if (DateTime.UtcNow - _configLoadedAt < ConfigTtl)
                return; // double-checked

            await RefreshConfigAsync();
            _configLoadedAt = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh rate-limit config from database");
        }
        finally
        {
            _configLock.Release();
        }
    }

    private async Task RefreshConfigAsync()
    {
        await using var db = await _factory.CreateDbContextAsync();
        var all = await db.RateLimitConfigs.AsNoTracking().ToListAsync();

        var global = all.FirstOrDefault(c => c.BotId is null);
        _global = global ?? new RateLimitConfig(); // fall back to in-code defaults

        _botOverrides = all
            .Where(c => c.BotId is not null)
            .ToDictionary(c => c.BotId!.Value);
    }

    // ── Log queue / drain ──────────────────────────────────────────────────

    private void EnqueueLog(Guid botId, string clientIp, bool throttled) =>
        _logQueue.Writer.TryWrite(new RequestLog
        {
            BotId        = botId,
            TimestampUtc = DateTime.UtcNow,
            WasThrottled = throttled,
            ClientIp     = clientIp
        });

    private async Task DrainLoopAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        var batch = new List<RequestLog>(500);

        while (await timer.WaitForNextTickAsync(ct).ConfigureAwait(false))
        {
            batch.Clear();
            while (batch.Count < 500 && _logQueue.Reader.TryRead(out var entry))
                batch.Add(entry);

            if (batch.Count > 0)
            {
                try
                {
                    await using var db = await _factory.CreateDbContextAsync(ct);
                    db.RequestLogs.AddRange(batch);
                    await db.SaveChangesAsync(ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to persist {Count} request log entries", batch.Count);
                }
            }

            // Purge logs older than 7 days — runs roughly once per hour
            if (DateTime.UtcNow - _lastPurge > TimeSpan.FromHours(1))
            {
                await PurgeOldLogsAsync(ct);
                _lastPurge = DateTime.UtcNow;
            }
        }
    }

    private async Task PurgeOldLogsAsync(CancellationToken ct)
    {
        try
        {
            var cutoff = DateTime.UtcNow.AddDays(-7);
            await using var db = await _factory.CreateDbContextAsync(ct);
            await db.RequestLogs
                .Where(l => l.TimestampUtc < cutoff)
                .ExecuteDeleteAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to purge old request logs");
        }
    }

    public void Dispose()
    {
        _cts.Cancel();
        _drainTask.GetAwaiter().GetResult();
        _configLock.Dispose();
        _cts.Dispose();
    }
}
