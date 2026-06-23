using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Notifications;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Rooms;

public sealed class MovePlayerMapTokensUseCase
{
    private readonly IRoomRepository _roomRepository;
    private readonly ICampaignNotifier _campaignNotifier;

    public MovePlayerMapTokensUseCase(IRoomRepository roomRepository, ICampaignNotifier campaignNotifier)
    {
        _roomRepository = roomRepository;
        _campaignNotifier = campaignNotifier;
    }

    public async Task<UseCaseResult> ExecuteAsync(Guid roomId, MovePlayerMapTokensRequest request, CancellationToken cancellationToken)
    {
        Room? room = await _roomRepository.GetByIdAsync(roomId, cancellationToken);
        if (room is null)
        {
            return UseCaseResult.Fail("Room not found.");
        }

        if (room.SharedMap is null)
        {
            return UseCaseResult.Fail("No shared map.");
        }

        if (request.Moves.Count == 0)
        {
            return UseCaseResult.Ok();
        }

        Dictionary<string, PlayerTokenMovePayload> movesById = request.Moves
            .Where(move => !string.IsNullOrWhiteSpace(move.Id))
            .GroupBy(move => move.Id, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.Last(), StringComparer.Ordinal);

        List<MapTokenPayload> updatedTokens = new();
        bool anyChanged = false;

        foreach (MapTokenPayload token in room.SharedMap.Tokens)
        {
            if (!movesById.TryGetValue(token.Id, out PlayerTokenMovePayload? move))
            {
                updatedTokens.Add(token);
                continue;
            }

            if (!IsPlayerToken(token.Type))
            {
                updatedTokens.Add(token);
                continue;
            }

            int col = Math.Clamp(move.Col, 0, 23);
            int row = Math.Clamp(move.Row, 0, 17);
            updatedTokens.Add(token with { Col = col, Row = row });
            anyChanged = true;
        }

        if (!anyChanged)
        {
            return UseCaseResult.Fail("No player tokens were moved.");
        }

        SharedMapPayload updatedMap = room.SharedMap with { Tokens = updatedTokens };
        room.SharedMap = updatedMap;
        room.UpdatedAt = DateTimeOffset.UtcNow;
        await _roomRepository.SaveAsync(room, cancellationToken);
        await _campaignNotifier.MapSharedAsync(roomId, updatedMap, cancellationToken);
        return UseCaseResult.Ok();
    }

    private static bool IsPlayerToken(string type)
    {
        return string.Equals(type, "player", StringComparison.OrdinalIgnoreCase);
    }
}
