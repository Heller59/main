namespace ChatBotServer.Models;

public class DocumentChunk
{
    public Guid Id { get; set; }
    public Guid DocumentChatBotId { get; set; }
    public string ChunkKey { get; set; } = string.Empty;
    public string Heading { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public int ChunkIndex { get; set; }
    public string? ImagePaths { get; set; }
    public byte[]? Embedding { get; set; }
    public DocumentChatBot DocumentChatBot { get; set; } = null!;
}
