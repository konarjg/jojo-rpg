using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Notifications;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Application.Rooms;

public sealed class StopShareMapUseCase
{
    private readonly IRoomRepository _roomRepository;
    private readonly ICampaignNotifier _campaignNotifier;

    public StopShareMapUseCase(IRoomRepository roomRepository, ICampaignNotifier campaignNotifier)
    {
        _roomRepository = roomRepository;
        _campaignNotifier = campaignNotifier;
    }

    public async Task<UseCaseResult> ExecuteAsync(Guid roomId, CancellationToken cancellationToken)
    {
        Room? room = await _roomRepository.GetByIdAsync(roomId, cancellationToken);
        if (room is null)
        {
            return UseCaseResult.Fail("Room not found.");
        }

        room.SharedMap = null;
        room.MapSharedAt = null;
        room.UpdatedAt = DateTimeOffset.UtcNow;
        await _roomRepository.SaveAsync(room, cancellationToken);
        await _campaignNotifier.MapSharingStoppedAsync(roomId, cancellationToken);
        return UseCaseResult.Ok();
    }
}
