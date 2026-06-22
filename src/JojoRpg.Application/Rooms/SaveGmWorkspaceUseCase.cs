using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Rooms;

public sealed class SaveGmWorkspaceUseCase
{
    private readonly IRoomRepository _roomRepository;

    public SaveGmWorkspaceUseCase(IRoomRepository roomRepository)
    {
        _roomRepository = roomRepository;
    }

    public async Task<UseCaseResult> ExecuteAsync(Guid roomId, GmWorkspacePayload workspace, CancellationToken cancellationToken)
    {
        Room? room = await _roomRepository.GetByIdAsync(roomId, cancellationToken);
        if (room is null)
        {
            return UseCaseResult.Fail("Room not found.");
        }

        room.Workspace = workspace.WithDefaults();
        room.WorkspaceSchemaVersion = workspace.SchemaVersion;
        room.UpdatedAt = DateTimeOffset.UtcNow;
        await _roomRepository.SaveAsync(room, cancellationToken);
        return UseCaseResult.Ok();
    }
}
