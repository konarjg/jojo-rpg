using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Rooms;

public sealed class GetGmWorkspaceUseCase
{
    private readonly IRoomRepository _roomRepository;

    public GetGmWorkspaceUseCase(IRoomRepository roomRepository)
    {
        _roomRepository = roomRepository;
    }

    public async Task<GmWorkspacePayload?> ExecuteAsync(Guid roomId, CancellationToken cancellationToken)
    {
        Room? room = await _roomRepository.GetByIdAsync(roomId, cancellationToken);
        return room?.Workspace;
    }
}
