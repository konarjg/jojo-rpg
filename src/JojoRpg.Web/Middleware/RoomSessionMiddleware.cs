using JojoRpg.Application.Sessions;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Enums;
using JojoRpg.Web.Auth;

namespace JojoRpg.Web.Middleware;

public sealed class RoomSessionMiddleware
{
    private readonly RequestDelegate _next;

    public RoomSessionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, GetActiveSessionUseCase getActiveSession, IRoomLookup roomLookup)
    {
        ISessionCookieService cookieService = context.RequestServices.GetRequiredService<ISessionCookieService>();
        Guid? sessionId = cookieService.GetSessionId(context);
        if (sessionId is Guid id)
        {
            RoomSession? session = await getActiveSession.ExecuteAsync(id, context.RequestAborted);
            if (session is not null)
            {
                string? roomCode = await roomLookup.GetRoomCodeAsync(session.RoomId, context.RequestAborted);
                if (roomCode is not null)
                {
                    context.Items[nameof(RoomSessionContext)] = new RoomSessionContext
                    {
                        SessionId = session.Id,
                        RoomId = session.RoomId,
                        RoomCode = roomCode,
                        Role = session.Role,
                        PlayerId = session.PlayerId
                    };
                }
            }
        }

        await _next(context);
    }
}

public interface IRoomLookup
{
    Task<string?> GetRoomCodeAsync(Guid roomId, CancellationToken cancellationToken);
}

public sealed class RoomLookup : IRoomLookup
{
    private readonly JojoRpg.Application.Ports.Persistence.IRoomRepository _roomRepository;

    public RoomLookup(JojoRpg.Application.Ports.Persistence.IRoomRepository roomRepository)
    {
        _roomRepository = roomRepository;
    }

    public async Task<string?> GetRoomCodeAsync(Guid roomId, CancellationToken cancellationToken)
    {
        Domain.Aggregates.Room? room = await _roomRepository.GetByIdAsync(roomId, cancellationToken);
        return room?.RoomCode;
    }
}

public static class RoomSessionMiddlewareExtensions
{
    public static IApplicationBuilder UseRoomSession(this IApplicationBuilder app)
    {
        return app.UseMiddleware<RoomSessionMiddleware>();
    }

    public static RoomSessionContext? GetRoomSession(this HttpContext context)
    {
        return context.Items[nameof(RoomSessionContext)] as RoomSessionContext;
    }

    public static bool RequireGm(this HttpContext context, string roomCode, out RoomSessionContext? session)
    {
        session = context.GetRoomSession();
        return session is not null
            && session.Role == SessionRole.Gm
            && string.Equals(session.RoomCode, roomCode, StringComparison.OrdinalIgnoreCase);
    }

    public static bool RequirePlayer(this HttpContext context, string roomCode, out RoomSessionContext? session)
    {
        session = context.GetRoomSession();
        return session is not null
            && session.Role == SessionRole.Player
            && string.Equals(session.RoomCode, roomCode, StringComparison.OrdinalIgnoreCase);
    }
}
