namespace JojoRpg.Web.Auth;

public sealed class AccountAuthContext
{
    public Guid AccountId { get; init; }

    public string Email { get; init; } = string.Empty;

    public string? DisplayName { get; init; }
}

public static class AccountAuthCookie
{
    public const string Name = "JojoAccountAuth";
    public const int MaxAgeDays = 365;
}
