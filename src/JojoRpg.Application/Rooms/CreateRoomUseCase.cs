using System.Text.Json;
using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Application.Ports.Security;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Enums;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Rooms;

public sealed class CreateRoomRequest
{
    public string? Name { get; init; }

    public Guid? ExistingSessionId { get; init; }
}

public sealed class CreateRoomResponse
{
    public Guid RoomId { get; init; }

    public string RoomCode { get; init; } = string.Empty;

    public string GmCode { get; init; } = string.Empty;

    public Guid SessionId { get; init; }

    public string JoinUrl { get; init; } = string.Empty;
}

public sealed class CreateRoomUseCase
{
    private readonly IRoomRepository _roomRepository;
    private readonly ISessionRepository _sessionRepository;
    private readonly IRoomCodeGenerator _roomCodeGenerator;
    private readonly IGmCodeHasher _gmCodeHasher;

    public CreateRoomUseCase(
        IRoomRepository roomRepository,
        ISessionRepository sessionRepository,
        IRoomCodeGenerator roomCodeGenerator,
        IGmCodeHasher gmCodeHasher)
    {
        _roomRepository = roomRepository;
        _sessionRepository = sessionRepository;
        _roomCodeGenerator = roomCodeGenerator;
        _gmCodeHasher = gmCodeHasher;
    }

    public async Task<UseCaseResult<CreateRoomResponse>> ExecuteAsync(CreateRoomRequest request, CancellationToken cancellationToken)
    {
        if (request.ExistingSessionId is Guid existingSessionId)
        {
            await _sessionRepository.RevokeAsync(existingSessionId, cancellationToken);
        }

        string roomCode = _roomCodeGenerator.GenerateRoomCode(8);
        string gmCode = _roomCodeGenerator.GenerateGmCode(16);
        DateTimeOffset now = DateTimeOffset.UtcNow;
        Guid roomId = Guid.NewGuid();

        Room room = new()
        {
            Id = roomId,
            RoomCode = roomCode,
            GmCodeHash = _gmCodeHasher.Hash(gmCode),
            Name = string.IsNullOrWhiteSpace(request.Name) ? "Campaign" : request.Name.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
            WorkspaceSchemaVersion = 2,
            Workspace = new GmWorkspacePayload
            {
                SchemaVersion = 2,
                Npcs = JsonSerializer.SerializeToElement(Array.Empty<object>()),
                GlobalMaps = JsonSerializer.SerializeToElement(new { }),
                Snapshots = JsonSerializer.SerializeToElement(Array.Empty<object>()),
                Sessions = JsonSerializer.SerializeToElement(new { })
            }
        };

        await _roomRepository.AddAsync(room, cancellationToken);

        Guid sessionId = Guid.NewGuid();
        RoomSession session = new()
        {
            Id = sessionId,
            RoomId = roomId,
            Role = SessionRole.Gm,
            CreatedAt = now
        };

        await _sessionRepository.AddAsync(session, cancellationToken);

        CreateRoomResponse response = new()
        {
            RoomId = roomId,
            RoomCode = roomCode,
            GmCode = gmCode,
            SessionId = sessionId,
            JoinUrl = $"/room/{roomCode}/join"
        };

        return UseCaseResult<CreateRoomResponse>.Ok(response);
    }
}
