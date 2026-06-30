using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Application.Ports.Security;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Enums;

namespace JojoRpg.Application.Sessions;

public sealed class AuthenticateGmRequest
{
    public string RoomCode { get; init; } = string.Empty;

    public string GmCode { get; init; } = string.Empty;

    public Guid? AccountId { get; init; }

    public Guid? ExistingSessionId { get; init; }
}

public sealed class AuthenticateGmResponse
{
    public Guid SessionId { get; init; }

    public Guid RoomId { get; init; }
}

public sealed class AuthenticateGmUseCase
{
    private readonly IRoomRepository _roomRepository;
    private readonly ISessionRepository _sessionRepository;
    private readonly IGmCodeHasher _gmCodeHasher;

    public AuthenticateGmUseCase(
        IRoomRepository roomRepository,
        ISessionRepository sessionRepository,
        IGmCodeHasher gmCodeHasher)
    {
        _roomRepository = roomRepository;
        _sessionRepository = sessionRepository;
        _gmCodeHasher = gmCodeHasher;
    }

    public async Task<UseCaseResult<AuthenticateGmResponse>> ExecuteAsync(AuthenticateGmRequest request, CancellationToken cancellationToken)
    {
        Room? room = await _roomRepository.GetByCodeAsync(request.RoomCode.Trim().ToUpperInvariant(), cancellationToken);
        if (room is null)
        {
            return UseCaseResult<AuthenticateGmResponse>.Fail("Room not found.");
        }

        bool accountOwnsRoom = request.AccountId is Guid accountId && room.OwnerAccountId == accountId;
        if (!accountOwnsRoom && !_gmCodeHasher.Verify(request.GmCode, room.GmCodeHash))
        {
            return UseCaseResult<AuthenticateGmResponse>.Fail("Invalid GM code.");
        }

        if (request.ExistingSessionId is Guid existingSessionId)
        {
            await _sessionRepository.RevokeAsync(existingSessionId, cancellationToken);
        }

        Guid sessionId = Guid.NewGuid();
        RoomSession session = new()
        {
            Id = sessionId,
            RoomId = room.Id,
            Role = SessionRole.Gm,
            AccountId = request.AccountId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await _sessionRepository.AddAsync(session, cancellationToken);

        AuthenticateGmResponse response = new()
        {
            SessionId = sessionId,
            RoomId = room.Id
        };

        return UseCaseResult<AuthenticateGmResponse>.Ok(response);
    }
}
