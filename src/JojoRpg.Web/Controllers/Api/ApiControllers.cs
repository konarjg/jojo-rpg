using JojoRpg.Application.Players;
using JojoRpg.Application.Rooms;
using JojoRpg.Domain.Payloads;
using JojoRpg.Web.Middleware;
using Microsoft.AspNetCore.Mvc;

namespace JojoRpg.Web.Controllers.Api;

[ApiController]
public sealed class RoomsApiController : ControllerBase
{
    [HttpGet("/api/rooms/{roomId:guid}/workspace")]
    public async Task<IActionResult> GetWorkspace(Guid roomId, GetGmWorkspaceUseCase useCase, CancellationToken cancellationToken)
    {
        if (!AuthorizeRoom(roomId, out _))
        {
            return Forbid();
        }

        GmWorkspacePayload? workspace = await useCase.ExecuteAsync(roomId, cancellationToken);
        return workspace is null ? NotFound() : Ok(workspace);
    }

    [HttpPut("/api/rooms/{roomId:guid}/workspace")]
    public async Task<IActionResult> SaveWorkspace(Guid roomId, [FromBody] GmWorkspacePayload workspace, SaveGmWorkspaceUseCase useCase, CancellationToken cancellationToken)
    {
        if (!AuthorizeGm(roomId))
        {
            return Forbid();
        }

        Application.Common.UseCaseResult result = await useCase.ExecuteAsync(roomId, workspace, cancellationToken);
        return result.Success ? NoContent() : BadRequest(result.Error);
    }

    [HttpGet("/api/rooms/{roomId:guid}/shared-view")]
    public async Task<IActionResult> GetSharedView(Guid roomId, GetSharedViewUseCase useCase, CancellationToken cancellationToken)
    {
        if (!AuthorizeRoom(roomId, out _))
        {
            return Forbid();
        }

        SharedViewDto? view = await useCase.ExecuteAsync(roomId, cancellationToken);
        return view is null ? NotFound() : Ok(view);
    }

    [HttpPost("/api/rooms/{roomId:guid}/share-map")]
    public async Task<IActionResult> ShareMap(Guid roomId, [FromBody] SharedMapPayload map, ShareMapUseCase useCase, CancellationToken cancellationToken)
    {
        if (!AuthorizeGm(roomId))
        {
            return Forbid();
        }

        Application.Common.UseCaseResult result = await useCase.ExecuteAsync(roomId, map, cancellationToken);
        return result.Success ? NoContent() : BadRequest(result.Error);
    }

    [HttpPost("/api/rooms/{roomId:guid}/stop-share-map")]
    public async Task<IActionResult> StopShareMap(Guid roomId, StopShareMapUseCase useCase, CancellationToken cancellationToken)
    {
        if (!AuthorizeGm(roomId))
        {
            return Forbid();
        }

        Application.Common.UseCaseResult result = await useCase.ExecuteAsync(roomId, cancellationToken);
        return result.Success ? NoContent() : BadRequest(result.Error);
    }

    [HttpPatch("/api/rooms/{roomId:guid}/shared-map/player-tokens")]
    public async Task<IActionResult> MovePlayerTokens(
        Guid roomId,
        [FromBody] MovePlayerMapTokensRequest request,
        MovePlayerMapTokensUseCase useCase,
        CancellationToken cancellationToken)
    {
        if (!AuthorizePlayer(roomId))
        {
            return Forbid();
        }

        Application.Common.UseCaseResult result = await useCase.ExecuteAsync(roomId, request, cancellationToken);
        return result.Success ? NoContent() : BadRequest(result.Error);
    }

    [HttpPost("/api/rooms/{roomId:guid}/broadcast-roll")]
    public async Task<IActionResult> BroadcastRoll(Guid roomId, [FromBody] RollPayload roll, BroadcastRollUseCase useCase, CancellationToken cancellationToken)
    {
        if (!AuthorizeGm(roomId))
        {
            return Forbid();
        }

        Application.Common.UseCaseResult result = await useCase.ExecuteAsync(roomId, roll, cancellationToken);
        return result.Success ? NoContent() : BadRequest(result.Error);
    }

    private bool AuthorizeRoom(Guid roomId, out Auth.RoomSessionContext? session)
    {
        session = HttpContext.GetRoomSession();
        return session is not null && session.RoomId == roomId;
    }

    private bool AuthorizeGm(Guid roomId)
    {
        Auth.RoomSessionContext? session = HttpContext.GetRoomSession();
        return session is not null && session.RoomId == roomId && session.Role == Domain.Enums.SessionRole.Gm;
    }

    private bool AuthorizePlayer(Guid roomId)
    {
        Auth.RoomSessionContext? session = HttpContext.GetRoomSession();
        return session is not null && session.RoomId == roomId && session.Role == Domain.Enums.SessionRole.Player;
    }
}

[ApiController]
public sealed class PlayersApiController : ControllerBase
{
    [HttpGet("/api/players/me/stickies")]
    public async Task<IActionResult> GetStickies(GetPlayerStickiesUseCase useCase, CancellationToken cancellationToken)
    {
        Auth.RoomSessionContext? session = HttpContext.GetRoomSession();
        if (session?.PlayerId is not Guid playerId)
        {
            return Forbid();
        }

        StickyBoardPayload? stickies = await useCase.ExecuteAsync(playerId, cancellationToken);
        return Ok(stickies ?? new StickyBoardPayload());
    }

    [HttpPut("/api/players/me/stickies")]
    public async Task<IActionResult> SaveStickies([FromBody] StickyBoardPayload stickies, SavePlayerStickiesUseCase useCase, CancellationToken cancellationToken)
    {
        Auth.RoomSessionContext? session = HttpContext.GetRoomSession();
        if (session?.PlayerId is not Guid playerId)
        {
            return Forbid();
        }

        Application.Common.UseCaseResult result = await useCase.ExecuteAsync(playerId, stickies, cancellationToken);
        return result.Success ? NoContent() : BadRequest(result.Error);
    }

    [HttpPut("/api/players/me/sheet")]
    public async Task<IActionResult> SaveSheet([FromBody] CharacterSheetPayload sheet, SavePlayerSheetUseCase useCase, CancellationToken cancellationToken)
    {
        Auth.RoomSessionContext? session = HttpContext.GetRoomSession();
        if (session?.PlayerId is not Guid playerId)
        {
            return Forbid();
        }

        Application.Common.UseCaseResult result = await useCase.ExecuteAsync(playerId, sheet, cancellationToken);
        return result.Success ? NoContent() : BadRequest(result.Error);
    }

    [HttpGet("/api/players/{playerId:guid}/sheet")]
    public async Task<IActionResult> GetSheet(Guid playerId, GetPlayerSheetUseCase useCase, CancellationToken cancellationToken)
    {
        Auth.RoomSessionContext? session = HttpContext.GetRoomSession();
        Domain.Aggregates.Player? player = await useCase.ExecuteAsync(playerId, cancellationToken);
        if (player is null)
        {
            return NotFound();
        }

        if (session is null || session.RoomId != player.RoomId)
        {
            return Forbid();
        }

        if (session.Role == Domain.Enums.SessionRole.Player && session.PlayerId != playerId)
        {
            return Forbid();
        }

        return Ok(player.Sheet);
    }
}
