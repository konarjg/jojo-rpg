using JojoRpg.Application.Accounts;
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
        services.AddSingleton<IAccountPasswordHasher, AccountPasswordHasher>();

        services.AddScoped<RegisterAccountUseCase>();
        services.AddScoped<LoginAccountUseCase>();
        services.AddScoped<LogoutAccountUseCase>();
        services.AddScoped<CreateRoomUseCase>();
        services.AddScoped<JoinRoomUseCase>();
        services.AddScoped<ClaimPlayerUseCase>();
        services.AddScoped<ClaimRoomUseCase>();
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
