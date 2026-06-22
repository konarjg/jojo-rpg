using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Notifications;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Rooms;

public sealed class ShareMapUseCase
{
    private readonly IRoomRepository _roomRepository;
    private readonly ICampaignNotifier _campaignNotifier;

    public ShareMapUseCase(IRoomRepository roomRepository, ICampaignNotifier campaignNotifier)
    {
        _roomRepository = roomRepository;
        _campaignNotifier = campaignNotifier;
    }

    public async Task<UseCaseResult> ExecuteAsync(Guid roomId, SharedMapPayload map, CancellationToken cancellationToken)
    {
        Room? room = await _roomRepository.GetByIdAsync(roomId, cancellationToken);
        if (room is null)
        {
            return UseCaseResult.Fail("Room not found.");
        }

        room.SharedMap = map;
        room.MapSharedAt = DateTimeOffset.UtcNow;
        room.UpdatedAt = DateTimeOffset.UtcNow;
        await _roomRepository.SaveAsync(room, cancellationToken);
        await _campaignNotifier.MapSharedAsync(roomId, map, cancellationToken);
        return UseCaseResult.Ok();
    }
}
