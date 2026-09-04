namespace ChatBotServer.Models;

/// <summary>
/// One row per incoming chat request (throttled or allowed).
/// Retained for 7 days, then purged by RateLimitService.
/// </summary>
public class RequestLog
{
    public long      Id            { get; set; }
    public Guid?     BotId         { get; set; }
    public DateTime  TimestampUtc  { get; set; } = DateTime.UtcNow;
    public bool      WasThrottled  { get; set; }
    public string?   ClientIp      { get; set; }
}
