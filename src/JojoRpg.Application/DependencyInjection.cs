using JojoRpg.Application.Players;
using JojoRpg.Application.Rooms;
using JojoRpg.Application.Sessions;
using JojoRpg.Application.Services;
using JojoRpg.Application.Ports.Security;
using Microsoft.Extensions.DependencyInjection;

namespace JojoRpg.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton<IGmCodeHasher, GmCodeHasher>();
        services.AddSingleton<IRoomCodeGenerator, RoomCodeGenerator>();

        services.AddScoped<CreateRoomUseCase>();
        services.AddScoped<JoinRoomUseCase>();
        services.AddScoped<LeaveSessionUseCase>();
        services.AddScoped<AuthenticateGmUseCase>();
        services.AddScoped<GetActiveSessionUseCase>();
        services.AddScoped<SaveGmWorkspaceUseCase>();
        services.AddScoped<GetGmWorkspaceUseCase>();
        services.AddScoped<ShareMapUseCase>();
        services.AddScoped<StopShareMapUseCase>();
        services.AddScoped<MovePlayerMapTokensUseCase>();
        services.AddScoped<BroadcastRollUseCase>();
        services.AddScoped<GetSharedViewUseCase>();
        services.AddScoped<SavePlayerSheetUseCase>();
        services.AddScoped<SavePlayerStickiesUseCase>();
        services.AddScoped<GetPlayerStickiesUseCase>();
        services.AddScoped<ListPlayersUseCase>();
        services.AddScoped<GetPlayerSheetUseCase>();

        return services;
    }
}
