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

// ── SQLite (shared database with ChatBotAdmin) ────────────────────────────
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

// Apply any pending migrations (ChatBotAdmin owns migration files; ChatBotServer applies them)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

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
// Body:  { "question": "...", "sessionId": "uuid" }
// Reply: { "answer": "...", "images": ["/uploads/..."] }
app.MapPost("/api/chat/{orgId:guid}", async (
    Guid              orgId,
    ChatRequest       request,
    ChatService       chatSvc,
    HttpContext       httpCtx,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Question))
        return Results.BadRequest(new { error = "question is required." });

    var userAgent = httpCtx.Request.Headers.UserAgent.ToString();
    var ipAddress = httpCtx.Connection.RemoteIpAddress?.ToString();

    var result = await chatSvc.AnswerAsync(
        orgId,
        request.Question,
        sessionToken: request.SessionId,
        userAgent:    string.IsNullOrWhiteSpace(userAgent) ? null : userAgent,
        ipAddress:    ipAddress,
        userName:     request.UserName,
        userEmail:    request.UserEmail,
        ct:           ct);

    return Results.Ok(result);
});

// GET /api/history/{orgId}/{sessionToken}
// Returns up to the last 30 messages for this session so the widget can restore them on page load.
app.MapGet("/api/history/{orgId:guid}/{sessionToken}", async (
    Guid         orgId,
    string       sessionToken,
    AppDbContext db,
    CancellationToken ct) =>
{
    var session = await db.ChatSessions
        .AsNoTracking()
        .Where(s => s.DocumentChatBotId == orgId && s.SessionToken == sessionToken)
        .FirstOrDefaultAsync(ct);

    if (session is null)
        return Results.Ok(new HistoryResponse(null, null, []));

    var messages = await db.ChatMessages
        .AsNoTracking()
        .Where(m => m.ChatSessionId == session.Id)
        .OrderByDescending(m => m.AskedAt)
        .Take(30)
        .OrderBy(m => m.AskedAt)
        .Select(m => new HistoryMessage(m.Question, m.Answer, m.Images))
        .ToListAsync(ct);

    return Results.Ok(new HistoryResponse(session.UserName, session.UserEmail, messages));
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
        .Select(x => new { x.Id, x.Name, x.Version, x.Status, x.IconPath, x.Greeting, x.BrandColor })
        .FirstOrDefaultAsync(ct);

    return bot is null ? Results.NotFound() : Results.Ok(bot);
});

app.Run();

record ChatRequest(string Question, string? SessionId, string? UserName, string? UserEmail);
record HistoryMessage(string Question, string Answer, string? Images);
record HistoryResponse(string? UserName, string? UserEmail, List<HistoryMessage> Messages);
