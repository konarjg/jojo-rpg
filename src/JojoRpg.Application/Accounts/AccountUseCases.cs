using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Application.Ports.Security;
using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Application.Accounts;

public sealed class RegisterAccountRequest
{
    public string Email { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;

    public string? DisplayName { get; init; }
}

public sealed class LoginAccountRequest
{
    public string Email { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;
}

public sealed class AccountAuthResponse
{
    public Guid AccountId { get; init; }

    public string Email { get; init; } = string.Empty;

    public string? DisplayName { get; init; }
}

public sealed class RegisterAccountUseCase
{
    private readonly IAccountRepository _accountRepository;
    private readonly IAccountPasswordHasher _passwordHasher;

    public RegisterAccountUseCase(IAccountRepository accountRepository, IAccountPasswordHasher passwordHasher)
    {
        _accountRepository = accountRepository;
        _passwordHasher = passwordHasher;
    }

    public async Task<UseCaseResult<AccountAuthResponse>> ExecuteAsync(RegisterAccountRequest request, CancellationToken cancellationToken)
    {
        string email = NormalizeEmail(request.Email);
        if (!IsValidEmail(email))
        {
            return UseCaseResult<AccountAuthResponse>.Fail("Enter a valid email address.");
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
        {
            return UseCaseResult<AccountAuthResponse>.Fail("Password must be at least 8 characters.");
        }

        Account? existing = await _accountRepository.GetByEmailAsync(email, cancellationToken);
        if (existing is not null)
        {
            return UseCaseResult<AccountAuthResponse>.Fail("An account with that email already exists.");
        }

        DateTimeOffset now = DateTimeOffset.UtcNow;
        Account account = new()
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = NormalizeDisplayName(request.DisplayName),
            CreatedAt = now,
            UpdatedAt = now,
        };
        account.PasswordHash = _passwordHasher.HashPassword(account, request.Password);

        await _accountRepository.AddAsync(account, cancellationToken);
        return UseCaseResult<AccountAuthResponse>.Ok(ToResponse(account));
    }

    private static string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    private static string? NormalizeDisplayName(string? displayName)
    {
        return string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
    }

    private static bool IsValidEmail(string email)
    {
        return email.Length <= 256 && email.Contains('@', StringComparison.Ordinal) && email.Contains('.', StringComparison.Ordinal);
    }

    private static AccountAuthResponse ToResponse(Account account)
    {
        return new AccountAuthResponse
        {
            AccountId = account.Id,
            Email = account.Email,
            DisplayName = account.DisplayName,
        };
    }
}

public sealed class LoginAccountUseCase
{
    private readonly IAccountRepository _accountRepository;
    private readonly IAccountPasswordHasher _passwordHasher;

    public LoginAccountUseCase(IAccountRepository accountRepository, IAccountPasswordHasher passwordHasher)
    {
        _accountRepository = accountRepository;
        _passwordHasher = passwordHasher;
    }

    public async Task<UseCaseResult<AccountAuthResponse>> ExecuteAsync(LoginAccountRequest request, CancellationToken cancellationToken)
    {
        string email = request.Email.Trim().ToLowerInvariant();
        Account? account = await _accountRepository.GetByEmailAsync(email, cancellationToken);
        if (account is null || !_passwordHasher.VerifyPassword(account, request.Password))
        {
            return UseCaseResult<AccountAuthResponse>.Fail("Invalid email or password.");
        }

        return UseCaseResult<AccountAuthResponse>.Ok(new AccountAuthResponse
        {
            AccountId = account.Id,
            Email = account.Email,
            DisplayName = account.DisplayName,
        });
    }
}

public sealed class LogoutAccountUseCase
{
    public UseCaseResult Execute()
    {
        return UseCaseResult.Ok();
    }
}
