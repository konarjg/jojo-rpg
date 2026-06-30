using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Data.Generated;
using JojoRpg.Domain.Aggregates;
using LinqToDB;
using LinqToDB.Async;

namespace JojoRpg.Data.Repositories;

public sealed class Linq2DbAccountRepository : IAccountRepository
{
    private readonly JojoDataConnection _db;

    public Linq2DbAccountRepository(JojoDataConnection db)
    {
        _db = db;
    }

    public async Task<Account?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        AccountEntity? row = await _db.Accounts.FirstOrDefaultAsync(a => a.Id == id && a.DeletedAt == null, cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task<Account?> GetByEmailAsync(string email, CancellationToken cancellationToken)
    {
        string normalizedEmail = NormalizeEmail(email);
        AccountEntity? row = await _db.Accounts.FirstOrDefaultAsync(a => a.Email == normalizedEmail && a.DeletedAt == null, cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task AddAsync(Account account, CancellationToken cancellationToken)
    {
        account.Email = NormalizeEmail(account.Email);
        await _db.InsertAsync(new AccountEntity
        {
            Id = account.Id,
            Email = account.Email,
            PasswordHash = account.PasswordHash,
            DisplayName = account.DisplayName,
            CreatedAt = account.CreatedAt,
            UpdatedAt = account.UpdatedAt,
            DeletedAt = account.DeletedAt,
        }, token: cancellationToken);
    }

    public async Task SaveAsync(Account account, CancellationToken cancellationToken)
    {
        account.Email = NormalizeEmail(account.Email);
        await _db.Accounts
            .Where(a => a.Id == account.Id)
            .Set(a => a.Email, account.Email)
            .Set(a => a.PasswordHash, account.PasswordHash)
            .Set(a => a.DisplayName, account.DisplayName)
            .Set(a => a.UpdatedAt, account.UpdatedAt)
            .Set(a => a.DeletedAt, account.DeletedAt)
            .UpdateAsync(cancellationToken);
    }

    private static Account Map(AccountEntity row)
    {
        return new Account
        {
            Id = row.Id,
            Email = row.Email,
            PasswordHash = row.PasswordHash,
            DisplayName = row.DisplayName,
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt,
            DeletedAt = row.DeletedAt,
        };
    }

    private static string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }
}
