using ChatBotAdmin.Components;
using ChatBotAdmin.Data;
using ChatBotAdmin.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// EF Core – SQLite
var dbPath = Path.Combine(builder.Environment.ContentRootPath, "chatbotadmin.db");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// Ollama HTTP client — base URL from appsettings
var ollamaBase = builder.Configuration["Ollama:BaseUrl"] ?? "http://localhost:11434";
builder.Services.AddHttpClient<OllamaService>(c => c.BaseAddress = new Uri(ollamaBase));

// App services
builder.Services.AddScoped<DocumentChatBotService>();
builder.Services.AddScoped<DocumentChunkerService>();
builder.Services.AddScoped<VectorSearchService>();

// Blazor
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var app = builder.Build();

// Auto-apply EF migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseAntiforgery();
app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
