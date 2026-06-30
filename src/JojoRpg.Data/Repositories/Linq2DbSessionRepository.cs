using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Data.Generated;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Enums;
using LinqToDB;
using LinqToDB.Async;

namespace JojoRpg.Data.Repositories;

public sealed class Linq2DbSessionRepository : ISessionRepository
{
    private readonly JojoDataConnection _db;

    public Linq2DbSessionRepository(JojoDataConnection db)
    {
        _db = db;
    }

    public async Task<RoomSession?> GetActiveAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        RoomSessionEntity? row = await _db.RoomSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.RevokedAt == null, cancellationToken);

        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<RoomSession>> ListActiveByAccountAsync(Guid accountId, CancellationToken cancellationToken)
    {
        List<RoomSessionEntity> rows = await _db.RoomSessions
            .Where(s => s.AccountId == accountId && s.RevokedAt == null)
            .OrderByDescending(s => s.LastSeenAt ?? s.CreatedAt)
            .ToListAsync(cancellationToken);

        return rows.Select(Map).ToList();
    }

    public async Task AddAsync(RoomSession session, CancellationToken cancellationToken)
    {
        await _db.InsertAsync(new RoomSessionEntity
        {
            Id = session.Id,
            RoomId = session.RoomId,
            Role = session.Role.ToString(),
            PlayerId = session.PlayerId,
            AccountId = session.AccountId,
            CreatedAt = session.CreatedAt,
            LastSeenAt = session.LastSeenAt,
            RevokedAt = session.RevokedAt
        }, token: cancellationToken);
    }

    public async Task RevokeAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        await _db.RoomSessions
            .Where(s => s.Id == sessionId)
            .Set(s => s.RevokedAt, DateTimeOffset.UtcNow)
            .UpdateAsync(cancellationToken);
    }

    public async Task TouchAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        await _db.RoomSessions
            .Where(s => s.Id == sessionId)
            .Set(s => s.LastSeenAt, DateTimeOffset.UtcNow)
            .UpdateAsync(cancellationToken);
    }

    private static RoomSession Map(RoomSessionEntity row)
    {
        return new RoomSession
        {
            Id = row.Id,
            RoomId = row.RoomId,
            Role = Enum.Parse<SessionRole>(row.Role),
            PlayerId = row.PlayerId,
            AccountId = row.AccountId,
            CreatedAt = row.CreatedAt,
            LastSeenAt = row.LastSeenAt,
            RevokedAt = row.RevokedAt
        };
    }
}
