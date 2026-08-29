using ChatBotAdmin.Data;
using ChatBotAdmin.Models;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.EntityFrameworkCore;

namespace ChatBotAdmin.Services;

public class DocumentChatBotService(AppDbContext db, IWebHostEnvironment env, ILogger<DocumentChatBotService> logger)
{
    private string UploadsRoot => Path.Combine(env.ContentRootPath, "Uploads");

    public async Task<List<DocumentChatBot>> GetAllAsync() =>
        await db.DocumentChatBots
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

    public async Task<DocumentChatBot?> GetByIdAsync(Guid id) =>
        await db.DocumentChatBots.FindAsync(id);

    public async Task<DocumentChatBot> CreateAsync(
        string name,
        string version,
        string instructions,
        Stream fileStream,
        string originalFileName)
    {
        Directory.CreateDirectory(UploadsRoot);

        var ext = Path.GetExtension(originalFileName);
        var storedName = $"{Guid.NewGuid()}{ext}";
        var storedPath = Path.Combine(UploadsRoot, storedName);

        // Persist the uploaded file
        await using (var fs = File.Create(storedPath))
            await fileStream.CopyToAsync(fs);

        var record = new DocumentChatBot
        {
            Name         = name,
            Version      = version,
            Instructions = instructions,
            DocumentFileName = originalFileName,
            StoredFilePath   = storedName,
            Status       = ProcessingStatus.Processing
        };

        db.DocumentChatBots.Add(record);
        await db.SaveChangesAsync();

        // Extract text from the Word document
        try
        {
            record.ExtractedText = ExtractTextFromDocx(storedPath);
            record.Status        = ProcessingStatus.Ready;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to extract text from {File}", originalFileName);
            record.Status       = ProcessingStatus.Error;
            record.ErrorMessage = ex.Message;
        }

        await db.SaveChangesAsync();
        return record;
    }

    // ---------------------------------------------------------------
    // Document processing
    // ---------------------------------------------------------------

    private static string ExtractTextFromDocx(string filePath)
    {
        using var doc = WordprocessingDocument.Open(filePath, isEditable: false);
        var body = doc.MainDocumentPart?.Document?.Body
                   ?? throw new InvalidOperationException("Word document has no body.");

        var paragraphs = body.Descendants<Paragraph>()
                             .Select(p => p.InnerText.Trim())
                             .Where(t => t.Length > 0);

        return string.Join(Environment.NewLine, paragraphs);
    }
}
