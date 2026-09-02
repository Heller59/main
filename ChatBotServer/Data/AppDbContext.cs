using ChatBotServer.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatBotServer.Data;

/// <summary>
/// Read-only view of the ChatBotAdmin SQLite database.
/// Schema must stay in sync with ChatBotAdmin's AppDbContext.
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<DocumentChatBot> DocumentChatBots => Set<DocumentChatBot>();
    public DbSet<DocumentChunk>   DocumentChunks   => Set<DocumentChunk>();
    public DbSet<ChatSession>     ChatSessions      => Set<ChatSession>();
    public DbSet<ChatMessage>     ChatMessages      => Set<ChatMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DocumentChatBot>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).IsRequired().HasMaxLength(200);
            e.Property(x => x.Version).IsRequired().HasMaxLength(50);
            e.Property(x => x.Instructions).IsRequired();
            e.Property(x => x.DocumentFileName).IsRequired().HasMaxLength(500);
            e.Property(x => x.StoredFilePath).HasMaxLength(1000);
            e.Property(x => x.Status).HasConversion<string>();

            e.HasMany(x => x.Chunks)
             .WithOne(c => c.DocumentChatBot)
             .HasForeignKey(c => c.DocumentChatBotId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DocumentChunk>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.ChunkKey).IsRequired().HasMaxLength(500);
            e.Property(x => x.Heading).HasMaxLength(500);
            e.HasIndex(x => x.DocumentChatBotId);
        });

        modelBuilder.Entity<ChatSession>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.SessionToken).IsRequired().HasMaxLength(100);
            e.Property(x => x.UserAgent).HasMaxLength(500);
            e.Property(x => x.IpAddress).HasMaxLength(64);
            e.HasIndex(x => x.SessionToken);
            e.HasIndex(x => x.DocumentChatBotId);

            e.HasMany(x => x.Messages)
             .WithOne(m => m.ChatSession)
             .HasForeignKey(m => m.ChatSessionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatMessage>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Question).IsRequired();
            e.Property(x => x.Answer).IsRequired();
            e.HasIndex(x => x.ChatSessionId);
        });
    }
}
