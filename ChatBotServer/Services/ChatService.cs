using ChatBotServer.Data;
using ChatBotServer.Models;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ChatBotServer.Services;

public record ChatAnswer(string Answer, List<string> Images);

public partial class ChatService(AppDbContext db, OllamaService ollama, VectorSearchService vectorSearch)
{
    // Matches [IMAGE: /uploads/images/...] that the LLM emits when it decides an image is relevant
    [GeneratedRegex(@"\[IMAGE:\s*([^\]]+)\]", RegexOptions.IgnoreCase)]
    private static partial Regex ImageMarkerRegex();

    public async Task<ChatAnswer> AnswerAsync(
        Guid   chatBotId,
        string question,
        int    topK = 4,
        CancellationToken ct = default)
    {
        var bot = await db.DocumentChatBots
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == chatBotId, ct);

        if (bot is null)
            return new ChatAnswer("ChatBot not found.", []);

        if (bot.Status != ProcessingStatus.Ready)
            return new ChatAnswer("This ChatBot is still being processed. Please try again shortly.", []);

        // Embed the question
        var queryEmbedding = await ollama.EmbedAsync(question, ct);

        // Retrieve top-k chunks by cosine similarity
        var hits = await vectorSearch.RetrieveAsync(chatBotId, queryEmbedding, topK, ct);

        if (hits.Count == 0)
            return new ChatAnswer("I couldn't find anything relevant to answer that question.", []);

        // Build the system prompt from both instruction fields
        var systemPrompt = BuildSystemPrompt(bot);

        // Build context with [IMAGE: url] markers embedded so the LLM can reference them
        var context = BuildContext(hits);

        var userMessage = $"CONTEXT:\n{context}\n\nQUESTION: {question}";
        var rawAnswer   = await ollama.ChatAsync(systemPrompt, userMessage, ct);

        // Extract image URLs the LLM chose to reference; strip the markers from the display text
        var (cleanAnswer, images) = ParseResponse(rawAnswer);

        return new ChatAnswer(cleanAnswer, images);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static string BuildSystemPrompt(DocumentChatBot bot)
    {
        var sb = new StringBuilder();

        // Document notes give the model domain context
        if (!string.IsNullOrWhiteSpace(bot.Instructions))
            sb.AppendLine($"Document Context:\n{bot.Instructions}\n");

        // Chat instructions govern behaviour
        if (!string.IsNullOrWhiteSpace(bot.ChatInstructions))
            sb.AppendLine($"Behavior Instructions:\n{bot.ChatInstructions}\n");

        sb.AppendLine("""
            Rules:
            - Answer ONLY using the CONTEXT provided below. Do not use outside knowledge.
            - If the context doesn't contain the answer, say you don't know — do not guess.
            - Keep answers concise and reference the relevant section heading when helpful.
            - The context may include [IMAGE: url] markers. Include any that are genuinely relevant to your answer verbatim in your response. Omit image markers when the question doesn't warrant a visual aid.
            """);

        return sb.ToString().TrimEnd();
    }

    private static string BuildContext(List<ScoredChunk> hits)
    {
        var parts = hits.Select(h =>
        {
            var sb = new StringBuilder(h.Chunk.Text);

            // Append image markers so the LLM can choose to reference them
            if (!string.IsNullOrEmpty(h.Chunk.ImagePaths))
            {
                var urls = JsonSerializer.Deserialize<List<string>>(h.Chunk.ImagePaths) ?? [];
                foreach (var url in urls)
                    sb.Append($"\n[IMAGE: {url}]");
            }

            return sb.ToString();
        });

        return string.Join("\n\n---\n\n", parts);
    }

    private static (string cleanAnswer, List<string> images) ParseResponse(string rawAnswer)
    {
        var regex  = ImageMarkerRegex();
        var images = regex.Matches(rawAnswer)
            .Select(m => m.Groups[1].Value.Trim())
            .Distinct()
            .ToList();

        // Remove the markers and collapse any resulting blank lines
        var clean = regex.Replace(rawAnswer, string.Empty);
        clean     = Regex.Replace(clean, @"\n{3,}", "\n\n").Trim();

        return (clean, images);
    }
}
