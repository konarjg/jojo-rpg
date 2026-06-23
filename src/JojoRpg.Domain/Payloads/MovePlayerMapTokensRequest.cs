namespace JojoRpg.Domain.Payloads;

public record MovePlayerMapTokensRequest
{
    public List<PlayerTokenMovePayload> Moves { get; init; } = new();
}

public record PlayerTokenMovePayload
{
    public string Id { get; init; } = string.Empty;

    public int Col { get; init; }

    public int Row { get; init; }
}
