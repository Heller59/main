using ChatBotAdmin.Data;
using ChatBotAdmin.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatBotAdmin.Services;

public sealed class RateLimitAdminService(IDbContextFactory<AppDbContext> factory)
{
    // ── Config ─────────────────────────────────────────────────────────────

    /// <summary>Returns the global config row, creating it with defaults if it doesn't exist.</summary>
    public async Task<RateLimitConfig> GetGlobalConfigAsync()
    {
        await using var db = await factory.CreateDbContextAsync();
        var cfg = await db.RateLimitConfigs
            .FirstOrDefaultAsync(c => c.BotId == null);

        if (cfg is null)
        {
            cfg = new RateLimitConfig { BotId = null };
            db.RateLimitConfigs.Add(cfg);
            await db.SaveChangesAsync();
        }
        return cfg;
    }

    /// <summary>Returns all per-bot overrides.</summary>
    public async Task<List<RateLimitConfig>> GetBotOverridesAsync()
    {
        await using var db = await factory.CreateDbContextAsync();
        return await db.RateLimitConfigs
            .Where(c => c.BotId != null)
            .OrderBy(c => c.BotId)
            .AsNoTracking()
            .ToListAsync();
    }

    /// <summary>Saves the global config (upsert).</summary>
    public async Task SaveGlobalConfigAsync(RateLimitConfig model)
    {
        await using var db = await factory.CreateDbContextAsync();
        var existing = await db.RateLimitConfigs.FirstOrDefaultAsync(c => c.BotId == null);

        if (existing is null)
        {
            model.Id        = 0;
            model.BotId     = null;
            model.UpdatedAt = DateTime.UtcNow;
            db.RateLimitConfigs.Add(model);
        }
        else
        {
            existing.RequestsPerMinute   = model.RequestsPerMinute;
            existing.RequestsPerHour     = model.RequestsPerHour;
            existing.RequestsPerDay      = model.RequestsPerDay;
            existing.IsEnabled           = model.IsEnabled;
            existing.ServiceEnabled      = model.ServiceEnabled;
            existing.UnavailableMessage  = model.UnavailableMessage;
            existing.UpdatedAt           = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();
    }

    /// <summary>Upserts a per-bot override.</summary>
    public async Task SaveBotOverrideAsync(RateLimitConfig model)
    {
        if (model.BotId is null) throw new ArgumentException("BotId required for override");

        await using var db = await factory.CreateDbContextAsync();
        var existing = await db.RateLimitConfigs.FirstOrDefaultAsync(c => c.BotId == model.BotId);

        if (existing is null)
        {
            model.Id        = 0;
            model.UpdatedAt = DateTime.UtcNow;
            db.RateLimitConfigs.Add(model);
        }
        else
        {
            existing.RequestsPerMinute = model.RequestsPerMinute;
            existing.RequestsPerHour   = model.RequestsPerHour;
            existing.RequestsPerDay    = model.RequestsPerDay;
            existing.IsEnabled         = model.IsEnabled;
            existing.UpdatedAt         = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();
    }

    /// <summary>Removes a per-bot override (falls back to global defaults).</summary>
    public async Task DeleteBotOverrideAsync(Guid botId)
    {
        await using var db = await factory.CreateDbContextAsync();
        await db.RateLimitConfigs
            .Where(c => c.BotId == botId)
            .ExecuteDeleteAsync();
    }

    // ── Stats ──────────────────────────────────────────────────────────────

    public record HourBucket(DateTime HourUtc, int Total, int Throttled);
    public record BotStat(Guid BotId, string BotName, int TodayTotal, int TodayThrottled);

    /// <summary>Returns per-hour request counts for the last 24 hours.</summary>
    public async Task<List<HourBucket>> GetHourlyStatsAsync()
    {
        var cutoff = DateTime.UtcNow.AddHours(-24);
        await using var db = await factory.CreateDbContextAsync();

        var logs = await db.RequestLogs
            .AsNoTracking()
            .Where(l => l.TimestampUtc >= cutoff)
            .ToListAsync();

        return logs
            .GroupBy(l => new DateTime(
                l.TimestampUtc.Year, l.TimestampUtc.Month, l.TimestampUtc.Day,
                l.TimestampUtc.Hour, 0, 0, DateTimeKind.Utc))
            .Select(g => new HourBucket(g.Key, g.Count(), g.Count(l => l.WasThrottled)))
            .OrderBy(b => b.HourUtc)
            .ToList();
    }

    /// <summary>Returns today's totals grouped by bot, joined with bot names.</summary>
    public async Task<List<BotStat>> GetTodayBotStatsAsync()
    {
        var todayUtc = DateTime.UtcNow.Date;
        await using var db = await factory.CreateDbContextAsync();

        var bots = await db.DocumentChatBots
            .AsNoTracking()
            .Select(b => new { b.Id, b.Name })
            .ToListAsync();

        var logs = await db.RequestLogs
            .AsNoTracking()
            .Where(l => l.TimestampUtc >= todayUtc && l.BotId != null)
            .ToListAsync();

        var byBot = logs.GroupBy(l => l.BotId!.Value).ToDictionary(
            g => g.Key,
            g => (Total: g.Count(), Throttled: g.Count(l => l.WasThrottled)));

        return bots
            .Where(b => byBot.ContainsKey(b.Id))
            .Select(b =>
            {
                var (total, throttled) = byBot[b.Id];
                return new BotStat(b.Id, b.Name, total, throttled);
            })
            .OrderByDescending(s => s.TodayTotal)
            .ToList();
    }

    /// <summary>High-level summary numbers for the stat cards.</summary>
    public record DaySummary(int TodayTotal, int TodayThrottled, int UniqueIpsToday, long AllTimeTotal);

    public async Task<DaySummary> GetDaySummaryAsync()
    {
        var todayUtc = DateTime.UtcNow.Date;
        await using var db = await factory.CreateDbContextAsync();

        var today = await db.RequestLogs
            .AsNoTracking()
            .Where(l => l.TimestampUtc >= todayUtc)
            .ToListAsync();

        var allTime = await db.RequestLogs.LongCountAsync();

        return new DaySummary(
            TodayTotal:      today.Count,
            TodayThrottled:  today.Count(l => l.WasThrottled),
            UniqueIpsToday:  today.Select(l => l.ClientIp).Distinct().Count(),
            AllTimeTotal:    allTime);
    }
}
