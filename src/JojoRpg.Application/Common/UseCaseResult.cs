namespace JojoRpg.Application.Common;

public sealed class UseCaseResult<T>
{
    public bool Success { get; init; }

    public T? Value { get; init; }

    public string? Error { get; init; }

    public static UseCaseResult<T> Ok(T value) => new() { Success = true, Value = value };

    public static UseCaseResult<T> Fail(string error) => new() { Success = false, Error = error };
}

public sealed class UseCaseResult
{
    public bool Success { get; init; }

    public string? Error { get; init; }

    public static UseCaseResult Ok() => new() { Success = true };

    public static UseCaseResult Fail(string error) => new() { Success = false, Error = error };
}
