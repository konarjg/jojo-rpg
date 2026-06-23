using JojoRpg.Application.Players;
using JojoRpg.Web.Middleware;
using Microsoft.AspNetCore.Mvc;
using RoomSessionContext = JojoRpg.Web.Auth.RoomSessionContext;

namespace JojoRpg.Web.Controllers;

public sealed class GmController : Controller
{
    private readonly ListPlayersUseCase _listPlayersUseCase;

    public GmController(ListPlayersUseCase listPlayersUseCase)
    {
        _listPlayersUseCase = listPlayersUseCase;
    }

    [HttpGet("/room/{roomCode}/gm")]
    public IActionResult Index(string roomCode)
    {
        if (!HttpContext.RequireGm(roomCode, out RoomSessionContext? session) || session is null)
        {
            ViewBag.RoomCode = roomCode.ToUpperInvariant();
            return View("GmAuth");
        }

        ViewBag.RoomCode = session.RoomCode;
        ViewBag.RoomId = session.RoomId;
        return View("Gm");
    }

    [HttpGet("/room/{roomCode}/gm/sheets")]
    public async Task<IActionResult> Sheets(string roomCode, CancellationToken cancellationToken)
    {
        if (!HttpContext.RequireGm(roomCode, out RoomSessionContext? session) || session is null)
        {
            return Redirect($"/room/{roomCode.ToUpperInvariant()}/gm");
        }

        IReadOnlyList<Domain.Aggregates.Player> players = await _listPlayersUseCase.ExecuteAsync(session.RoomId, cancellationToken);
        return View("GmSheets", players);
    }

    [HttpGet("/room/{roomCode}/gm/sheet/{sheetId:guid}")]
    public IActionResult ViewSheet(string roomCode, Guid sheetId)
    {
        if (!HttpContext.RequireGm(roomCode, out RoomSessionContext? session) || session is null)
        {
            return Redirect($"/room/{roomCode.ToUpperInvariant()}/gm");
        }

        ViewBag.RoomCode = session.RoomCode;
        ViewBag.RoomId = session.RoomId;
        ViewBag.PlayerId = sheetId;
        ViewBag.ReadOnly = true;
        ViewBag.ReferenceMode = false;
        return View("Sheet");
    }

    [HttpGet("/room/{roomCode}/gm/builder")]
    public IActionResult Builder(string roomCode)
    {
        if (!HttpContext.RequireGm(roomCode, out RoomSessionContext? session) || session is null)
        {
            return Redirect($"/room/{roomCode.ToUpperInvariant()}/gm");
        }

        ViewBag.RoomCode = session.RoomCode;
        ViewBag.RoomId = session.RoomId;
        ViewBag.ReadOnly = false;
        ViewBag.ReferenceMode = true;
        return View("Sheet");
    }
}

public sealed class PlayerController : Controller
{
    [HttpGet("/room/{roomCode}/play")]
    public IActionResult Play(string roomCode)
    {
        if (!HttpContext.RequirePlayer(roomCode, out RoomSessionContext? session) || session is null)
        {
            return Redirect($"/room/{roomCode.ToUpperInvariant()}/join");
        }

        ViewBag.RoomCode = session.RoomCode;
        ViewBag.RoomId = session.RoomId;
        ViewBag.PlayerId = session.PlayerId;
        return View("Play");
    }

    [HttpGet("/room/{roomCode}/player-view")]
    public IActionResult PlayerView(string roomCode)
    {
        RoomSessionContext? session = HttpContext.GetRoomSession();
        if (session is null || !string.Equals(session.RoomCode, roomCode, StringComparison.OrdinalIgnoreCase))
        {
            return Redirect($"/room/{roomCode.ToUpperInvariant()}/join");
        }

        ViewBag.RoomCode = session.RoomCode;
        ViewBag.RoomId = session.RoomId;
        ViewBag.IsGm = session.Role == Domain.Enums.SessionRole.Gm;
        return View("PlayerView");
    }
}
