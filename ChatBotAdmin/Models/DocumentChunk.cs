namespace ChatBotAdmin.Models;

/// <summary>
/// A single chunk of text extracted from a DocumentChatBot's source document,
/// with its embedding vector stored as raw bytes (float[] → byte[]).
/// Cosine-similarity search over these embeddings is performed in C#,
/// mirroring what sqlite-vec does as an extension when operating at larger scale.
/// </summary>
public class DocumentChunk
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid DocumentChatBotId { get; set; }

    /// <summary>"{sourceFile}::{heading}::{index}" — mirrors Python chunk id format</summary>
    public string ChunkKey { get; set; } = string.Empty;

    public string Heading { get; set; } = string.Empty;

    public string Text { get; set; } = string.Empty;

    public int ChunkIndex { get; set; }

    /// <summary>Pipe-delimited image paths extracted alongside this chunk (future use)</summary>
    public string? ImagePaths { get; set; }

    /// <summary>nomic-embed-text embedding: float[768] serialised as little-endian bytes</summary>
    public byte[]? Embedding { get; set; }

    // Navigation
    public DocumentChatBot DocumentChatBot { get; set; } = null!;
}
