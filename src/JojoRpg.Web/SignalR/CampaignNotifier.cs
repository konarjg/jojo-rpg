using JojoRpg.Application.Ports.Notifications;
using JojoRpg.Domain.Payloads;
using JojoRpg.Web.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace JojoRpg.Web.SignalR;

public sealed class CampaignNotifier : ICampaignNotifier
{
    private readonly IHubContext<CampaignHub> _hubContext;

    public CampaignNotifier(IHubContext<CampaignHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public Task MapSharedAsync(Guid roomId, SharedMapPayload map, CancellationToken cancellationToken)
    {
        return _hubContext.Clients.Group(RoomGroup(roomId)).SendAsync("MapShared", map, cancellationToken);
    }

    public Task MapSharingStoppedAsync(Guid roomId, CancellationToken cancellationToken)
    {
        return _hubContext.Clients.Group(RoomGroup(roomId)).SendAsync("MapSharingStopped", cancellationToken);
    }

    public Task RollBroadcastAsync(Guid roomId, RollPayload roll, CancellationToken cancellationToken)
    {
        return _hubContext.Clients.Group(RoomGroup(roomId)).SendAsync("RollBroadcast", roll, cancellationToken);
    }

    public Task PlayerSheetChangedAsync(Guid roomId, Guid playerId, string displayName, CancellationToken cancellationToken)
    {
        return _hubContext.Clients.Group(RoomGroup(roomId)).SendAsync("PlayerSheetsChanged", new { playerId, displayName }, cancellationToken);
    }

    private static string RoomGroup(Guid roomId) => $"room:{roomId}";
}
