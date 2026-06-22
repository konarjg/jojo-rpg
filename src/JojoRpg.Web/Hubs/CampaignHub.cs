using JojoRpg.Web.Auth;
using JojoRpg.Web.Middleware;
using Microsoft.AspNetCore.SignalR;

namespace JojoRpg.Web.Hubs;

public sealed class CampaignHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        RoomSessionContext? session = Context.GetHttpContext()?.GetRoomSession();
        if (session is not null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"room:{session.RoomId}");
        }

        await base.OnConnectedAsync();
    }
}
