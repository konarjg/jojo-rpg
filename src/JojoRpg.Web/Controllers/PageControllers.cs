using JojoRpg.Application.Players;
using JojoRpg.Web.Middleware;
using Microsoft.AspNetCore.Mvc;
using RoomSessionContext = JojoRpg.Web.Auth.RoomSessionContext;

namespace JojoRpg.Web.Controllers;

public sealed class GmController : Controller
{
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
    public async Task<IActionResult> Sheets(string roomCode, ListPlayersUseCase listPlayers, CancellationToken cancellationToken)
    {
        if (!HttpContext.RequireGm(roomCode, out RoomSessionContext? session) || session is null)
        {
            return Redirect($"/room/{roomCode.ToUpperInvariant()}/gm");
        }

        IReadOnlyList<Domain.Aggregates.Player> players = await listPlayers.ExecuteAsync(session.RoomId, cancellationToken);
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
        ViewBag.PlayerId = sheetId;
        ViewBag.ReadOnly = true;
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
}
