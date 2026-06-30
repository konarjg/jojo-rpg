using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Application.Ports.Persistence;

public interface IRoomRepository
{
    Task<Room?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<Room?> GetByCodeAsync(string roomCode, CancellationToken cancellationToken);

    Task<IReadOnlyList<Room>> ListByOwnerAccountAsync(Guid accountId, CancellationToken cancellationToken);

    Task AddAsync(Room room, CancellationToken cancellationToken);

    Task SaveAsync(Room room, CancellationToken cancellationToken);
}
