using JojoRpg.Application.Common;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Domain.Aggregates;

namespace JojoRpg.Application.Sessions;

public sealed class LeaveSessionUseCase
{
    private readonly ISessionRepository _sessionRepository;

    public LeaveSessionUseCase(ISessionRepository sessionRepository)
    {
        _sessionRepository = sessionRepository;
    }

    public async Task<UseCaseResult> ExecuteAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        RoomSession? session = await _sessionRepository.GetActiveAsync(sessionId, cancellationToken);
        if (session is null)
        {
            return UseCaseResult.Fail("Session not found.");
        }

        await _sessionRepository.RevokeAsync(sessionId, cancellationToken);
        return UseCaseResult.Ok();
    }
}
