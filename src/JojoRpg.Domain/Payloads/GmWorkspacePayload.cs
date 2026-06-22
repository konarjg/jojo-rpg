using System.Text.Json;
using System.Text.Json.Serialization;

namespace JojoRpg.Domain.Payloads;

public record GmWorkspacePayload
{
    public int SchemaVersion { get; init; } = 2;

    public string ActiveSessionId { get; init; } = string.Empty;

    public bool AutoOpenPlayer { get; init; }

    [JsonPropertyName("npcs")]
    public JsonElement Npcs { get; init; }

    [JsonPropertyName("globalMaps")]
    public JsonElement GlobalMaps { get; init; }

    [JsonPropertyName("snapshots")]
    public JsonElement Snapshots { get; init; }

    [JsonPropertyName("sessions")]
    public JsonElement Sessions { get; init; }
}
