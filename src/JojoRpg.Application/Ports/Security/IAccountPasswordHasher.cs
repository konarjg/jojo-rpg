using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Application.Ports.Security;

public interface IAccountPasswordHasher
{
    string HashPassword(Account account, string password);

    bool VerifyPassword(Account account, string password);
}
