using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Application.Ports.Persistence;

public interface ISessionRepository
{
    Task<RoomSession?> GetActiveAsync(Guid sessionId, CancellationToken cancellationToken);

    Task AddAsync(RoomSession session, CancellationToken cancellationToken);

    Task RevokeAsync(Guid sessionId, CancellationToken cancellationToken);

    Task TouchAsync(Guid sessionId, CancellationToken cancellationToken);
}
