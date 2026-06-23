using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Ports.Notifications;

public interface ICampaignNotifier
{
    Task MapSharedAsync(Guid roomId, SharedMapPayload map, CancellationToken cancellationToken);

    Task MapSharingStoppedAsync(Guid roomId, CancellationToken cancellationToken);

    Task RollBroadcastAsync(Guid roomId, RollPayload roll, CancellationToken cancellationToken);

    Task PlayerSheetChangedAsync(Guid roomId, Guid playerId, string displayName, CancellationToken cancellationToken);
}
