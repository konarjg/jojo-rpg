using JojoRpg.Application.Ports.Security;
using JojoRpg.Domain.Aggregates;
using Microsoft.AspNetCore.Identity;

namespace JojoRpg.Application.Services;

public sealed class AccountPasswordHasher : IAccountPasswordHasher
{
    private readonly PasswordHasher<Account> _hasher = new();

    public string HashPassword(Account account, string password)
    {
        return _hasher.HashPassword(account, password);
    }

    public bool VerifyPassword(Account account, string password)
    {
        PasswordVerificationResult result = _hasher.VerifyHashedPassword(account, account.PasswordHash, password);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
