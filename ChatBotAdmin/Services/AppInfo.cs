namespace ChatBotAdmin.Services;

/// <summary>
/// Strongly-typed app-level settings read from appsettings.json "App" section.
/// Registered as a singleton so every component can inject it.
/// </summary>
public sealed class AppInfo
{
    public string Name { get; }

    public AppInfo(IConfiguration config)
    {
        Name = config["App:Name"] ?? "Mentor Chatbot";
    }
}
