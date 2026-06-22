using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Data.Generated;
using JojoRpg.Data.Serialization;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;
using LinqToDB;
using LinqToDB.Async;
using LinqToDB.Data;

namespace JojoRpg.Data.Repositories;

public sealed class Linq2DbPlayerRepository : IPlayerRepository
{
    private readonly JojoDataConnection _db;

    public Linq2DbPlayerRepository(JojoDataConnection db)
    {
        _db = db;
    }

    public async Task<Player?> GetAsync(Guid playerId, CancellationToken cancellationToken)
    {
        PlayerEntity? playerRow = await _db.Players.FirstOrDefaultAsync(p => p.Id == playerId, cancellationToken);
        if (playerRow is null)
        {
            return null;
        }

        return await MapPlayerAsync(playerRow, cancellationToken);
    }

    public async Task<IReadOnlyList<Player>> ListByRoomAsync(Guid roomId, CancellationToken cancellationToken)
    {
        List<PlayerEntity> rows = await _db.Players.Where(p => p.RoomId == roomId).ToListAsync(cancellationToken);
        List<Player> players = new();
        foreach (PlayerEntity row in rows)
        {
            players.Add(await MapPlayerAsync(row, cancellationToken));
        }

        return players;
    }

    public async Task AddAsync(Player player, CancellationToken cancellationToken)
    {
        await using DataConnectionTransaction transaction = await _db.BeginTransactionAsync(cancellationToken);
        await InsertPlayerGraphAsync(player, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task SaveAsync(Player player, CancellationToken cancellationToken)
    {
        await using DataConnectionTransaction transaction = await _db.BeginTransactionAsync(cancellationToken);

        await _db.Players
            .Where(p => p.Id == player.Id)
            .Set(p => p.DisplayName, player.DisplayName)
            .Set(p => p.LastSeenAt, player.LastSeenAt)
            .UpdateAsync(cancellationToken);

        string sheetJson = JsonPayloadSerializer.Serialize(player.Sheet);
        int sheetCount = await _db.CharacterSheets
            .Where(s => s.PlayerId == player.Id)
            .Set(s => s.DisplayName, player.DisplayName)
            .Set(s => s.SchemaVersion, player.SheetSchemaVersion)
            .Set(s => s.PayloadJson, sheetJson)
            .Set(s => s.UpdatedAt, player.LastSeenAt)
            .UpdateAsync(cancellationToken);

        if (sheetCount == 0)
        {
            await _db.InsertAsync(new CharacterSheetEntity
            {
                Id = Guid.NewGuid(),
                RoomId = player.RoomId,
                PlayerId = player.Id,
                DisplayName = player.DisplayName,
                SchemaVersion = player.SheetSchemaVersion,
                PayloadJson = sheetJson,
                UpdatedAt = player.LastSeenAt
            }, token: cancellationToken);
        }

        string stickiesJson = JsonPayloadSerializer.Serialize(player.StickyBoard);
        int stickyCount = await _db.PlayerStickyBoards
            .Where(b => b.PlayerId == player.Id)
            .Set(b => b.StickiesJson, stickiesJson)
            .Set(b => b.UpdatedAt, player.LastSeenAt)
            .UpdateAsync(cancellationToken);

        if (stickyCount == 0)
        {
            await _db.InsertAsync(new PlayerStickyBoardEntity
            {
                PlayerId = player.Id,
                StickiesJson = stickiesJson,
                UpdatedAt = player.LastSeenAt
            }, token: cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    private async Task InsertPlayerGraphAsync(Player player, CancellationToken cancellationToken)
    {
        await _db.InsertAsync(new PlayerEntity
        {
            Id = player.Id,
            RoomId = player.RoomId,
            DisplayName = player.DisplayName,
            JoinedAt = player.JoinedAt,
            LastSeenAt = player.LastSeenAt
        }, token: cancellationToken);

        await _db.InsertAsync(new CharacterSheetEntity
        {
            Id = Guid.NewGuid(),
            RoomId = player.RoomId,
            PlayerId = player.Id,
            DisplayName = player.DisplayName,
            SchemaVersion = player.SheetSchemaVersion,
            PayloadJson = JsonPayloadSerializer.Serialize(player.Sheet),
            UpdatedAt = player.LastSeenAt
        }, token: cancellationToken);

        await _db.InsertAsync(new PlayerStickyBoardEntity
        {
            PlayerId = player.Id,
            StickiesJson = JsonPayloadSerializer.Serialize(player.StickyBoard),
            UpdatedAt = player.LastSeenAt
        }, token: cancellationToken);
    }

    private async Task<Player> MapPlayerAsync(PlayerEntity playerRow, CancellationToken cancellationToken)
    {
        CharacterSheetEntity? sheetRow = await _db.CharacterSheets.FirstOrDefaultAsync(s => s.PlayerId == playerRow.Id, cancellationToken);
        PlayerStickyBoardEntity? stickyRow = await _db.PlayerStickyBoards.FirstOrDefaultAsync(b => b.PlayerId == playerRow.Id, cancellationToken);

        CharacterSheetPayload sheet = sheetRow is null
            ? new CharacterSheetPayload { Id = playerRow.Id.ToString(), Name = playerRow.DisplayName }
            : JsonPayloadSerializer.Deserialize<CharacterSheetPayload>(sheetRow.PayloadJson);

        StickyBoardPayload stickies = stickyRow is null
            ? new StickyBoardPayload()
            : JsonPayloadSerializer.Deserialize<StickyBoardPayload>(stickyRow.StickiesJson);

        return new Player
        {
            Id = playerRow.Id,
            RoomId = playerRow.RoomId,
            DisplayName = playerRow.DisplayName,
            JoinedAt = playerRow.JoinedAt,
            LastSeenAt = playerRow.LastSeenAt,
            SheetSchemaVersion = sheetRow?.SchemaVersion ?? sheet.SchemaVersion,
            Sheet = sheet,
            StickyBoard = stickies
        };
    }
}
