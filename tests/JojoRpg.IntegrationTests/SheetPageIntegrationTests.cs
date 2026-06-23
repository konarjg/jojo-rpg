using System.Net;
using JojoRpg.Application;
using JojoRpg.Application.Sessions;
using JojoRpg.Data;
using JojoRpg.Web.Auth;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace JojoRpg.IntegrationTests;

[Collection("Sql")]
public sealed class SheetPageIntegrationTests : IAsyncLifetime
{
    private readonly SqlTestFixture _fixture;
    private WebApplicationFactory<Program>? _factory;

    public SheetPageIntegrationTests(SqlTestFixture fixture)
    {
        _fixture = fixture;
    }

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:Default", _fixture.ConnectionString);
            });

        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _factory?.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task GmSheetRoutes_AndPlayerPlay_ReturnInteractiveSheetShell()
    {
        Assert.NotNull(_factory);

        HttpClient gmClient = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        HttpClient playerClient = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        HttpResponseMessage createResponse = await gmClient.PostAsync("/rooms", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["name"] = "Sheet Test Room"
        }));

        Assert.Equal(HttpStatusCode.Redirect, createResponse.StatusCode);
        string roomCode = ExtractRoomCodeFromLocation(createResponse.Headers.Location?.OriginalString);
        string gmCookieHeader = BuildCookieHeader(createResponse);

        HttpResponseMessage sheetsPage = await SendWithCookie(gmClient, HttpMethod.Get, $"/room/{roomCode}/gm/sheets", gmCookieHeader);
        Assert.Equal(HttpStatusCode.OK, sheetsPage.StatusCode);
        string sheetsHtml = await sheetsPage.Content.ReadAsStringAsync();
        Assert.Contains("Reference character builder", sheetsHtml);

        HttpResponseMessage builderPage = await SendWithCookie(gmClient, HttpMethod.Get, $"/room/{roomCode}/gm/builder", gmCookieHeader);
        Assert.Equal(HttpStatusCode.OK, builderPage.StatusCode);
        string builderHtml = await builderPage.Content.ReadAsStringAsync();
        Assert.Contains("sheet-shell", builderHtml);
        Assert.Contains("sheet-app.js", builderHtml);
        Assert.DoesNotContain("sheet-json-preview", builderHtml);

        HttpResponseMessage playerViewPage = await SendWithCookie(gmClient, HttpMethod.Get, $"/room/{roomCode}/player-view", gmCookieHeader);
        Assert.Equal(HttpStatusCode.Redirect, playerViewPage.StatusCode);
        Assert.Contains("/gm", playerViewPage.Headers.Location?.OriginalString ?? string.Empty);

        HttpResponseMessage joinResponse = await playerClient.PostAsync($"/room/{roomCode}/join", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["displayName"] = "Alice"
        }));

        Assert.Equal(HttpStatusCode.Redirect, joinResponse.StatusCode);
        string playerCookieHeader = BuildCookieHeader(joinResponse);
        Guid playerId = await GetPlayerIdFromSessionAsync(ExtractCookieValue(joinResponse));

        HttpResponseMessage playPage = await SendWithCookie(playerClient, HttpMethod.Get, $"/room/{roomCode}/play", playerCookieHeader);
        Assert.Equal(HttpStatusCode.OK, playPage.StatusCode);
        string playHtml = await playPage.Content.ReadAsStringAsync();
        Assert.Contains("sheet-shell", playHtml);
        Assert.Contains("sheet-app.js", playHtml);

        HttpResponseMessage gmSheetPage = await SendWithCookie(gmClient, HttpMethod.Get, $"/room/{roomCode}/gm/sheet/{playerId}", gmCookieHeader);
        Assert.Equal(HttpStatusCode.OK, gmSheetPage.StatusCode);
        string gmSheetHtml = await gmSheetPage.Content.ReadAsStringAsync();
        Assert.Contains("read-only", gmSheetHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("sheet-shell", gmSheetHtml);
    }

    private static async Task<HttpResponseMessage> SendWithCookie(HttpClient client, HttpMethod method, string url, string cookieHeader)
    {
        HttpRequestMessage request = new(method, url);
        request.Headers.Add("Cookie", cookieHeader);
        return await client.SendAsync(request);
    }

    private static string BuildCookieHeader(HttpResponseMessage response)
    {
        string? setCookie = response.Headers.TryGetValues("Set-Cookie", out IEnumerable<string>? cookies)
            ? cookies.FirstOrDefault(value => value.StartsWith(RoomSessionCookie.Name + "=", StringComparison.Ordinal))
            : null;

        Assert.NotNull(setCookie);
        return $"{RoomSessionCookie.Name}={ExtractCookieValueFromHeader(setCookie)}";
    }

    private static string ExtractCookieValue(HttpResponseMessage response)
    {
        string? setCookie = response.Headers.TryGetValues("Set-Cookie", out IEnumerable<string>? cookies)
            ? cookies.FirstOrDefault(value => value.StartsWith(RoomSessionCookie.Name + "=", StringComparison.Ordinal))
            : null;

        Assert.NotNull(setCookie);
        return ExtractCookieValueFromHeader(setCookie);
    }

    private static string ExtractCookieValueFromHeader(string setCookieHeader)
    {
        int start = setCookieHeader.IndexOf('=') + 1;
        int end = setCookieHeader.IndexOf(';');
        if (end < 0)
        {
            end = setCookieHeader.Length;
        }

        return setCookieHeader[start..end];
    }

    private static string ExtractRoomCodeFromLocation(string? location)
    {
        Assert.NotNull(location);
        string[] parts = location.Split('/', StringSplitOptions.RemoveEmptyEntries);
        int roomIndex = Array.IndexOf(parts, "room");
        Assert.True(roomIndex >= 0 && roomIndex + 1 < parts.Length);
        return parts[roomIndex + 1];
    }

    private async Task<Guid> GetPlayerIdFromSessionAsync(string sessionIdValue)
    {
        ServiceCollection services = new();
        services.AddApplication();
        services.AddJojoRpgData(_fixture.ConnectionString);
        await using ServiceProvider provider = services.BuildServiceProvider();

        GetActiveSessionUseCase getSession = provider.GetRequiredService<GetActiveSessionUseCase>();
        Domain.Aggregates.RoomSession? session = await getSession.ExecuteAsync(Guid.Parse(sessionIdValue), CancellationToken.None);
        Assert.NotNull(session);
        Assert.NotNull(session.PlayerId);
        return session.PlayerId.Value;
    }
}
