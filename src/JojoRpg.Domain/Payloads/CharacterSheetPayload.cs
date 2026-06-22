using System.Text.Json;

namespace JojoRpg.Domain.Payloads;

public record CharacterSheetPayload
{
    public string Id { get; init; } = string.Empty;

    public string Name { get; init; } = string.Empty;

    public int SchemaVersion { get; init; } = 2;

    public JsonElement Data { get; init; }
}
