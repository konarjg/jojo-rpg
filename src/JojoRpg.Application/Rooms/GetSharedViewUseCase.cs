using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Rooms;

public sealed class SharedViewDto
{
    public SharedMapPayload? SharedMap { get; init; }

    public RollPayload? LastRoll { get; init; }

    public DateTimeOffset? MapSharedAt { get; init; }
}

public sealed class GetSharedViewUseCase
{
    private readonly IRoomRepository _roomRepository;

    public GetSharedViewUseCase(IRoomRepository roomRepository)
    {
        _roomRepository = roomRepository;
    }

    public async Task<SharedViewDto?> ExecuteAsync(Guid roomId, CancellationToken cancellationToken)
    {
        Domain.Aggregates.Room? room = await _roomRepository.GetByIdAsync(roomId, cancellationToken);
        if (room is null)
        {
            return null;
        }

        return new SharedViewDto
        {
            SharedMap = room.SharedMap,
            LastRoll = room.LastRoll,
            MapSharedAt = room.MapSharedAt
        };
    }
}
