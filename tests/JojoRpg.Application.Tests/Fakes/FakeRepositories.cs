using JojoRpg.Application.Rooms;
using JojoRpg.Application.Ports.Notifications;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Application.Ports.Security;
using JojoRpg.Application.Sessions;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Enums;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Tests.Fakes;

public sealed class FakeRoomRepository : IRoomRepository
{
    public Dictionary<Guid, Room> RoomsById { get; } = new();
    public Dictionary<string, Room> RoomsByCode { get; } = new(StringComparer.OrdinalIgnoreCase);

    public Task<Room?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        RoomsById.TryGetValue(id, out Room? room);
        return Task.FromResult(room);
    }

    public Task<Room?> GetByCodeAsync(string roomCode, CancellationToken cancellationToken)
    {
        RoomsByCode.TryGetValue(roomCode, out Room? room);
        return Task.FromResult(room);
    }

    public Task AddAsync(Room room, CancellationToken cancellationToken)
    {
        RoomsById[room.Id] = room;
        RoomsByCode[room.RoomCode] = room;
        return Task.CompletedTask;
    }

    public Task SaveAsync(Room room, CancellationToken cancellationToken)
    {
        RoomsById[room.Id] = room;
        RoomsByCode[room.RoomCode] = room;
        return Task.CompletedTask;
    }
}

public sealed class FakeSessionRepository : ISessionRepository
{
    public Dictionary<Guid, RoomSession> Sessions { get; } = new();

    public Task<RoomSession?> GetActiveAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        if (Sessions.TryGetValue(sessionId, out RoomSession? session) && session.RevokedAt is null)
        {
            return Task.FromResult<RoomSession?>(session);
        }

        return Task.FromResult<RoomSession?>(null);
    }

    public Task AddAsync(RoomSession session, CancellationToken cancellationToken)
    {
        Sessions[session.Id] = session;
        return Task.CompletedTask;
    }

    public Task RevokeAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        if (Sessions.TryGetValue(sessionId, out RoomSession? session))
        {
            session.RevokedAt = DateTimeOffset.UtcNow;
        }

        return Task.CompletedTask;
    }

    public Task TouchAsync(Guid sessionId, CancellationToken cancellationToken) => Task.CompletedTask;
}

public sealed class FakePlayerRepository : IPlayerRepository
{
    public Dictionary<Guid, Player> Players { get; } = new();

    public Task<Player?> GetAsync(Guid playerId, CancellationToken cancellationToken)
    {
        Players.TryGetValue(playerId, out Player? player);
        return Task.FromResult(player);
    }

    public Task<IReadOnlyList<Player>> ListByRoomAsync(Guid roomId, CancellationToken cancellationToken)
    {
        IReadOnlyList<Player> list = Players.Values.Where(p => p.RoomId == roomId).ToList();
        return Task.FromResult(list);
    }

    public Task<Player?> GetByRoomAndPlayerCodeHashAsync(Guid roomId, string playerCodeHash, CancellationToken cancellationToken)
    {
        Player? player = Players.Values.FirstOrDefault(p =>
            p.RoomId == roomId
            && p.PlayerCodeHash is not null
            && string.Equals(p.PlayerCodeHash, playerCodeHash, StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(player);
    }

    public Task AddAsync(Player player, CancellationToken cancellationToken)
    {
        Players[player.Id] = player;
        return Task.CompletedTask;
    }

    public Task SaveAsync(Player player, CancellationToken cancellationToken)
    {
        Players[player.Id] = player;
        return Task.CompletedTask;
    }
}

public sealed class FakeCampaignNotifier : ICampaignNotifier
{
    public List<(Guid RoomId, SharedMapPayload Map)> Maps { get; } = new();

    public Task MapSharedAsync(Guid roomId, SharedMapPayload map, CancellationToken cancellationToken)
    {
        Maps.Add((roomId, map));
        return Task.CompletedTask;
    }

    public List<Guid> StoppedRooms { get; } = new();

    public Task MapSharingStoppedAsync(Guid roomId, CancellationToken cancellationToken)
    {
        StoppedRooms.Add(roomId);
        return Task.CompletedTask;
    }

    public Task RollBroadcastAsync(Guid roomId, RollPayload roll, CancellationToken cancellationToken) => Task.CompletedTask;

    public Task PlayerSheetChangedAsync(Guid roomId, Guid playerId, string displayName, CancellationToken cancellationToken) => Task.CompletedTask;
}

public sealed class FakeGmCodeHasher : IGmCodeHasher
{
    public string Hash(string gmCode) => "hash-" + gmCode;

    public bool Verify(string gmCode, string hash) => hash == Hash(gmCode);
}

public sealed class FakeRoomCodeGenerator : IRoomCodeGenerator
{
    public int Counter { get; set; }

    public string GenerateRoomCode(int length) => "ROOM" + (++Counter).ToString("D4");

    public string GenerateGmCode(int length) => "GM" + new string('X', length - 2);

    public string GeneratePlayerCode(int length) => "PL" + (++Counter).ToString("D6");
}
