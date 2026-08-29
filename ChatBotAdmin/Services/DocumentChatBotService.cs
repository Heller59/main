using ChatBotAdmin.Data;
using ChatBotAdmin.Models;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.EntityFrameworkCore;

namespace ChatBotAdmin.Services;

public class DocumentChatBotService(
    AppDbContext             db,
    IWebHostEnvironment      env,
    DocumentChunkerService   chunker,
    OllamaService            ollama,
    ILogger<DocumentChatBotService> logger)
{
    private string UploadsRoot => Path.Combine(env.ContentRootPath, "Uploads");

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    public async Task<List<DocumentChatBot>> GetAllAsync() =>
        await db.DocumentChatBots
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

    public async Task<DocumentChatBot?> GetByIdAsync(Guid id) =>
        await db.DocumentChatBots
                .Include(x => x.Chunks)
                .FirstOrDefaultAsync(x => x.Id == id);

    public async Task DeleteAsync(Guid id)
    {
        var record = await db.DocumentChatBots.FindAsync(id);
        if (record is null) return;

        // Delete the uploaded file from disk
        var filePath = Path.Combine(UploadsRoot, record.StoredFilePath);
        if (File.Exists(filePath))
            File.Delete(filePath);

        // Cascade delete removes chunks via EF (OnDelete: Cascade configured in DbContext)
        db.DocumentChatBots.Remove(record);
        await db.SaveChangesAsync();
    }

    // ---------------------------------------------------------------
    // Create  (mirrors Python: chunk_docx → build_index pipeline)
    // ---------------------------------------------------------------

    public async Task<DocumentChatBot> CreateAsync(
        string name,
        string version,
        string instructions,
        Stream fileStream,
        string originalFileName,
        CancellationToken ct = default)
    {
        // 1. Persist the uploaded file
        Directory.CreateDirectory(UploadsRoot);
        var ext        = Path.GetExtension(originalFileName);
        var storedName = $"{Guid.NewGuid()}{ext}";
        var storedPath = Path.Combine(UploadsRoot, storedName);

        await using (var fs = File.Create(storedPath))
            await fileStream.CopyToAsync(fs, ct);

        // 2. Create the record (Processing)
        var record = new DocumentChatBot
        {
            Name             = name,
            Version          = version,
            Instructions     = instructions,
            DocumentFileName = originalFileName,
            StoredFilePath   = storedName,
            Status           = ProcessingStatus.Processing,
        };
        db.DocumentChatBots.Add(record);
        await db.SaveChangesAsync(ct);

        // 3. Run the pipeline in the background so the HTTP response returns quickly
        _ = Task.Run(() => RunPipelineAsync(record.Id, storedPath, originalFileName), CancellationToken.None);

        return record;
    }

    // ---------------------------------------------------------------
    // Pipeline  (chunk → embed → save)
    // ---------------------------------------------------------------

    private async Task RunPipelineAsync(Guid recordId, string filePath, string originalFileName)
    {
        // Background task needs its own DbContext — the original scoped one will be disposed
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(db.Database.GetConnectionString()!)
            .Options;
        await using var ctx = new AppDbContext(options);

        var record = await ctx.DocumentChatBots.FindAsync(recordId);
        if (record is null) return;

        try
        {
            // Step A: extract full text for preview display
            record.ExtractedText = ExtractFullText(filePath);

            // Step B: chunk (mirrors chunk_docx.py)
            logger.LogInformation("Chunking {File}", originalFileName);
            var chunks = chunker.Chunk(filePath, originalFileName, record.Id);
            logger.LogInformation("Created {N} chunks", chunks.Count);

            // Step C: embed each chunk (mirrors build_index.py)
            for (var i = 0; i < chunks.Count; i++)
            {
                logger.LogInformation("Embedding chunk {I}/{N}: {Key}", i + 1, chunks.Count, chunks[i].ChunkKey);
                var embedding = await ollama.EmbedAsync(chunks[i].Text);
                chunks[i].Embedding = OllamaService.SerializeEmbedding(embedding);
            }

            // Step D: save chunks and update status
            ctx.DocumentChunks.AddRange(chunks);
            record.ChunkCount = chunks.Count;
            record.Status     = ProcessingStatus.Ready;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Pipeline failed for {Id}", recordId);
            record.Status       = ProcessingStatus.Error;
            record.ErrorMessage = ex.Message;
        }

        await ctx.SaveChangesAsync();
    }

    // ---------------------------------------------------------------
    // RAG helper — retrieve context for a question
    // ---------------------------------------------------------------

    public async Task<string> AnswerAsync(
        Guid   chatBotId,
        string question,
        VectorSearchService vectorSearch,
        int    topK = 4,
        CancellationToken ct = default)
    {
        var bot = await GetByIdAsync(chatBotId)
                  ?? throw new InvalidOperationException("ChatBot not found.");

        // Embed the question
        var queryEmbedding = await ollama.EmbedAsync(question, ct);

        // Retrieve top-k chunks (cosine similarity)
        var hits = await vectorSearch.RetrieveAsync(chatBotId, queryEmbedding, topK, ct);

        if (hits.Count == 0)
            return "I couldn't find anything in the document to answer that question.";

        var context = string.Join("\n\n---\n\n", hits.Select(h => h.Chunk.Text));

        // Build the system prompt — mirrors Python SYSTEM_PROMPT + instructions
        var systemPrompt = $"""
            {bot.Instructions}

            Rules:
            - Answer ONLY using the CONTEXT provided below. Do not use outside knowledge.
            - If the context doesn't contain the answer, say you don't know — do not guess.
            - Keep answers concise and reference the relevant section heading when helpful.
            """;

        var userMessage = $"CONTEXT:\n{context}\n\nQUESTION: {question}";

        return await ollama.ChatAsync(systemPrompt, userMessage, ct);
    }

    // ---------------------------------------------------------------
    // Text extraction (for preview only)
    // ---------------------------------------------------------------

    private static string ExtractFullText(string filePath)
    {
        using var doc  = WordprocessingDocument.Open(filePath, isEditable: false);
        var body = doc.MainDocumentPart?.Document?.Body
                   ?? throw new InvalidOperationException("Word document has no body.");

        return string.Join(
            Environment.NewLine,
            body.Descendants<Paragraph>()
                .Select(p => p.InnerText.Trim())
                .Where(t => t.Length > 0));
    }
}
