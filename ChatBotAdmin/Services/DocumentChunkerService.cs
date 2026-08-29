using System.Text.Json;
using ChatBotAdmin.Models;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using A = DocumentFormat.OpenXml.Drawing;

namespace ChatBotAdmin.Services;

/// <summary>
/// Ports the Python chunk_docx.py strategy directly using OpenXml,
/// eliminating the pandoc/LibreOffice dependency.
///
/// Strategy (mirrors Python):
///   - Walk paragraphs in document order
///   - Headings (Heading1–3, Title styles) start a new section
///   - Each section's text is split into ~150-word chunks with 30-word overlap
///   - Images are extracted per-paragraph and associated with the chunk(s)
///     whose words come from the same paragraph
///   - chunk key format: "{sourceFile}::{heading}::{index}"
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

    // Only content types that browsers can render as <img>
    private static readonly Dictionary<string, string> WebImageExtensions =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["image/png"]     = ".png",
            ["image/jpeg"]    = ".jpg",
            ["image/gif"]     = ".gif",
            ["image/webp"]    = ".webp",
            ["image/svg+xml"] = ".svg",
        };

    // Tracks which paragraph each word came from so images can be
    // attached to the exact chunk that contains their paragraph.
    private record struct WordEntry(string Word, int ParaIndex);

    /// <param name="filePath">Absolute path to the .docx file.</param>
    /// <param name="sourceFileName">Original file name (used in ChunkKey).</param>
    /// <param name="chatBotId">Parent record ID.</param>
    /// <param name="imageDirectory">
    ///   If provided, images are extracted from the document and saved here.
    /// </param>
    /// <param name="imageUrlBase">
    ///   Base URL prepended to saved image filenames (e.g. "/uploads/images/{id}").
    /// </param>
    public List<DocumentChunk> Chunk(
        string filePath,
        string sourceFileName,
        Guid   chatBotId,
        string? imageDirectory = null,
        string? imageUrlBase   = null)
    {
        using var doc    = WordprocessingDocument.Open(filePath, isEditable: false);
        var mainPart = doc.MainDocumentPart
                       ?? throw new InvalidOperationException("Word document has no main part.");
        var body = mainPart.Document?.Body
                   ?? throw new InvalidOperationException("Word document has no body.");

        // relId → already-saved URL; deduplicates images referenced more than once
        var relIdToUrl = new Dictionary<string, string>();

        var (sections, paraImages) = ExtractSections(
            body, mainPart, imageDirectory, imageUrlBase, relIdToUrl);

        var result = new List<DocumentChunk>();
        foreach (var (heading, entries) in sections)
            result.AddRange(ChunkSection(heading, entries, sourceFileName, chatBotId, paraImages));

        return result;
    }

    // ---------------------------------------------------------------
    // Section extraction (with image tracking per paragraph)
    // ---------------------------------------------------------------

    private static (List<(string heading, List<WordEntry> entries)> sections,
                    Dictionary<int, List<string>> paraImages)
        ExtractSections(
            Body body,
            MainDocumentPart mainPart,
            string? imageDirectory,
            string? imageUrlBase,
            Dictionary<string, string> relIdToUrl)
    {
        var sections       = new List<(string, List<WordEntry>)>();
        var currentHeading = "Introduction";
        var currentEntries = new List<WordEntry>();
        var paraImages     = new Dictionary<int, List<string>>();  // paraIdx → image URLs
        var paraIdx        = 0;
        // Images from image-only paragraphs (no text) are deferred here and
        // flushed onto the next paragraph that has text, so they always
        // end up associated with a chunk.
        var pendingImages  = new List<string>();

        foreach (var para in body.Descendants<Paragraph>())
        {
            var styleId = para.ParagraphProperties?.ParagraphStyleId?.Val?.Value ?? string.Empty;
            var text    = para.InnerText.Trim();

            // Extract any inline images from this paragraph
            if (imageDirectory is not null && imageUrlBase is not null)
            {
                var images = ExtractParagraphImages(
                    para, mainPart, imageDirectory, imageUrlBase, relIdToUrl);
                pendingImages.AddRange(images);
            }

            if (string.IsNullOrWhiteSpace(text))
            {
                // Image-only or blank paragraph — keep pendingImages for the next text paragraph
                paraIdx++;
                continue;
            }

            // Flush any pending images onto this text-bearing paragraph
            if (pendingImages.Count > 0)
            {
                paraImages[paraIdx] = new List<string>(pendingImages);
                pendingImages.Clear();
            }

            if (IsHeading(styleId))
            {
                if (currentEntries.Count > 0)
                    sections.Add((currentHeading, new List<WordEntry>(currentEntries)));

                currentHeading = text;
                currentEntries.Clear();
            }
            else
            {
                foreach (var word in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                    currentEntries.Add(new WordEntry(word, paraIdx));
            }

            paraIdx++;
        }

        if (currentEntries.Count > 0)
            sections.Add((currentHeading, currentEntries));

        return (sections, paraImages);
    }

    private static List<string> ExtractParagraphImages(
        Paragraph para,
        MainDocumentPart mainPart,
        string imageDirectory,
        string imageUrlBase,
        Dictionary<string, string> relIdToUrl)
    {
        var urls = new List<string>();

        foreach (var drawing in para.Descendants<Drawing>())
        {
            foreach (var blip in drawing.Descendants<A.Blip>())
            {
                var embedId = blip.Embed?.Value;
                if (string.IsNullOrEmpty(embedId)) continue;

                // Return cached URL if this image part was already saved
                if (relIdToUrl.TryGetValue(embedId, out var existingUrl))
                {
                    if (!urls.Contains(existingUrl))
                        urls.Add(existingUrl);
                    continue;
                }

                try
                {
                    if (mainPart.GetPartById(embedId) is not ImagePart imagePart) continue;
                    if (!WebImageExtensions.TryGetValue(imagePart.ContentType, out var ext)) continue;

                    var fileName = $"{Guid.NewGuid()}{ext}";
                    var filePath = Path.Combine(imageDirectory, fileName);

                    using var stream = imagePart.GetStream();
                    using var fs     = File.Create(filePath);
                    stream.CopyTo(fs);

                    var url = $"{imageUrlBase}/{fileName}";
                    relIdToUrl[embedId] = url;
                    urls.Add(url);
                }
                catch { /* skip images that can't be read */ }
            }
        }

        return urls;
    }

    private static bool IsHeading(string styleId) =>
        HeadingStyles.Contains(styleId) ||
        styleId.StartsWith("Heading",  StringComparison.OrdinalIgnoreCase) ||
        styleId.StartsWith("heading ", StringComparison.OrdinalIgnoreCase);

    // ---------------------------------------------------------------
    // Chunking  (mirrors Python chunk_section)
    // ---------------------------------------------------------------

    private static List<DocumentChunk> ChunkSection(
        string heading,
        List<WordEntry> entries,
        string sourceFileName,
        Guid chatBotId,
        Dictionary<int, List<string>> paraImages)
    {
        var chunks       = new List<DocumentChunk>();
        var currentWords = new List<WordEntry>();
        var chunkIndex   = 0;

        void Flush()
        {
            if (currentWords.Count == 0) return;

            var text = $"{heading}: {string.Join(' ', currentWords.Select(e => e.Word))}";

            // Collect images from every paragraph that contributed words to this chunk
            var images = currentWords
                .Select(e => e.ParaIndex)
                .Distinct()
                .Where(paraImages.ContainsKey)
                .SelectMany(i => paraImages[i])
                .Distinct()
                .ToList();

            chunks.Add(new DocumentChunk
            {
                DocumentChatBotId = chatBotId,
                ChunkKey          = $"{sourceFileName}::{heading}::{chunkIndex}",
                Heading           = heading,
                Text              = text,
                ChunkIndex        = chunkIndex,
                ImagePaths        = images.Count > 0
                    ? JsonSerializer.Serialize(images)
                    : null,
            });

            chunkIndex++;

            // Keep last OverlapWords for the next chunk
            currentWords = currentWords.Count > OverlapWords
                ? currentWords.Skip(currentWords.Count - OverlapWords).ToList()
                : [];
        }

        foreach (var entry in entries)
        {
            currentWords.Add(entry);
            if (currentWords.Count >= MaxWords)
                Flush();
        }
        Flush();

        return chunks;
    }
}
