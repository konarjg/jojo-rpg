using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Players;

public sealed class SavePlayerStickiesUseCase
{
    private readonly IPlayerRepository _playerRepository;

    public SavePlayerStickiesUseCase(IPlayerRepository playerRepository)
    {
        _playerRepository = playerRepository;
    }

    public async Task<UseCaseResult> ExecuteAsync(Guid playerId, StickyBoardPayload stickies, CancellationToken cancellationToken)
    {
        Player? player = await _playerRepository.GetAsync(playerId, cancellationToken);
        if (player is null)
        {
            return UseCaseResult.Fail("Player not found.");
        }

        player.StickyBoard = stickies;
        player.LastSeenAt = DateTimeOffset.UtcNow;
        await _playerRepository.SaveAsync(player, cancellationToken);
        return UseCaseResult.Ok();
    }
}

public sealed class GetPlayerStickiesUseCase
{
    private readonly IPlayerRepository _playerRepository;

    public GetPlayerStickiesUseCase(IPlayerRepository playerRepository)
    {
        _playerRepository = playerRepository;
    }

    public async Task<StickyBoardPayload?> ExecuteAsync(Guid playerId, CancellationToken cancellationToken)
    {
        Player? player = await _playerRepository.GetAsync(playerId, cancellationToken);
        return player?.StickyBoard;
    }
}
