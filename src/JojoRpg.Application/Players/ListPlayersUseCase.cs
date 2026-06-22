using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Application.Players;

public sealed class ListPlayersUseCase
{
    private readonly IPlayerRepository _playerRepository;

    public ListPlayersUseCase(IPlayerRepository playerRepository)
    {
        _playerRepository = playerRepository;
    }

    public async Task<IReadOnlyList<Player>> ExecuteAsync(Guid roomId, CancellationToken cancellationToken)
    {
        return await _playerRepository.ListByRoomAsync(roomId, cancellationToken);
    }
}

public sealed class GetPlayerSheetUseCase
{
    private readonly IPlayerRepository _playerRepository;

    public GetPlayerSheetUseCase(IPlayerRepository playerRepository)
    {
        _playerRepository = playerRepository;
    }

    public async Task<Player?> ExecuteAsync(Guid playerId, CancellationToken cancellationToken)
    {
        return await _playerRepository.GetAsync(playerId, cancellationToken);
    }
}
