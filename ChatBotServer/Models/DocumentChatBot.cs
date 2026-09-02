namespace ChatBotServer.Models;

public class DocumentChatBot
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Instructions { get; set; } = string.Empty;
    public string ChatInstructions { get; set; } = string.Empty;
    public string Greeting { get; set; } = string.Empty;
    public string DocumentFileName { get; set; } = string.Empty;
    public string StoredFilePath { get; set; } = string.Empty;
    public string ExtractedText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public ProcessingStatus Status { get; set; }
    public string? ErrorMessage { get; set; }
    public string? IconPath { get; set; }
    public int ChunkCount { get; set; }
    public List<DocumentChunk> Chunks { get; set; } = [];
}

public enum ProcessingStatus { Pending, Processing, Ready, Error }
