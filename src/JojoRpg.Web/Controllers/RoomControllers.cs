using JojoRpg.Application.Rooms;
using JojoRpg.Application.Sessions;
using JojoRpg.Domain.Enums;
using JojoRpg.Web.Auth;
using JojoRpg.Web.Middleware;
using Microsoft.AspNetCore.Mvc;
using RoomSessionContext = JojoRpg.Web.Auth.RoomSessionContext;

namespace JojoRpg.Web.Controllers;

public sealed class HomeController : Controller
{
    [HttpGet("/")]
    public IActionResult Index()
    {
        RoomSessionContext? session = HttpContext.GetRoomSession();
        if (session is not null)
        {
            if (session.Role == SessionRole.Gm)
            {
                return Redirect($"/room/{session.RoomCode}/gm");
            }

            if (session.Role == SessionRole.Player)
            {
                return Redirect($"/room/{session.RoomCode}/play");
            }
        }

        return View();
    }
}

public sealed class RoomsController : Controller
{
    private readonly CreateRoomUseCase _createRoomUseCase;
    private readonly ISessionCookieService _cookieService;

    public RoomsController(CreateRoomUseCase createRoomUseCase, ISessionCookieService cookieService)
    {
        _createRoomUseCase = createRoomUseCase;
        _cookieService = cookieService;
    }

    [HttpPost("/rooms")]
    public async Task<IActionResult> Create([FromForm] string? name, CancellationToken cancellationToken)
    {
        Guid? existing = _cookieService.GetSessionId(HttpContext);
        CreateRoomRequest request = new()
        {
            Name = name,
            AccountId = HttpContext.GetAccount()?.AccountId,
            ExistingSessionId = existing
        };

        Application.Common.UseCaseResult<CreateRoomResponse> result = await _createRoomUseCase.ExecuteAsync(request, cancellationToken);
        if (!result.Success || result.Value is null)
        {
            TempData["Error"] = result.Error ?? "Could not create room.";
            return RedirectToAction("Index", "Home");
        }

        _cookieService.SetSession(HttpContext, result.Value.SessionId);
        TempData["GmCode"] = result.Value.GmCode;
        TempData["RoomCode"] = result.Value.RoomCode;
        return Redirect($"/room/{result.Value.RoomCode}/gm");
    }
}

public sealed class SessionController : Controller
{
    private readonly LeaveSessionUseCase _leaveSessionUseCase;
    private readonly ISessionCookieService _cookieService;

    public SessionController(LeaveSessionUseCase leaveSessionUseCase, ISessionCookieService cookieService)
    {
        _leaveSessionUseCase = leaveSessionUseCase;
        _cookieService = cookieService;
    }

    [HttpPost("/session/leave")]
    public async Task<IActionResult> Leave(CancellationToken cancellationToken)
    {
        Guid? sessionId = _cookieService.GetSessionId(HttpContext);
        if (sessionId is Guid id)
        {
            await _leaveSessionUseCase.ExecuteAsync(id, cancellationToken);
        }

        _cookieService.ClearSession(HttpContext);
        return Redirect("/");
    }
}

public sealed class RoomJoinController : Controller
{
    private readonly JoinRoomUseCase _joinRoomUseCase;
    private readonly ISessionCookieService _cookieService;
    private readonly IPlayerCodeCookieService _playerCodeCookieService;

    public RoomJoinController(
        JoinRoomUseCase joinRoomUseCase,
        ISessionCookieService cookieService,
        IPlayerCodeCookieService playerCodeCookieService)
    {
        _joinRoomUseCase = joinRoomUseCase;
        _cookieService = cookieService;
        _playerCodeCookieService = playerCodeCookieService;
    }

    [HttpGet("/room/{roomCode}/join")]
    public IActionResult JoinForm(string roomCode)
    {
        string code = roomCode.ToUpperInvariant();
        if (HttpContext.RequirePlayer(code, out _))
        {
            return Redirect($"/room/{code}/play");
        }

        ViewBag.RoomCode = code;
        ViewBag.SavedPlayerCode = _playerCodeCookieService.GetPlayerCode(HttpContext, code);
        return View("Join");
    }

    [HttpPost("/join")]
    public async Task<IActionResult> JoinFromHome(
        [FromForm] string? roomCode,
        [FromForm] string? displayName,
        [FromForm] string? playerCode,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(roomCode))
        {
            TempData["Error"] = "Enter a room code.";
            return Redirect("/");
        }

        return await JoinInternal(roomCode.Trim(), displayName, playerCode, returnToHomeOnError: true, cancellationToken);
    }

    [HttpPost("/room/{roomCode}/join")]
    public Task<IActionResult> Join(
        string roomCode,
        [FromForm] string? displayName,
        [FromForm] string? playerCode,
        CancellationToken cancellationToken)
    {
        return JoinInternal(roomCode, displayName, playerCode, returnToHomeOnError: false, cancellationToken);
    }

    private async Task<IActionResult> JoinInternal(
        string roomCode,
        string? displayName,
        string? playerCode,
        bool returnToHomeOnError,
        CancellationToken cancellationToken)
    {
        string normalizedRoomCode = roomCode.Trim().ToUpperInvariant();
        string? resolvedPlayerCode = string.IsNullOrWhiteSpace(playerCode)
            ? _playerCodeCookieService.GetPlayerCode(HttpContext, normalizedRoomCode)
            : playerCode.Trim();

        JoinRoomRequest request = new()
        {
            RoomCode = normalizedRoomCode,
            DisplayName = displayName,
            PlayerCode = resolvedPlayerCode,
            AccountId = HttpContext.GetAccount()?.AccountId,
            ExistingSessionId = _cookieService.GetSessionId(HttpContext)
        };

        Application.Common.UseCaseResult<JoinRoomResponse> result = await _joinRoomUseCase.ExecuteAsync(request, cancellationToken);
        if (!result.Success || result.Value is null)
        {
            if (returnToHomeOnError)
            {
                TempData["Error"] = result.Error ?? "Could not join room.";
                return Redirect("/");
            }

            ViewBag.RoomCode = normalizedRoomCode;
            ViewBag.Error = result.Error;
            ViewBag.SavedPlayerCode = resolvedPlayerCode;
            return View("Join");
        }

        _cookieService.SetSession(HttpContext, result.Value.SessionId);
        _playerCodeCookieService.SetPlayerCode(HttpContext, result.Value.RoomCode, result.Value.PlayerCode);

        if (result.Value.IssuedNewPlayerCode)
        {
            TempData["PlayerCode"] = result.Value.PlayerCode;
        }

        return Redirect($"/room/{result.Value.RoomCode}/play");
    }
}

public sealed class GmAuthController : Controller
{
    private readonly AuthenticateGmUseCase _authenticateGmUseCase;
    private readonly ISessionCookieService _cookieService;

    public GmAuthController(AuthenticateGmUseCase authenticateGmUseCase, ISessionCookieService cookieService)
    {
        _authenticateGmUseCase = authenticateGmUseCase;
        _cookieService = cookieService;
    }

    [HttpPost("/room/{roomCode}/gm/auth")]
    public async Task<IActionResult> Auth(string roomCode, [FromForm] string gmCode, CancellationToken cancellationToken)
    {
        AuthenticateGmRequest request = new()
        {
            RoomCode = roomCode,
            GmCode = gmCode,
            AccountId = HttpContext.GetAccount()?.AccountId,
            ExistingSessionId = _cookieService.GetSessionId(HttpContext)
        };

        Application.Common.UseCaseResult<AuthenticateGmResponse> result = await _authenticateGmUseCase.ExecuteAsync(request, cancellationToken);
        if (!result.Success || result.Value is null)
        {
            TempData["Error"] = result.Error ?? "Authentication failed.";
            return Redirect($"/room/{roomCode.ToUpperInvariant()}/gm");
        }

        _cookieService.SetSession(HttpContext, result.Value.SessionId);
        return Redirect($"/room/{roomCode.ToUpperInvariant()}/gm");
    }
}
