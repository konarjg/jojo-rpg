using JojoRpg.Application.Rooms;
using JojoRpg.Application.Sessions;
using JojoRpg.Application.Tests.Fakes;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Tests;

public class CreateRoomUseCaseTests
{
    [Fact]
    public async Task CreateRoom_ReturnsCodesAndSession()
    {
        FakeRoomRepository rooms = new();
        FakeSessionRepository sessions = new();
        CreateRoomUseCase useCase = new(rooms, sessions, new FakeRoomCodeGenerator(), new FakeGmCodeHasher());

        Application.Common.UseCaseResult<CreateRoomResponse> result = await useCase.ExecuteAsync(new CreateRoomRequest { Name = "Test" }, CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(result.Value);
        Assert.Equal("ROOM0001", result.Value.RoomCode);
        Assert.Single(sessions.Sessions);
    }
}

public class JoinRoomUseCaseTests
{
    [Fact]
    public async Task JoinRoom_RevokesPriorSession()
    {
        FakeRoomRepository rooms = new();
        FakeSessionRepository sessions = new();
        FakePlayerRepository players = new();
        Guid roomId = Guid.NewGuid();
        Room room = new() { Id = roomId, RoomCode = "ABC12345", GmCodeHash = "x", Name = "T", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        await rooms.AddAsync(room, CancellationToken.None);

        Guid oldSession = Guid.NewGuid();
        await sessions.AddAsync(new Domain.Aggregates.RoomSession
        {
            Id = oldSession,
            RoomId = roomId,
            Role = Domain.Enums.SessionRole.Player,
            CreatedAt = DateTimeOffset.UtcNow
        }, CancellationToken.None);

        JoinRoomUseCase useCase = new(rooms, players, sessions);
        Application.Common.UseCaseResult<JoinRoomResponse> result = await useCase.ExecuteAsync(new JoinRoomRequest
        {
            RoomCode = "ABC12345",
            DisplayName = "Alice",
            ExistingSessionId = oldSession
        }, CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(sessions.Sessions[oldSession].RevokedAt);
    }
}

public class ShareMapUseCaseTests
{
    [Fact]
    public async Task ShareMap_PersistsBeforeNotify()
    {
        FakeRoomRepository rooms = new();
        FakeCampaignNotifier notifier = new();
        Guid roomId = Guid.NewGuid();
        Room room = new()
        {
            Id = roomId,
            RoomCode = "R1",
            GmCodeHash = "h",
            Name = "T",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        await rooms.AddAsync(room, CancellationToken.None);

        ShareMapUseCase useCase = new(rooms, notifier);
        SharedMapPayload map = new() { MapName = "Arena", Tokens = new List<MapTokenPayload>() };

        Application.Common.UseCaseResult result = await useCase.ExecuteAsync(roomId, map, CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(rooms.RoomsById[roomId].SharedMap);
        Assert.Single(notifier.Maps);
    }
}
