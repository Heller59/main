using ChatBotAdmin.Models;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace ChatBotAdmin.Services;

/// <summary>
/// Ports the Python chunk_docx.py strategy directly using OpenXml,
/// eliminating the pandoc/LibreOffice dependency.
///
/// Strategy (mirrors Python):
///   - Walk paragraphs in document order
///   - Headings (Heading1–3, Title styles) start a new section
///   - Each section's text is split into ~150-word chunks with 30-word overlap
///   - chunk id format: "{sourceFile}::{heading}::{index}"
/// </summary>
public class DocumentChunkerService
{
    private const int MaxWords     = 150;
    private const int OverlapWords = 30;

    private static readonly HashSet<string> HeadingStyles = new(StringComparer.OrdinalIgnoreCase)
    {
        "Heading1","Heading2","Heading3",
        "heading 1","heading 2","heading 3",
        "Title","Subtitle"
    };

    public List<DocumentChunk> Chunk(string filePath, string sourceFileName, Guid chatBotId)
    {
        using var doc = WordprocessingDocument.Open(filePath, isEditable: false);
        var body = doc.MainDocumentPart?.Document?.Body
                   ?? throw new InvalidOperationException("Word document has no body.");

        var sections = ExtractSections(body);
        var result   = new List<DocumentChunk>();

        foreach (var (heading, words) in sections)
            result.AddRange(ChunkSection(heading, words, sourceFileName, chatBotId));

        return result;
    }

    // ---------------------------------------------------------------
    // Section extraction
    // ---------------------------------------------------------------

    private static List<(string heading, List<string> words)> ExtractSections(Body body)
    {
        var sections       = new List<(string, List<string>)>();
        var currentHeading = "Introduction";
        var currentWords   = new List<string>();

        foreach (var para in body.Descendants<Paragraph>())
        {
            var styleId = para.ParagraphProperties?.ParagraphStyleId?.Val?.Value ?? string.Empty;
            var text    = para.InnerText.Trim();

            if (string.IsNullOrWhiteSpace(text))
                continue;

            if (IsHeading(styleId))
            {
                if (currentWords.Count > 0)
                    sections.Add((currentHeading, new List<string>(currentWords)));

                currentHeading = text;
                currentWords.Clear();
            }
            else
            {
                // Tokenise into words, filter empties
                currentWords.AddRange(
                    text.Split(' ', StringSplitOptions.RemoveEmptyEntries));
            }
        }

        if (currentWords.Count > 0)
            sections.Add((currentHeading, currentWords));

        return sections;
    }

    private static bool IsHeading(string styleId) =>
        HeadingStyles.Contains(styleId) ||
        styleId.StartsWith("Heading",  StringComparison.OrdinalIgnoreCase) ||
        styleId.StartsWith("heading ", StringComparison.OrdinalIgnoreCase);

    // ---------------------------------------------------------------
    // Chunking  (mirrors Python chunk_section)
    // ---------------------------------------------------------------

    private static List<DocumentChunk> ChunkSection(
        string heading, List<string> words,
        string sourceFileName, Guid chatBotId)
    {
        var chunks       = new List<DocumentChunk>();
        var currentWords = new List<string>();
        var chunkIndex   = 0;

        void Flush()
        {
            if (currentWords.Count == 0) return;

            // Mirrors Python: "{heading}: {words}"
            var text = $"{heading}: {string.Join(' ', currentWords)}";

            chunks.Add(new DocumentChunk
            {
                DocumentChatBotId = chatBotId,
                ChunkKey          = $"{sourceFileName}::{heading}::{chunkIndex}",
                Heading           = heading,
                Text              = text,
                ChunkIndex        = chunkIndex,
            });

            chunkIndex++;

            // Keep last OverlapWords for the next chunk
            currentWords = currentWords.Count > OverlapWords
                ? currentWords.Skip(currentWords.Count - OverlapWords).ToList()
                : [];
        }

        foreach (var word in words)
        {
            currentWords.Add(word);
            if (currentWords.Count >= MaxWords)
                Flush();
        }
        Flush();

        return chunks;
    }
}
