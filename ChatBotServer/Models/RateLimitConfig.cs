namespace ChatBotServer.Models;

/// <summary>
/// Rate-limit policy stored in the shared database.
/// BotId == null means the global default; a non-null BotId is a per-bot override.
/// </summary>
public class RateLimitConfig
{
    public int   Id                 { get; set; }
    public Guid? BotId              { get; set; }       // null = global
    public int   RequestsPerMinute  { get; set; } = 20;
    public int   RequestsPerHour    { get; set; } = 200;
    public int   RequestsPerDay     { get; set; } = 2_000;
    public bool  IsEnabled          { get; set; } = true;  // rate-limit checking active
    public bool  ServiceEnabled     { get; set; } = true;  // kill switch — false blocks all chat
    public string? UnavailableMessage { get; set; }         // shown to users when service is off
    public DateTime UpdatedAt       { get; set; } = DateTime.UtcNow;
}
