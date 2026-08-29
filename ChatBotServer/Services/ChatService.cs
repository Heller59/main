using ChatBotServer.Data;
using ChatBotServer.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace ChatBotServer.Services;

public record ChatAnswer(string Answer, List<string> Images);

public class ChatService(AppDbContext db, OllamaService ollama, VectorSearchService vectorSearch)
{
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

        // Collect images from retrieved chunks
        var images = hits
            .Where(h => !string.IsNullOrEmpty(h.Chunk.ImagePaths))
            .SelectMany(h => JsonSerializer.Deserialize<List<string>>(h.Chunk.ImagePaths!) ?? [])
            .Distinct()
            .ToList();

        var context = string.Join("\n\n---\n\n", hits.Select(h => h.Chunk.Text));

        var systemPrompt = string.IsNullOrWhiteSpace(bot.Instructions)
            ? "Answer questions based only on the provided context."
            : $"""
               {bot.Instructions}

               Rules:
               - Answer ONLY using the CONTEXT provided below. Do not use outside knowledge.
               - If the context doesn't contain the answer, say you don't know — do not guess.
               - Keep answers concise and reference the relevant section heading when helpful.
               """;

        var userMessage = $"CONTEXT:\n{context}\n\nQUESTION: {question}";
        var answer = await ollama.ChatAsync(systemPrompt, userMessage, ct);

        return new ChatAnswer(answer, images);
    }
}
