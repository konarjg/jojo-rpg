using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Notifications;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Players;

public sealed class SavePlayerSheetUseCase
{
    private readonly IPlayerRepository _playerRepository;
    private readonly ICampaignNotifier _campaignNotifier;

    public SavePlayerSheetUseCase(IPlayerRepository playerRepository, ICampaignNotifier campaignNotifier)
    {
        _playerRepository = playerRepository;
        _campaignNotifier = campaignNotifier;
    }

    public async Task<UseCaseResult> ExecuteAsync(Guid playerId, CharacterSheetPayload sheet, CancellationToken cancellationToken)
    {
        Player? player = await _playerRepository.GetAsync(playerId, cancellationToken);
        if (player is null)
        {
            return UseCaseResult.Fail("Player not found.");
        }

        player.Sheet = sheet;
        player.SheetSchemaVersion = sheet.SchemaVersion;
        player.LastSeenAt = DateTimeOffset.UtcNow;
        await _playerRepository.SaveAsync(player, cancellationToken);
        await _campaignNotifier.PlayerSheetChangedAsync(player.RoomId, playerId, player.DisplayName, cancellationToken);
        return UseCaseResult.Ok();
    }
}
