using JojoRpg.Application.Accounts;
using JojoRpg.Application.Rooms;
using JojoRpg.Application.Sessions;
using JojoRpg.Application.Tests.Fakes;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Tests;

public class AccountUseCaseTests
{
    [Fact]
    public async Task RegisterAndLogin_UsesNormalizedEmail()
    {
        FakeAccountRepository accounts = new();
        FakeAccountPasswordHasher hasher = new();
        RegisterAccountUseCase register = new(accounts, hasher);
        LoginAccountUseCase login = new(accounts, hasher);

        Application.Common.UseCaseResult<AccountAuthResponse> registered = await register.ExecuteAsync(new RegisterAccountRequest
        {
            Email = "USER@Example.COM",
            Password = "password123",
            DisplayName = "User",
        }, CancellationToken.None);

        Application.Common.UseCaseResult<AccountAuthResponse> loggedIn = await login.ExecuteAsync(new LoginAccountRequest
        {
            Email = "user@example.com",
            Password = "password123",
        }, CancellationToken.None);

        Assert.True(registered.Success);
        Assert.True(loggedIn.Success);
        Assert.Equal(registered.Value!.AccountId, loggedIn.Value!.AccountId);
    }
}

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

        JoinRoomUseCase useCase = new(rooms, players, sessions, new FakeRoomCodeGenerator(), new FakeGmCodeHasher());
        Application.Common.UseCaseResult<JoinRoomResponse> result = await useCase.ExecuteAsync(new JoinRoomRequest
        {
            RoomCode = "ABC12345",
            DisplayName = "Alice",
            ExistingSessionId = oldSession
        }, CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(sessions.Sessions[oldSession].RevokedAt);
        Assert.True(result.Value!.IssuedNewPlayerCode);
        Assert.False(string.IsNullOrWhiteSpace(result.Value.PlayerCode));
    }

    [Fact]
    public async Task JoinRoom_ReusesPlayerWhenCodeMatches()
    {
        FakeRoomRepository rooms = new();
        FakeSessionRepository sessions = new();
        FakePlayerRepository players = new();
        FakeGmCodeHasher hasher = new();
        Guid roomId = Guid.NewGuid();
        Room room = new() { Id = roomId, RoomCode = "ABC12345", GmCodeHash = "x", Name = "T", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        await rooms.AddAsync(room, CancellationToken.None);

        Guid existingPlayerId = Guid.NewGuid();
        string playerCode = "PLAYERCODE1";
        await players.AddAsync(new Player
        {
            Id = existingPlayerId,
            RoomId = roomId,
            DisplayName = "Alice",
            PlayerCodeHash = hasher.Hash(playerCode),
            JoinedAt = DateTimeOffset.UtcNow,
            LastSeenAt = DateTimeOffset.UtcNow,
            Sheet = new CharacterSheetPayload { Id = existingPlayerId.ToString(), Name = "Alice" }
        }, CancellationToken.None);

        JoinRoomUseCase useCase = new(rooms, players, sessions, new FakeRoomCodeGenerator(), hasher);
        Application.Common.UseCaseResult<JoinRoomResponse> firstJoin = await useCase.ExecuteAsync(new JoinRoomRequest
        {
            RoomCode = "ABC12345",
            DisplayName = "Alice",
            PlayerCode = playerCode
        }, CancellationToken.None);

        Assert.True(firstJoin.Success);
        Assert.True(firstJoin.Value!.RejoinedExistingPlayer);
        Assert.Equal(existingPlayerId, firstJoin.Value.PlayerId);
        Assert.Equal(playerCode, firstJoin.Value.PlayerCode);
        Assert.False(firstJoin.Value.IssuedNewPlayerCode);
        Assert.Single(players.Players);
    }

    [Fact]
    public async Task JoinRoom_RejectsInvalidPlayerCode()
    {
        FakeRoomRepository rooms = new();
        FakeSessionRepository sessions = new();
        FakePlayerRepository players = new();
        Guid roomId = Guid.NewGuid();
        Room room = new() { Id = roomId, RoomCode = "ABC12345", GmCodeHash = "x", Name = "T", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        await rooms.AddAsync(room, CancellationToken.None);

        JoinRoomUseCase useCase = new(rooms, players, sessions, new FakeRoomCodeGenerator(), new FakeGmCodeHasher());
        Application.Common.UseCaseResult<JoinRoomResponse> result = await useCase.ExecuteAsync(new JoinRoomRequest
        {
            RoomCode = "ABC12345",
            DisplayName = "Alice",
            PlayerCode = "NOTAVALID1"
        }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Empty(players.Players);
    }

    [Fact]
    public async Task JoinRoom_RejoinsByAccountWithoutPlayerCode()
    {
        FakeRoomRepository rooms = new();
        FakeSessionRepository sessions = new();
        FakePlayerRepository players = new();
        Guid roomId = Guid.NewGuid();
        Guid accountId = Guid.NewGuid();
        Guid playerId = Guid.NewGuid();
        Room room = new() { Id = roomId, RoomCode = "ABC12345", GmCodeHash = "x", Name = "T", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        await rooms.AddAsync(room, CancellationToken.None);
        await players.AddAsync(new Player
        {
            Id = playerId,
            RoomId = roomId,
            AccountId = accountId,
            DisplayName = "Alice",
            JoinedAt = DateTimeOffset.UtcNow,
            LastSeenAt = DateTimeOffset.UtcNow,
        }, CancellationToken.None);

        JoinRoomUseCase useCase = new(rooms, players, sessions, new FakeRoomCodeGenerator(), new FakeGmCodeHasher());
        Application.Common.UseCaseResult<JoinRoomResponse> result = await useCase.ExecuteAsync(new JoinRoomRequest
        {
            RoomCode = "ABC12345",
            DisplayName = "Alice Phone",
            AccountId = accountId,
        }, CancellationToken.None);

        Assert.True(result.Success);
        Assert.True(result.Value!.RejoinedExistingPlayer);
        Assert.Equal(playerId, result.Value.PlayerId);
        Assert.Equal(accountId, sessions.Sessions[result.Value.SessionId].AccountId);
    }
}

public class ClaimUseCaseTests
{
    [Fact]
    public async Task ClaimPlayer_LinksPlayerAndIssuesAccountSession()
    {
        FakePlayerRepository players = new();
        FakeSessionRepository sessions = new();
        Guid accountId = Guid.NewGuid();
        Guid roomId = Guid.NewGuid();
        Guid playerId = Guid.NewGuid();
        Guid oldSessionId = Guid.NewGuid();
        await players.AddAsync(new Player
        {
            Id = playerId,
            RoomId = roomId,
            DisplayName = "Alice",
            JoinedAt = DateTimeOffset.UtcNow,
            LastSeenAt = DateTimeOffset.UtcNow,
        }, CancellationToken.None);
        await sessions.AddAsync(new RoomSession
        {
            Id = oldSessionId,
            RoomId = roomId,
            PlayerId = playerId,
            Role = Domain.Enums.SessionRole.Player,
            CreatedAt = DateTimeOffset.UtcNow,
        }, CancellationToken.None);

        ClaimPlayerUseCase useCase = new(players, sessions);
        Application.Common.UseCaseResult<ClaimSessionResponse> result = await useCase.ExecuteAsync(new ClaimPlayerRequest
        {
            AccountId = accountId,
            RoomId = roomId,
            PlayerId = playerId,
            ExistingSessionId = oldSessionId,
        }, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(accountId, players.Players[playerId].AccountId);
        Assert.NotNull(sessions.Sessions[oldSessionId].RevokedAt);
        Assert.Equal(accountId, sessions.Sessions[result.Value!.SessionId].AccountId);
    }

    [Fact]
    public async Task ClaimRoom_LinksRoomAndIssuesGmSession()
    {
        FakeRoomRepository rooms = new();
        FakeSessionRepository sessions = new();
        Guid accountId = Guid.NewGuid();
        Guid roomId = Guid.NewGuid();
        Room room = new() { Id = roomId, RoomCode = "ABC12345", GmCodeHash = "x", Name = "T", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        await rooms.AddAsync(room, CancellationToken.None);

        ClaimRoomUseCase useCase = new(rooms, sessions);
        Application.Common.UseCaseResult<ClaimSessionResponse> result = await useCase.ExecuteAsync(new ClaimRoomRequest
        {
            AccountId = accountId,
            RoomId = roomId,
        }, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(accountId, rooms.RoomsById[roomId].OwnerAccountId);
        Assert.Equal(accountId, sessions.Sessions[result.Value!.SessionId].AccountId);
        Assert.Equal(Domain.Enums.SessionRole.Gm, sessions.Sessions[result.Value.SessionId].Role);
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

    [Fact]
    public async Task MovePlayerMapTokens_UpdatesOnlyPlayerTokens()
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
            UpdatedAt = DateTimeOffset.UtcNow,
            SharedMap = new SharedMapPayload
            {
                MapName = "Arena",
                Tokens = new List<MapTokenPayload>
                {
                    new() { Id = "p1", Type = "player", Col = 1, Row = 1 },
                    new() { Id = "n1", Type = "npc", Col = 2, Row = 2 },
                },
            },
        };
        await rooms.AddAsync(room, CancellationToken.None);

        MovePlayerMapTokensUseCase useCase = new(rooms, notifier);
        MovePlayerMapTokensRequest request = new()
        {
            Moves = new List<PlayerTokenMovePayload>
            {
                new() { Id = "p1", Col = 5, Row = 6 },
                new() { Id = "n1", Col = 9, Row = 9 },
            },
        };

        Application.Common.UseCaseResult result = await useCase.ExecuteAsync(roomId, request, CancellationToken.None);

        Assert.True(result.Success);
        MapTokenPayload player = rooms.RoomsById[roomId].SharedMap!.Tokens.Single(token => token.Id == "p1");
        MapTokenPayload npc = rooms.RoomsById[roomId].SharedMap!.Tokens.Single(token => token.Id == "n1");
        Assert.Equal(5, player.Col);
        Assert.Equal(6, player.Row);
        Assert.Equal(2, npc.Col);
        Assert.Equal(2, npc.Row);
        Assert.Single(notifier.Maps);
    }
}
