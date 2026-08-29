using ChatBotServer.Data;
using ChatBotServer.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// ── CORS ──────────────────────────────────────────────────────────────────
// Widget is embedded in third-party sites, so we must allow any origin.
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader()));

// ── SQLite (ChatBotAdmin's database — read-only by this app) ──────────────
var dbPath = builder.Configuration["ChatBotServer:DbPath"]
    ?? throw new InvalidOperationException(
        "ChatBotServer:DbPath is required. Set it in appsettings.json.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// ── Ollama ────────────────────────────────────────────────────────────────
var ollamaBase = builder.Configuration["Ollama:BaseUrl"] ?? "http://localhost:11434";
builder.Services.AddHttpClient<OllamaService>(c =>
{
    c.BaseAddress = new Uri(ollamaBase);
    c.Timeout     = TimeSpan.FromMinutes(3); // LLM inference can be slow
});

// ── App services ──────────────────────────────────────────────────────────
builder.Services.AddScoped<VectorSearchService>();
builder.Services.AddScoped<ChatService>();

var app = builder.Build();

app.UseCors();
app.UseStaticFiles(); // serves wwwroot/chatbot.js

// ── Serve images from ChatBotAdmin's Uploads folder ───────────────────────
var uploadsPath = builder.Configuration["ChatBotServer:UploadsPath"];
if (!string.IsNullOrWhiteSpace(uploadsPath) && Directory.Exists(uploadsPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(uploadsPath),
        RequestPath  = "/uploads"
    });
}

// ── API ───────────────────────────────────────────────────────────────────

// POST /api/chat/{orgId}
// Body:  { "question": "..." }
// Reply: { "answer": "...", "images": ["/uploads/..."] }
app.MapPost("/api/chat/{orgId:guid}", async (
    Guid        orgId,
    ChatRequest request,
    ChatService chatSvc,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Question))
        return Results.BadRequest(new { error = "question is required." });

    var result = await chatSvc.AnswerAsync(orgId, request.Question, ct: ct);
    return Results.Ok(result);
});

// GET /api/info/{orgId}  — lightweight check: does this chatbot exist and is it ready?
app.MapGet("/api/info/{orgId:guid}", async (
    Guid orgId,
    AppDbContext db,
    CancellationToken ct) =>
{
    var bot = await db.DocumentChatBots
        .AsNoTracking()
        .Where(x => x.Id == orgId)
        .Select(x => new { x.Id, x.Name, x.Version, x.Status, x.IconPath })
        .FirstOrDefaultAsync(ct);

    return bot is null ? Results.NotFound() : Results.Ok(bot);
});

app.Run();

record ChatRequest(string Question);
