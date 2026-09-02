namespace ChatBotAdmin.Models;

public class DocumentChatBot
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Display name, e.g. "Employee Handbook"</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>User-supplied version label, e.g. "V1.0"</summary>
    public string Version { get; set; } = string.Empty;

    /// <summary>Document context / domain notes — helps the model understand what this document is</summary>
    public string Instructions { get; set; } = string.Empty;

    /// <summary>Chat behavior instructions — sent as the system prompt with every user question</summary>
    public string ChatInstructions { get; set; } = string.Empty;

    /// <summary>Opening message shown to the user when the widget loads (optional).</summary>
    public string Greeting { get; set; } = string.Empty;

    /// <summary>Original filename of the uploaded Word document</summary>
    public string DocumentFileName { get; set; } = string.Empty;

    /// <summary>Path to the stored file on disk (relative to the uploads root)</summary>
    public string StoredFilePath { get; set; } = string.Empty;

    /// <summary>Raw text extracted from the Word document</summary>
    public string ExtractedText { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ProcessingStatus Status { get; set; } = ProcessingStatus.Pending;

    /// <summary>Human-readable error message if processing failed</summary>
    public string? ErrorMessage { get; set; }

    /// <summary>URL path to the uploaded icon image, e.g. "/uploads/images/{id}/icon.png"</summary>
    public string? IconPath { get; set; }

    /// <summary>Total number of chunks indexed (set after processing)</summary>
    public int ChunkCount { get; set; }

    // Navigation
    public List<DocumentChunk> Chunks   { get; set; } = [];
    public List<ChatSession>   Sessions { get; set; } = [];
}

public enum ProcessingStatus
{
    Pending,
    Processing,
    Ready,
    Error
}
