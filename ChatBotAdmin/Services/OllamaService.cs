using System.Net.Http.Json;
using System.Runtime.InteropServices;
using System.Text.Json.Serialization;

namespace ChatBotAdmin.Services;

/// <summary>
/// Thin wrapper around the Ollama REST API.
/// Mirrors what the Python DocBot does with ollama.embeddings() and ollama.chat().
/// </summary>
public class OllamaService(HttpClient http, IConfiguration config)
{
    private string EmbedModel => config["Ollama:EmbedModel"] ?? "nomic-embed-text";
    private string ChatModel  => config["Ollama:ChatModel"]  ?? "qwen3:8b";

    // ---------------------------------------------------------------
    // Embeddings  (mirrors Python: ollama.embeddings(model=..., prompt=...))
    // ---------------------------------------------------------------

    public async Task<float[]> EmbedAsync(string text, CancellationToken ct = default)
    {
        var request  = new { model = EmbedModel, prompt = text };
        var response = await http.PostAsJsonAsync("/api/embeddings", request, ct);

        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<EmbeddingResponse>(ct)
                     ?? throw new InvalidOperationException("Ollama returned no embedding.");

        return result.Embedding;
    }

    // ---------------------------------------------------------------
    // Chat  (mirrors Python: ollama.chat(model=..., messages=[...]))
    // ---------------------------------------------------------------

    public async Task<string> ChatAsync(
        string systemPrompt,
        string userMessage,
        CancellationToken ct = default)
    {
        var request = new
        {
            model  = ChatModel,
            stream = false,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user",   content = userMessage  },
            }
        };

        var response = await http.PostAsJsonAsync("/api/chat", request, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<ChatResponse>(ct)
                     ?? throw new InvalidOperationException("Ollama returned no chat response.");

        return result.Message.Content;
    }

    // ---------------------------------------------------------------
    // Serialisation helpers
    // ---------------------------------------------------------------

    /// <summary>Serialise float[] → byte[] (little-endian, same as sqlite-vec wire format)</summary>
    public static byte[] SerializeEmbedding(float[] floats)
    {
        var bytes = new byte[floats.Length * sizeof(float)];
        MemoryMarshal.Cast<float, byte>(floats).CopyTo(bytes);
        return bytes;
    }

    /// <summary>Deserialise byte[] → float[]</summary>
    public static float[] DeserializeEmbedding(byte[] bytes)
    {
        var floats = new float[bytes.Length / sizeof(float)];
        MemoryMarshal.Cast<byte, float>(bytes).CopyTo(floats);
        return floats;
    }

    // ---------------------------------------------------------------
    // DTOs
    // ---------------------------------------------------------------

    private sealed class EmbeddingResponse
    {
        [JsonPropertyName("embedding")]
        public float[] Embedding { get; set; } = [];
    }

    private sealed class ChatResponse
    {
        [JsonPropertyName("message")]
        public ChatMessage Message { get; set; } = new();
    }

    private sealed class ChatMessage
    {
        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }
}
