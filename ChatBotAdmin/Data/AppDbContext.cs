using ChatBotAdmin.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatBotAdmin.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<DocumentChatBot> DocumentChatBots => Set<DocumentChatBot>();
    public DbSet<DocumentChunk>   DocumentChunks   => Set<DocumentChunk>();

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
    }
}
