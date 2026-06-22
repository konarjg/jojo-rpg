using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Enums;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Sessions;

public sealed class JoinRoomRequest
{
    public string RoomCode { get; init; } = string.Empty;

    public string? DisplayName { get; init; }

    public Guid? ExistingSessionId { get; init; }
}

public sealed class JoinRoomResponse
{
    public Guid RoomId { get; init; }

    public Guid PlayerId { get; init; }

    public Guid SessionId { get; init; }

    public string RoomCode { get; init; } = string.Empty;
}

public sealed class JoinRoomUseCase
{
    private readonly IRoomRepository _roomRepository;
    private readonly IPlayerRepository _playerRepository;
    private readonly ISessionRepository _sessionRepository;

    public JoinRoomUseCase(
        IRoomRepository roomRepository,
        IPlayerRepository playerRepository,
        ISessionRepository sessionRepository)
    {
        _roomRepository = roomRepository;
        _playerRepository = playerRepository;
        _sessionRepository = sessionRepository;
    }

    public async Task<UseCaseResult<JoinRoomResponse>> ExecuteAsync(JoinRoomRequest request, CancellationToken cancellationToken)
    {
        Room? room = await _roomRepository.GetByCodeAsync(request.RoomCode.Trim().ToUpperInvariant(), cancellationToken);
        if (room is null)
        {
            return UseCaseResult<JoinRoomResponse>.Fail("Room not found.");
        }

        if (request.ExistingSessionId is Guid existingSessionId)
        {
            await _sessionRepository.RevokeAsync(existingSessionId, cancellationToken);
        }

        DateTimeOffset now = DateTimeOffset.UtcNow;
        Guid playerId = Guid.NewGuid();
        string displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? "Player" : request.DisplayName.Trim();

        Player player = new()
        {
            Id = playerId,
            RoomId = room.Id,
            DisplayName = displayName,
            JoinedAt = now,
            LastSeenAt = now,
            SheetSchemaVersion = 2,
            Sheet = new CharacterSheetPayload { Id = playerId.ToString(), Name = displayName },
            StickyBoard = new StickyBoardPayload()
        };

        await _playerRepository.AddAsync(player, cancellationToken);

        Guid sessionId = Guid.NewGuid();
        RoomSession session = new()
        {
            Id = sessionId,
            RoomId = room.Id,
            Role = SessionRole.Player,
            PlayerId = playerId,
            CreatedAt = now
        };

        await _sessionRepository.AddAsync(session, cancellationToken);

        JoinRoomResponse response = new()
        {
            RoomId = room.Id,
            PlayerId = playerId,
            SessionId = sessionId,
            RoomCode = room.RoomCode
        };

        return UseCaseResult<JoinRoomResponse>.Ok(response);
    }
}
