using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Enums;

namespace JojoRpg.Application.Sessions;

public sealed class ClaimPlayerRequest
{
    public Guid AccountId { get; init; }

    public Guid RoomId { get; init; }

    public Guid PlayerId { get; init; }

    public Guid? ExistingSessionId { get; init; }
}

public sealed class ClaimRoomRequest
{
    public Guid AccountId { get; init; }

    public Guid RoomId { get; init; }

    public Guid? ExistingSessionId { get; init; }
}

public sealed class ClaimSessionResponse
{
    public Guid SessionId { get; init; }
}

public sealed class ClaimPlayerUseCase
{
    private readonly IPlayerRepository _playerRepository;
    private readonly ISessionRepository _sessionRepository;

    public ClaimPlayerUseCase(IPlayerRepository playerRepository, ISessionRepository sessionRepository)
    {
        _playerRepository = playerRepository;
        _sessionRepository = sessionRepository;
    }

    public async Task<UseCaseResult<ClaimSessionResponse>> ExecuteAsync(ClaimPlayerRequest request, CancellationToken cancellationToken)
    {
        Player? player = await _playerRepository.GetAsync(request.PlayerId, cancellationToken);
        if (player is null || player.RoomId != request.RoomId)
        {
            return UseCaseResult<ClaimSessionResponse>.Fail("Player not found.");
        }

        if (player.AccountId is Guid ownerAccountId && ownerAccountId != request.AccountId)
        {
            return UseCaseResult<ClaimSessionResponse>.Fail("This character is already claimed by another account.");
        }

        Player? existingAccountPlayer = await _playerRepository.GetByRoomAndAccountAsync(request.RoomId, request.AccountId, cancellationToken);
        if (existingAccountPlayer is not null && existingAccountPlayer.Id != player.Id)
        {
            return UseCaseResult<ClaimSessionResponse>.Fail("Your account already has a character in this room.");
        }

        DateTimeOffset now = DateTimeOffset.UtcNow;
        player.AccountId = request.AccountId;
        player.LastSeenAt = now;
        await _playerRepository.SaveAsync(player, cancellationToken);

        if (request.ExistingSessionId is Guid existingSessionId)
        {
            await _sessionRepository.RevokeAsync(existingSessionId, cancellationToken);
        }

        Guid sessionId = Guid.NewGuid();
        await _sessionRepository.AddAsync(new RoomSession
        {
            Id = sessionId,
            RoomId = request.RoomId,
            Role = SessionRole.Player,
            PlayerId = player.Id,
            AccountId = request.AccountId,
            CreatedAt = now,
        }, cancellationToken);

        return UseCaseResult<ClaimSessionResponse>.Ok(new ClaimSessionResponse { SessionId = sessionId });
    }
}

public sealed class ClaimRoomUseCase
{
    private readonly IRoomRepository _roomRepository;
    private readonly ISessionRepository _sessionRepository;

    public ClaimRoomUseCase(IRoomRepository roomRepository, ISessionRepository sessionRepository)
    {
        _roomRepository = roomRepository;
        _sessionRepository = sessionRepository;
    }

    public async Task<UseCaseResult<ClaimSessionResponse>> ExecuteAsync(ClaimRoomRequest request, CancellationToken cancellationToken)
    {
        Room? room = await _roomRepository.GetByIdAsync(request.RoomId, cancellationToken);
        if (room is null)
        {
            return UseCaseResult<ClaimSessionResponse>.Fail("Room not found.");
        }

        if (room.OwnerAccountId is Guid ownerAccountId && ownerAccountId != request.AccountId)
        {
            return UseCaseResult<ClaimSessionResponse>.Fail("This room is already claimed by another account.");
        }

        DateTimeOffset now = DateTimeOffset.UtcNow;
        room.OwnerAccountId = request.AccountId;
        room.UpdatedAt = now;
        await _roomRepository.SaveAsync(room, cancellationToken);

        if (request.ExistingSessionId is Guid existingSessionId)
        {
            await _sessionRepository.RevokeAsync(existingSessionId, cancellationToken);
        }

        Guid sessionId = Guid.NewGuid();
        await _sessionRepository.AddAsync(new RoomSession
        {
            Id = sessionId,
            RoomId = room.Id,
            Role = SessionRole.Gm,
            AccountId = request.AccountId,
            CreatedAt = now,
        }, cancellationToken);

        return UseCaseResult<ClaimSessionResponse>.Ok(new ClaimSessionResponse { SessionId = sessionId });
    }
}
