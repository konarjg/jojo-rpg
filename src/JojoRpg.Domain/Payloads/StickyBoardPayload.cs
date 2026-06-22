namespace JojoRpg.Domain.Payloads;

public record StickyBoardPayload
{
    public List<StickyNotePayload> Stickies { get; init; } = new();
}

public record StickyNotePayload
{
    public string Id { get; init; } = string.Empty;

    public string Text { get; init; } = string.Empty;

    public string Color { get; init; } = string.Empty;

    public int X { get; init; }

    public int Y { get; init; }
}
