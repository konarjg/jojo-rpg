using System.Text.Json;
using JojoRpg.Web.Auth;

namespace JojoRpg.Web.Auth;

public interface IPlayerCodeCookieService
{
    string? GetPlayerCode(HttpContext httpContext, string roomCode);

    void SetPlayerCode(HttpContext httpContext, string roomCode, string playerCode);
}

public sealed class PlayerCodeCookieService : IPlayerCodeCookieService
{
    public const string CookieName = "JojoPlayerCodes";
    private const int MaxAgeDays = 400;

    public string? GetPlayerCode(HttpContext httpContext, string roomCode)
    {
        if (!httpContext.Request.Cookies.TryGetValue(CookieName, out string? raw) || string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        try
        {
            Dictionary<string, string>? map = JsonSerializer.Deserialize<Dictionary<string, string>>(raw);
            if (map is null)
            {
                return null;
            }

            string normalizedRoomCode = roomCode.Trim().ToUpperInvariant();
            foreach (KeyValuePair<string, string> entry in map)
            {
                if (string.Equals(entry.Key, normalizedRoomCode, StringComparison.OrdinalIgnoreCase)
                    && !string.IsNullOrWhiteSpace(entry.Value))
                {
                    return entry.Value.Trim().ToUpperInvariant();
                }
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    public void SetPlayerCode(HttpContext httpContext, string roomCode, string playerCode)
    {
        Dictionary<string, string> map = new(StringComparer.OrdinalIgnoreCase);
        if (httpContext.Request.Cookies.TryGetValue(CookieName, out string? raw) && !string.IsNullOrWhiteSpace(raw))
        {
            try
            {
                Dictionary<string, string>? existing = JsonSerializer.Deserialize<Dictionary<string, string>>(raw);
                if (existing is not null)
                {
                    foreach (KeyValuePair<string, string> entry in existing)
                    {
                        if (!string.IsNullOrWhiteSpace(entry.Key) && !string.IsNullOrWhiteSpace(entry.Value))
                        {
                            map[entry.Key.Trim().ToUpperInvariant()] = entry.Value.Trim().ToUpperInvariant();
                        }
                    }
                }
            }
            catch (JsonException)
            {
                // Replace corrupt cookie payload.
            }
        }

        map[roomCode.Trim().ToUpperInvariant()] = playerCode.Trim().ToUpperInvariant();

        CookieOptions options = new()
        {
            HttpOnly = true,
            Secure = httpContext.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromDays(MaxAgeDays),
            IsEssential = true,
            Path = "/"
        };

        httpContext.Response.Cookies.Append(CookieName, JsonSerializer.Serialize(map), options);
    }
}
