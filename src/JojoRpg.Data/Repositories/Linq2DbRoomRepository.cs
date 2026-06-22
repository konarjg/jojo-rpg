using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Data.Generated;
using JojoRpg.Data.Serialization;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Enums;
using JojoRpg.Domain.Payloads;
using LinqToDB;
using LinqToDB.Async;
using LinqToDB.Data;

namespace JojoRpg.Data.Repositories;

public sealed class Linq2DbRoomRepository : IRoomRepository
{
    private readonly JojoDataConnection _db;

    public Linq2DbRoomRepository(JojoDataConnection db)
    {
        _db = db;
    }

    public async Task<Room?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        RoomEntity? roomRow = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (roomRow is null)
        {
            return null;
        }

        return await MapRoomAsync(roomRow, cancellationToken);
    }

    public async Task<Room?> GetByCodeAsync(string roomCode, CancellationToken cancellationToken)
    {
        RoomEntity? roomRow = await _db.Rooms.FirstOrDefaultAsync(r => r.RoomCode == roomCode, cancellationToken);
        if (roomRow is null)
        {
            return null;
        }

        return await MapRoomAsync(roomRow, cancellationToken);
    }

    public async Task AddAsync(Room room, CancellationToken cancellationToken)
    {
        await using DataConnectionTransaction transaction = await _db.BeginTransactionAsync(cancellationToken);
        await InsertRoomGraphAsync(room, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task SaveAsync(Room room, CancellationToken cancellationToken)
    {
        await using DataConnectionTransaction transaction = await _db.BeginTransactionAsync(cancellationToken);
        await _db.Rooms
            .Where(r => r.Id == room.Id)
            .Set(r => r.Name, room.Name)
            .Set(r => r.UpdatedAt, room.UpdatedAt)
            .UpdateAsync(cancellationToken);

        string workspaceJson = JsonPayloadSerializer.Serialize(room.Workspace);
        int workspaceCount = await _db.GmWorkspaces
            .Where(w => w.RoomId == room.Id)
            .Set(w => w.SchemaVersion, room.WorkspaceSchemaVersion)
            .Set(w => w.PayloadJson, workspaceJson)
            .Set(w => w.UpdatedAt, room.UpdatedAt)
            .UpdateAsync(cancellationToken);

        if (workspaceCount == 0)
        {
            await _db.InsertAsync(new GmWorkspaceEntity
            {
                RoomId = room.Id,
                SchemaVersion = room.WorkspaceSchemaVersion,
                PayloadJson = workspaceJson,
                UpdatedAt = room.UpdatedAt
            }, token: cancellationToken);
        }

        string? sharedMapJson = room.SharedMap is null ? null : JsonPayloadSerializer.Serialize(room.SharedMap);
        string? lastRollJson = room.LastRoll is null ? null : JsonPayloadSerializer.Serialize(room.LastRoll);

        int sharedCount = await _db.SharedCampaignViews
            .Where(v => v.RoomId == room.Id)
            .Set(v => v.SharedMapJson, sharedMapJson)
            .Set(v => v.LastRollJson, lastRollJson)
            .Set(v => v.MapSharedAt, room.MapSharedAt)
            .Set(v => v.UpdatedAt, room.UpdatedAt)
            .UpdateAsync(cancellationToken);

        if (sharedCount == 0)
        {
            await _db.InsertAsync(new SharedCampaignViewEntity
            {
                RoomId = room.Id,
                SharedMapJson = sharedMapJson,
                LastRollJson = lastRollJson,
                MapSharedAt = room.MapSharedAt,
                UpdatedAt = room.UpdatedAt
            }, token: cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    private async Task InsertRoomGraphAsync(Room room, CancellationToken cancellationToken)
    {
        await _db.InsertAsync(new RoomEntity
        {
            Id = room.Id,
            RoomCode = room.RoomCode,
            GmCodeHash = room.GmCodeHash,
            Name = room.Name,
            CreatedAt = room.CreatedAt,
            UpdatedAt = room.UpdatedAt
        }, token: cancellationToken);

        await _db.InsertAsync(new GmWorkspaceEntity
        {
            RoomId = room.Id,
            SchemaVersion = room.WorkspaceSchemaVersion,
            PayloadJson = JsonPayloadSerializer.Serialize(room.Workspace),
            UpdatedAt = room.UpdatedAt
        }, token: cancellationToken);

        await _db.InsertAsync(new SharedCampaignViewEntity
        {
            RoomId = room.Id,
            SharedMapJson = room.SharedMap is null ? null : JsonPayloadSerializer.Serialize(room.SharedMap),
            LastRollJson = room.LastRoll is null ? null : JsonPayloadSerializer.Serialize(room.LastRoll),
            MapSharedAt = room.MapSharedAt,
            UpdatedAt = room.UpdatedAt
        }, token: cancellationToken);
    }

    private async Task<Room> MapRoomAsync(RoomEntity roomRow, CancellationToken cancellationToken)
    {
        GmWorkspaceEntity? workspaceRow = await _db.GmWorkspaces.FirstOrDefaultAsync(w => w.RoomId == roomRow.Id, cancellationToken);
        SharedCampaignViewEntity? sharedRow = await _db.SharedCampaignViews.FirstOrDefaultAsync(v => v.RoomId == roomRow.Id, cancellationToken);

        GmWorkspacePayload workspace = workspaceRow is null
            ? new GmWorkspacePayload()
            : JsonPayloadSerializer.Deserialize<GmWorkspacePayload>(workspaceRow.PayloadJson);

        return new Room
        {
            Id = roomRow.Id,
            RoomCode = roomRow.RoomCode,
            GmCodeHash = roomRow.GmCodeHash,
            Name = roomRow.Name,
            CreatedAt = roomRow.CreatedAt,
            UpdatedAt = roomRow.UpdatedAt,
            WorkspaceSchemaVersion = workspaceRow?.SchemaVersion ?? workspace.SchemaVersion,
            Workspace = workspace,
            SharedMap = JsonPayloadSerializer.DeserializeOrNull<SharedMapPayload>(sharedRow?.SharedMapJson),
            LastRoll = JsonPayloadSerializer.DeserializeOrNull<RollPayload>(sharedRow?.LastRollJson),
            MapSharedAt = sharedRow?.MapSharedAt
        };
    }
}
