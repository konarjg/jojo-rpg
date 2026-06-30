using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Web.Auth;

namespace JojoRpg.Web.Middleware;

public sealed class AccountAuthMiddleware
{
    private readonly RequestDelegate _next;

    public AccountAuthMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IAccountRepository accountRepository)
    {
        IAccountAuthCookieService cookieService = context.RequestServices.GetRequiredService<IAccountAuthCookieService>();
        Guid? accountId = cookieService.GetAccountId(context);
        if (accountId is Guid id)
        {
            Account? account = await accountRepository.GetByIdAsync(id, context.RequestAborted);
            if (account is not null)
            {
                context.Items[nameof(AccountAuthContext)] = new AccountAuthContext
                {
                    AccountId = account.Id,
                    Email = account.Email,
                    DisplayName = account.DisplayName,
                };
            }
        }

        await _next(context);
    }
}

public static class AccountAuthMiddlewareExtensions
{
    public static IApplicationBuilder UseAccountAuth(this IApplicationBuilder app)
    {
        return app.UseMiddleware<AccountAuthMiddleware>();
    }

    public static AccountAuthContext? GetAccount(this HttpContext context)
    {
        return context.Items[nameof(AccountAuthContext)] as AccountAuthContext;
    }
}
