using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Domain.Payloads;

namespace JojoRpg.Application.Sessions;

public sealed class GetActiveSessionUseCase
{
    private readonly ISessionRepository _sessionRepository;

    public GetActiveSessionUseCase(ISessionRepository sessionRepository)
    {
        _sessionRepository = sessionRepository;
    }

    public async Task<RoomSession?> ExecuteAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        return await _sessionRepository.GetActiveAsync(sessionId, cancellationToken);
    }
}
