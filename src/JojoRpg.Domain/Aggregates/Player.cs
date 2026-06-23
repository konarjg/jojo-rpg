using JojoRpg.Domain.Payloads;

namespace JojoRpg.Domain.Aggregates;

public class Player
{
    public Guid Id { get; set; }

    public Guid RoomId { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public DateTimeOffset JoinedAt { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }

    public string? PlayerCodeHash { get; set; }

    public int SheetSchemaVersion { get; set; } = 2;

    public CharacterSheetPayload Sheet { get; set; } = new();

    public StickyBoardPayload StickyBoard { get; set; } = new();
}
