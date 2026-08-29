namespace ChatBotAdmin.Models;

public class DocumentChatBot
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Display name, e.g. "Employee Handbook"</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>User-supplied version label, e.g. "V1.0"</summary>
    public string Version { get; set; } = string.Empty;

    /// <summary>System instructions sent to the model along with the document</summary>
    public string Instructions { get; set; } = string.Empty;

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
}

public enum ProcessingStatus
{
    Pending,
    Processing,
    Ready,
    Error
}
