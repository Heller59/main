using ChatBotServer.Services;

namespace ChatBotServer.Middleware;

/// <summary>
/// Intercepts every POST /api/chat/{botId} request.
///
/// Kill switch:  When the global config has ServiceEnabled = false, all requests
///               receive HTTP 503 with a JSON body containing the configured
///               UnavailableMessage (or a default).
///
/// Rate limiting: Per-IP per-bot sliding windows (minute / hour / day).
///               Throttled requests receive HTTP 429 with a Retry-After header.
///
/// Logging:      Every request (allowed or blocked) is enqueued for async
///               persistence by <see cref="RateLimitService"/>.
/// </summary>
public class RateLimitMiddleware(RequestDelegate next, ILogger<RateLimitMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext ctx, RateLimitService rateLimitSvc)
    {
        // Only guard chat API calls
        if (!ctx.Request.Path.StartsWithSegments("/api/chat", StringComparison.OrdinalIgnoreCase))
        {
            await next(ctx);
            return;
        }

        // Extract bot ID from path segment  /api/chat/{guid}
        var segments = ctx.Request.Path.Value?.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments is null || segments.Length < 3 || !Guid.TryParse(segments[2], out var botId))
        {
            await next(ctx);
            return;
        }

        // Respect X-Forwarded-For for reverse-proxy deployments
        var clientIp = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault()
            ?? ctx.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
        // Take only the first IP in a forwarded chain
        clientIp = clientIp.Split(',')[0].Trim();

        // ── Kill switch ────────────────────────────────────────────────────
        var (killActive, message) = await rateLimitSvc.GetServiceStatusAsync();
        if (killActive)
        {
            logger.LogInformation("Kill switch active — rejecting request from {Ip} for bot {BotId}", clientIp, botId);
            ctx.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(new
            {
                error     = message,
                retryable = true
            });
            return;
        }

        // ── Rate limit check ───────────────────────────────────────────────
        var allowed = await rateLimitSvc.IsAllowedAsync(botId, clientIp);
        if (!allowed)
        {
            logger.LogWarning("Rate limit exceeded for IP {Ip} on bot {BotId}", clientIp, botId);
            ctx.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            ctx.Response.Headers.RetryAfter = "60";
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(new
            {
                error     = "Too many requests. Please wait a moment before trying again.",
                retryable = true
            });
            return;
        }

        await next(ctx);
    }
}
