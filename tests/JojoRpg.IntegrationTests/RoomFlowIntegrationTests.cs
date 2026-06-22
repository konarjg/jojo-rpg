using System.Net;
using System.Net.Http.Json;
using JojoRpg.Application;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Application.Rooms;
using JojoRpg.Data;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;
using JojoRpg.Web.Auth;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

namespace JojoRpg.IntegrationTests;

[Collection("Sql")]
public sealed class RoomRepositoryIntegrationTests
{
    private readonly SqlTestFixture _fixture;

    public RoomRepositoryIntegrationTests(SqlTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CreateRoom_PersistsRoomAndWorkspace()
    {
        ServiceCollection services = new();
        services.AddApplication();
        services.AddJojoRpgData(_fixture.ConnectionString);
        await using ServiceProvider provider = services.BuildServiceProvider();

        CreateRoomUseCase createRoom = provider.GetRequiredService<CreateRoomUseCase>();
        Application.Common.UseCaseResult<CreateRoomResponse> created = await createRoom.ExecuteAsync(
            new CreateRoomRequest { Name = "Integration Room" },
            CancellationToken.None);

        Assert.True(created.Success);
        Assert.NotNull(created.Value);

        IRoomRepository rooms = provider.GetRequiredService<IRoomRepository>();
        Room? room = await rooms.GetByIdAsync(created.Value.RoomId, CancellationToken.None);

        Assert.NotNull(room);
        Assert.Equal("Integration Room", room.Name);
        Assert.Equal(2, room.WorkspaceSchemaVersion);
    }

    [Fact]
    public async Task SaveGmWorkspace_RoundTripsPayload()
    {
        ServiceCollection services = new();
        services.AddApplication();
        services.AddJojoRpgData(_fixture.ConnectionString);
        await using ServiceProvider provider = services.BuildServiceProvider();

        CreateRoomUseCase createRoom = provider.GetRequiredService<CreateRoomUseCase>();
        Application.Common.UseCaseResult<CreateRoomResponse> created = await createRoom.ExecuteAsync(
            new CreateRoomRequest { Name = "Workspace Room" },
            CancellationToken.None);

        Assert.True(created.Success);
        Assert.NotNull(created.Value);

        SaveGmWorkspaceUseCase saveWorkspace = provider.GetRequiredService<SaveGmWorkspaceUseCase>();
        GmWorkspacePayload payload = new()
        {
            SchemaVersion = 2,
            ActiveSessionId = "sess_test",
            AutoOpenPlayer = true
        };

        Application.Common.UseCaseResult saveResult = await saveWorkspace.ExecuteAsync(
            created.Value.RoomId,
            payload,
            CancellationToken.None);

        Assert.True(saveResult.Success);

        GetGmWorkspaceUseCase getWorkspace = provider.GetRequiredService<GetGmWorkspaceUseCase>();
        GmWorkspacePayload? loaded = await getWorkspace.ExecuteAsync(created.Value.RoomId, CancellationToken.None);

        Assert.NotNull(loaded);
        Assert.Equal("sess_test", loaded.ActiveSessionId);
        Assert.True(loaded.AutoOpenPlayer);
    }
}

[Collection("Sql")]
public sealed class CampaignHubIntegrationTests : IAsyncLifetime
{
    private readonly SqlTestFixture _fixture;
    private WebApplicationFactory<Program>? _factory;

    public CampaignHubIntegrationTests(SqlTestFixture fixture)
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
    public async Task ShareMap_EmitsMapSharedToConnectedClient()
    {
        Assert.NotNull(_factory);

        ServiceCollection services = new();
        services.AddApplication();
        services.AddJojoRpgData(_fixture.ConnectionString);
        await using ServiceProvider provider = services.BuildServiceProvider();

        CreateRoomUseCase createRoom = provider.GetRequiredService<CreateRoomUseCase>();
        Application.Common.UseCaseResult<CreateRoomResponse> created = await createRoom.ExecuteAsync(
            new CreateRoomRequest(),
            CancellationToken.None);

        Assert.True(created.Success);
        Assert.NotNull(created.Value);

        HttpClient client = _factory.CreateClient();
        SharedMapPayload? received = null;
        ManualResetEventSlim signal = new(false);

        HubConnection hubConnection = new HubConnectionBuilder()
            .WithUrl(new Uri(client.BaseAddress!, "hubs/campaign"), options =>
            {
                options.HttpMessageHandlerFactory = _ => _factory!.Server.CreateHandler();
                options.Cookies.Add(new Cookie(RoomSessionCookie.Name, created.Value.SessionId.ToString()));
            })
            .Build();

        hubConnection.On<SharedMapPayload>("MapShared", map =>
        {
            received = map;
            signal.Set();
        });

        await hubConnection.StartAsync();

        SharedMapPayload mapPayload = new()
        {
            MapName = "Arena",
            Tokens = new List<MapTokenPayload>
            {
                new() { Id = "t1", Label = "Hero", X = 1, Y = 2, Color = "#fff" }
            }
        };

        HttpRequestMessage request = new(HttpMethod.Post, $"/api/rooms/{created.Value.RoomId}/share-map")
        {
            Content = JsonContent.Create(mapPayload)
        };
        request.Headers.Add("Cookie", $"{RoomSessionCookie.Name}={created.Value.SessionId}");

        HttpResponseMessage response = await client.SendAsync(request);
        Assert.True(response.IsSuccessStatusCode);

        Assert.True(signal.Wait(TimeSpan.FromSeconds(10)), "MapShared event was not received.");
        Assert.NotNull(received);
        Assert.Equal("Arena", received.MapName);
        Assert.Single(received.Tokens);

        await hubConnection.DisposeAsync();
    }
}
