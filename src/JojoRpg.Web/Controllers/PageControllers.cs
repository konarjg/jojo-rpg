using JojoRpg.Application.Sessions;
using JojoRpg.Application.Players;
using JojoRpg.Web.Auth;
using JojoRpg.Web.Middleware;
using Microsoft.AspNetCore.Mvc;
using RoomSessionContext = JojoRpg.Web.Auth.RoomSessionContext;

namespace JojoRpg.Web.Controllers;

public sealed class GmController : Controller
{
    private readonly ListPlayersUseCase _listPlayersUseCase;
    private readonly AuthenticateGmUseCase _authenticateGmUseCase;
    private readonly ISessionCookieService _cookieService;

    public GmController(
        ListPlayersUseCase listPlayersUseCase,
        AuthenticateGmUseCase authenticateGmUseCase,
        ISessionCookieService cookieService)
    {
        _listPlayersUseCase = listPlayersUseCase;
        _authenticateGmUseCase = authenticateGmUseCase;
        _cookieService = cookieService;
    }

    [HttpGet("/room/{roomCode}/gm")]
    public async Task<IActionResult> Index(string roomCode, CancellationToken cancellationToken)
    {
        if (!HttpContext.RequireGm(roomCode, out RoomSessionContext? session) || session is null)
        {
            AccountAuthContext? account = HttpContext.GetAccount();
            if (account is not null)
            {
                Application.Common.UseCaseResult<AuthenticateGmResponse> accountAuth = await _authenticateGmUseCase.ExecuteAsync(new AuthenticateGmRequest
                {
                    RoomCode = roomCode,
                    AccountId = account.AccountId,
                    ExistingSessionId = _cookieService.GetSessionId(HttpContext),
                }, cancellationToken);

                if (accountAuth.Success && accountAuth.Value is not null)
                {
                    _cookieService.SetSession(HttpContext, accountAuth.Value.SessionId);
                    return Redirect($"/room/{roomCode.ToUpperInvariant()}/gm");
                }
            }

            ViewBag.RoomCode = roomCode.ToUpperInvariant();
            return View("GmAuth");
        }

        ViewBag.RoomCode = session.RoomCode;
        ViewBag.RoomId = session.RoomId;
        ViewBag.ShowAccountClaimBanner = session.AccountId is null;
        ViewBag.ClaimType = "gm";
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
        ViewBag.ShowAccountClaimBanner = session.AccountId is null;
        ViewBag.ClaimType = "player";
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

        if (session.Role == Domain.Enums.SessionRole.Gm)
        {
            return Redirect($"/room/{session.RoomCode}/gm");
        }

        return Redirect($"/room/{session.RoomCode}/play");
    }
}
