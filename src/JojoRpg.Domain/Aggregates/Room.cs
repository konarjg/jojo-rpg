using JojoRpg.Domain.Enums;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Domain.Aggregates;

public class Room
{
    public Guid Id { get; set; }

    public string RoomCode { get; set; } = string.Empty;

    public string GmCodeHash { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public int WorkspaceSchemaVersion { get; set; } = 2;

    public GmWorkspacePayload Workspace { get; set; } = new();

    public SharedMapPayload? SharedMap { get; set; }

    public RollPayload? LastRoll { get; set; }

    public DateTimeOffset? MapSharedAt { get; set; }
}
