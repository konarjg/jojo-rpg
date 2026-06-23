using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Application.Ports.Security;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Enums;
using JojoRpg.Domain.Payloads;
using System.Text.Json;

namespace JojoRpg.Application.Sessions;

public sealed class JoinRoomRequest
{
    public string RoomCode { get; init; } = string.Empty;

    public string? DisplayName { get; init; }

    public string? PlayerCode { get; init; }

    public Guid? ExistingSessionId { get; init; }
}

public sealed class JoinRoomResponse
{
    public Guid RoomId { get; init; }

    public Guid PlayerId { get; init; }

    public Guid SessionId { get; init; }

    public string RoomCode { get; init; } = string.Empty;

    public string PlayerCode { get; init; } = string.Empty;

    public bool RejoinedExistingPlayer { get; init; }

    public bool IssuedNewPlayerCode { get; init; }
}

public sealed class JoinRoomUseCase
{
    private const int PlayerCodeLength = 10;

    private readonly IRoomRepository _roomRepository;
    private readonly IPlayerRepository _playerRepository;
    private readonly ISessionRepository _sessionRepository;
    private readonly IRoomCodeGenerator _roomCodeGenerator;
    private readonly IGmCodeHasher _codeHasher;

    public JoinRoomUseCase(
        IRoomRepository roomRepository,
        IPlayerRepository playerRepository,
        ISessionRepository sessionRepository,
        IRoomCodeGenerator roomCodeGenerator,
        IGmCodeHasher codeHasher)
    {
        _roomRepository = roomRepository;
        _playerRepository = playerRepository;
        _sessionRepository = sessionRepository;
        _roomCodeGenerator = roomCodeGenerator;
        _codeHasher = codeHasher;
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
        string displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? "Player" : request.DisplayName.Trim();
        string? normalizedPlayerCode = NormalizePlayerCode(request.PlayerCode);

        Guid playerId;
        string playerCodeForCookie;
        bool rejoined = false;
        bool issuedNewCode = false;

        if (!string.IsNullOrEmpty(normalizedPlayerCode))
        {
            string playerCodeHash = _codeHasher.Hash(normalizedPlayerCode);
            Player? existingPlayer = await _playerRepository.GetByRoomAndPlayerCodeHashAsync(room.Id, playerCodeHash, cancellationToken);
            if (existingPlayer is null)
            {
                return UseCaseResult<JoinRoomResponse>.Fail("Invalid player code for this room.");
            }

            playerId = existingPlayer.Id;
            playerCodeForCookie = normalizedPlayerCode;
            rejoined = true;
            existingPlayer.DisplayName = displayName;
            existingPlayer.LastSeenAt = now;
            await _playerRepository.SaveAsync(existingPlayer, cancellationToken);
        }
        else
        {
            playerId = Guid.NewGuid();
            playerCodeForCookie = _roomCodeGenerator.GeneratePlayerCode(PlayerCodeLength);
            string playerCodeHash = _codeHasher.Hash(playerCodeForCookie);
            issuedNewCode = true;

            Player player = new()
            {
                Id = playerId,
                RoomId = room.Id,
                DisplayName = displayName,
                JoinedAt = now,
                LastSeenAt = now,
                PlayerCodeHash = playerCodeHash,
                SheetSchemaVersion = 2,
                Sheet = new CharacterSheetPayload
                {
                    Id = playerId.ToString(),
                    Name = displayName,
                    Data = JsonSerializer.SerializeToElement(new { id = playerId.ToString(), name = displayName })
                },
                StickyBoard = new StickyBoardPayload()
            };

            await _playerRepository.AddAsync(player, cancellationToken);
        }

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
            RoomCode = room.RoomCode,
            PlayerCode = playerCodeForCookie,
            RejoinedExistingPlayer = rejoined,
            IssuedNewPlayerCode = issuedNewCode
        };

        return UseCaseResult<JoinRoomResponse>.Ok(response);
    }

    private static string? NormalizePlayerCode(string? playerCode)
    {
        if (string.IsNullOrWhiteSpace(playerCode))
        {
            return null;
        }

        return playerCode.Trim().ToUpperInvariant();
    }
}
