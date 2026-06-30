using System.Security.Cryptography;
using System.Text.Json;
using JojoRpg.Domain.Aggregates;
using Microsoft.AspNetCore.DataProtection;

namespace JojoRpg.Web.Auth;

public interface IAccountAuthCookieService
{
    void SetAccount(HttpContext httpContext, Account account);

    void ClearAccount(HttpContext httpContext);

    Guid? GetAccountId(HttpContext httpContext);
}

public sealed class AccountAuthCookieService : IAccountAuthCookieService
{
    private readonly IDataProtector _protector;

    public AccountAuthCookieService(IDataProtectionProvider dataProtectionProvider)
    {
        _protector = dataProtectionProvider.CreateProtector("JojoRpg.AccountAuthCookie.v1");
    }

    public void SetAccount(HttpContext httpContext, Account account)
    {
        AccountCookiePayload payload = new()
        {
            AccountId = account.Id,
            Email = account.Email,
            IssuedAt = DateTimeOffset.UtcNow,
        };

        string json = JsonSerializer.Serialize(payload);
        string protectedValue = _protector.Protect(json);
        CookieOptions options = new()
        {
            HttpOnly = true,
            Secure = httpContext.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromDays(AccountAuthCookie.MaxAgeDays),
            IsEssential = true,
            Path = "/",
        };

        httpContext.Response.Cookies.Append(AccountAuthCookie.Name, protectedValue, options);
    }

    public void ClearAccount(HttpContext httpContext)
    {
        httpContext.Response.Cookies.Delete(AccountAuthCookie.Name);
    }

    public Guid? GetAccountId(HttpContext httpContext)
    {
        if (!httpContext.Request.Cookies.TryGetValue(AccountAuthCookie.Name, out string? value))
        {
            return null;
        }

        try
        {
            string json = _protector.Unprotect(value);
            AccountCookiePayload? payload = JsonSerializer.Deserialize<AccountCookiePayload>(json);
            return payload?.AccountId;
        }
        catch (CryptographicException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private sealed class AccountCookiePayload
    {
        public Guid AccountId { get; init; }

        public string Email { get; init; } = string.Empty;

        public DateTimeOffset IssuedAt { get; init; }
    }
}
