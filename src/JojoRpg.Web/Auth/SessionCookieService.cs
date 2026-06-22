using JojoRpg.Web.Auth;

namespace JojoRpg.Web.Auth;

public interface ISessionCookieService
{
    void SetSession(HttpContext httpContext, Guid sessionId);

    void ClearSession(HttpContext httpContext);

    Guid? GetSessionId(HttpContext httpContext);
}

public sealed class SessionCookieService : ISessionCookieService
{
    public void SetSession(HttpContext httpContext, Guid sessionId)
    {
        CookieOptions options = new()
        {
            HttpOnly = true,
            Secure = httpContext.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromDays(RoomSessionCookie.MaxAgeDays),
            IsEssential = true,
            Path = "/"
        };

        httpContext.Response.Cookies.Append(RoomSessionCookie.Name, sessionId.ToString(), options);
    }

    public void ClearSession(HttpContext httpContext)
    {
        httpContext.Response.Cookies.Delete(RoomSessionCookie.Name);
    }

    public Guid? GetSessionId(HttpContext httpContext)
    {
        if (!httpContext.Request.Cookies.TryGetValue(RoomSessionCookie.Name, out string? value))
        {
            return null;
        }

        return Guid.TryParse(value, out Guid sessionId) ? sessionId : null;
    }
}
