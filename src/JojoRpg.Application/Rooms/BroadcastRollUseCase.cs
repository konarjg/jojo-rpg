using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Notifications;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Rooms;

public sealed class BroadcastRollUseCase
{
    private readonly IRoomRepository _roomRepository;
    private readonly ICampaignNotifier _campaignNotifier;

    public BroadcastRollUseCase(IRoomRepository roomRepository, ICampaignNotifier campaignNotifier)
    {
        _roomRepository = roomRepository;
        _campaignNotifier = campaignNotifier;
    }

    public async Task<UseCaseResult> ExecuteAsync(Guid roomId, RollPayload roll, CancellationToken cancellationToken)
    {
        Room? room = await _roomRepository.GetByIdAsync(roomId, cancellationToken);
        if (room is null)
        {
            return UseCaseResult.Fail("Room not found.");
        }

        room.LastRoll = roll;
        room.UpdatedAt = DateTimeOffset.UtcNow;
        await _roomRepository.SaveAsync(room, cancellationToken);
        await _campaignNotifier.RollBroadcastAsync(roomId, roll, cancellationToken);
        return UseCaseResult.Ok();
    }
}
