using JojoRpg.Domain.Enums;

namespace JojoRpg.Domain.Aggregates;

public class RoomSession
{
    public Guid Id { get; set; }

    public Guid RoomId { get; set; }

    public SessionRole Role { get; set; }

    public Guid? PlayerId { get; set; }

    public Guid? AccountId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? LastSeenAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public bool IsActive => RevokedAt is null;
}
