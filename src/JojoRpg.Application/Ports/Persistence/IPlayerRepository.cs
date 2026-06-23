using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Application.Ports.Persistence;

public interface IPlayerRepository
{
    Task<Player?> GetAsync(Guid playerId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Player>> ListByRoomAsync(Guid roomId, CancellationToken cancellationToken);

    Task<Player?> GetByRoomAndPlayerCodeHashAsync(Guid roomId, string playerCodeHash, CancellationToken cancellationToken);

    Task AddAsync(Player player, CancellationToken cancellationToken);

    Task SaveAsync(Player player, CancellationToken cancellationToken);
}
