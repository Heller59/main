using ChatBotAdmin.Data;
using ChatBotAdmin.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatBotAdmin.Services;

/// <summary>
/// Cosine-similarity vector search over embeddings stored in SQLite BLOBs.
///
/// This is architecturally equivalent to sqlite-vec: the vectors live in the
/// same SQLite file as the rest of the data. For the typical document chatbot
/// scale (hundreds to a few thousand chunks) loading all embeddings for one
/// chatbot and scoring them in C# is instantaneous. When you need to scale to
/// tens of thousands of chunks, swap the Retrieve() body for a sqlite-vec
/// virtual-table query — the rest of the code is unchanged.
/// </summary>
public class VectorSearchService(AppDbContext db)
{
    /// <summary>
    /// Find the top-k chunks for <paramref name="chatBotId"/> most similar to
    /// <paramref name="queryEmbedding"/> — mirrors Python retrieve() in chatbot.py.
    /// </summary>
    public async Task<List<ScoredChunk>> RetrieveAsync(
        Guid    chatBotId,
        float[] queryEmbedding,
        int     topK = 4,
        CancellationToken ct = default)
    {
        // Load all embedded chunks for this chatbot (Embedding is never null for Ready records)
        var chunks = await db.DocumentChunks
            .Where(c => c.DocumentChatBotId == chatBotId && c.Embedding != null)
            .ToListAsync(ct);

        return chunks
            .Select(c => new ScoredChunk(
                c,
                CosineSimilarity(queryEmbedding, OllamaService.DeserializeEmbedding(c.Embedding!))))
            .OrderByDescending(x => x.Score)
            .Take(topK)
            .ToList();
    }

    // ---------------------------------------------------------------
    // Maths
    // ---------------------------------------------------------------

    private static float CosineSimilarity(float[] a, float[] b)
    {
        if (a.Length != b.Length) return 0f;

        float dot = 0f, normA = 0f, normB = 0f;
        for (var i = 0; i < a.Length; i++)
        {
            dot   += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        var denom = MathF.Sqrt(normA) * MathF.Sqrt(normB);
        return denom == 0f ? 0f : dot / denom;
    }
}

public sealed record ScoredChunk(DocumentChunk Chunk, float Score);
