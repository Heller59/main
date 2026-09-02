using ChatBotAdmin.Data;
using ChatBotAdmin.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatBotAdmin.Services;

public class ChatSessionService(IDbContextFactory<AppDbContext> dbFactory)
{
    /// <summary>Returns sessions for a bot, newest first, with message count.</summary>
    public async Task<List<ChatSession>> GetSessionsAsync(Guid botId, int page = 1, int pageSize = 50)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        return await db.ChatSessions
            .AsNoTracking()
            .Where(s => s.DocumentChatBotId == botId)
            .OrderByDescending(s => s.LastActivityAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    /// <summary>Total session count for a bot (used for pagination).</summary>
    public async Task<int> GetSessionCountAsync(Guid botId)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        return await db.ChatSessions.CountAsync(s => s.DocumentChatBotId == botId);
    }

    /// <summary>Returns a single session with all its messages ordered chronologically.</summary>
    public async Task<ChatSession?> GetSessionWithMessagesAsync(Guid sessionId)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        return await db.ChatSessions
            .AsNoTracking()
            .Include(s => s.Messages.OrderBy(m => m.AskedAt))
            .Include(s => s.DocumentChatBot)
            .FirstOrDefaultAsync(s => s.Id == sessionId);
    }

    /// <summary>Total message count and session count across all bots (for dashboard).</summary>
    public async Task<(int Sessions, int Messages)> GetTotalsAsync(Guid botId)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        var sessions  = await db.ChatSessions.CountAsync(s => s.DocumentChatBotId == botId);
        var messages  = await db.ChatMessages
            .CountAsync(m => m.ChatSession!.DocumentChatBotId == botId);
        return (sessions, messages);
    }
}
