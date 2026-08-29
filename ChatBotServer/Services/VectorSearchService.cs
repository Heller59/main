using ChatBotServer.Data;
using ChatBotServer.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatBotServer.Services;

public class VectorSearchService(AppDbContext db)
{
    public async Task<List<ScoredChunk>> RetrieveAsync(
        Guid    chatBotId,
        float[] queryEmbedding,
        int     topK = 4,
        CancellationToken ct = default)
    {
        var chunks = await db.DocumentChunks
            .AsNoTracking()
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
