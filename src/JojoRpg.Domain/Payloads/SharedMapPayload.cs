using System.Text.Json.Serialization;

namespace JojoRpg.Domain.Payloads;

public record SharedMapPayload
{
    public string MapName { get; init; } = string.Empty;

    [JsonPropertyName("tokens")]
    public List<MapTokenPayload> Tokens { get; init; } = new();
}

public record MapTokenPayload
{
    public string Id { get; init; } = string.Empty;

    public string Label { get; init; } = string.Empty;

    public string Type { get; init; } = "player";

    public int X { get; init; }

    public int Y { get; init; }

    public int? Col { get; init; }

    public int? Row { get; init; }

    public string Color { get; init; } = string.Empty;
}
