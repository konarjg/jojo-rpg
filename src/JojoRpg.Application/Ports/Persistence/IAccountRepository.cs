using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Application.Ports.Persistence;

public interface IAccountRepository
{
    Task<Account?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<Account?> GetByEmailAsync(string email, CancellationToken cancellationToken);

    Task AddAsync(Account account, CancellationToken cancellationToken);

    Task SaveAsync(Account account, CancellationToken cancellationToken);
}
