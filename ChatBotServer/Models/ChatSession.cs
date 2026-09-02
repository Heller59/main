namespace ChatBotServer.Models;

public class ChatSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentChatBotId { get; set; }
    public string SessionToken { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
    public int MessageCount { get; set; }
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }
    public string? UserName  { get; set; }
    public string? UserEmail { get; set; }

    public List<ChatMessage> Messages { get; set; } = [];
}
