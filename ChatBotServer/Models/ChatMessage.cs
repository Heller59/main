namespace ChatBotServer.Models;

public class ChatMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChatSessionId { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public string? Images { get; set; }
    public DateTime AskedAt { get; set; } = DateTime.UtcNow;
    public int DurationMs { get; set; }

    public ChatSession? ChatSession { get; set; }
}
