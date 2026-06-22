using JojoRpg.Application.Rooms;
using JojoRpg.Application.Sessions;
using JojoRpg.Web.Auth;
using JojoRpg.Web.Middleware;
using Microsoft.AspNetCore.Mvc;

namespace JojoRpg.Web.Controllers;

public sealed class HomeController : Controller
{
    [HttpGet("/")]
    public IActionResult Index()
    {
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

    public RoomJoinController(JoinRoomUseCase joinRoomUseCase, ISessionCookieService cookieService)
    {
        _joinRoomUseCase = joinRoomUseCase;
        _cookieService = cookieService;
    }

    [HttpGet("/room/{roomCode}/join")]
    public IActionResult JoinForm(string roomCode)
    {
        ViewBag.RoomCode = roomCode.ToUpperInvariant();
        return View("Join");
    }

    [HttpPost("/room/{roomCode}/join")]
    public async Task<IActionResult> Join(string roomCode, [FromForm] string? displayName, CancellationToken cancellationToken)
    {
        JoinRoomRequest request = new()
        {
            RoomCode = roomCode,
            DisplayName = displayName,
            ExistingSessionId = _cookieService.GetSessionId(HttpContext)
        };

        Application.Common.UseCaseResult<JoinRoomResponse> result = await _joinRoomUseCase.ExecuteAsync(request, cancellationToken);
        if (!result.Success || result.Value is null)
        {
            ViewBag.RoomCode = roomCode.ToUpperInvariant();
            ViewBag.Error = result.Error;
            return View("Join");
        }

        _cookieService.SetSession(HttpContext, result.Value.SessionId);
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
