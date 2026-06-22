namespace JojoRpg.Domain.Payloads;

public record RollPayload
{
    public string Die { get; init; } = string.Empty;

    public int Count { get; init; }

    public List<int> Results { get; init; } = new();
}
