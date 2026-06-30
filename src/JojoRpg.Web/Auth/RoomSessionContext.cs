using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Web.Auth;

public sealed class RoomSessionContext
{
    public Guid SessionId { get; init; }

    public Guid RoomId { get; init; }

    public string RoomCode { get; init; } = string.Empty;

    public Domain.Enums.SessionRole Role { get; init; }

    public Guid? PlayerId { get; init; }

    public Guid? AccountId { get; init; }
}

public static class RoomSessionCookie
{
    public const string Name = "RoomSessionId";
    public const int MaxAgeDays = 365;
}
