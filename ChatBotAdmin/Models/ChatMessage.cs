namespace ChatBotAdmin.Models;

/// <summary>
/// A single question/answer exchange within a <see cref="ChatSession"/>.
/// </summary>
public class ChatMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ChatSessionId { get; set; }

    public string Question { get; set; } = string.Empty;

    public string Answer { get; set; } = string.Empty;

    /// <summary>JSON array of image URLs the LLM chose to include, e.g. ["/uploads/images/…"].</summary>
    public string? Images { get; set; }

    public DateTime AskedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Wall-clock time in milliseconds from question received to answer returned.</summary>
    public int DurationMs { get; set; }

    // Navigation
    public ChatSession? ChatSession { get; set; }
}
