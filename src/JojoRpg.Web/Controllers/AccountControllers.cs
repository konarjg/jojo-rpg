using JojoRpg.Application.Accounts;
using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Application.Sessions;
using JojoRpg.Domain.Aggregates;
using JojoRpg.Web.Auth;
using JojoRpg.Web.Middleware;
using Microsoft.AspNetCore.Mvc;
using RoomSessionContext = JojoRpg.Web.Auth.RoomSessionContext;

namespace JojoRpg.Web.Controllers;

public sealed class AccountController : Controller
{
    private readonly RegisterAccountUseCase _registerAccountUseCase;
    private readonly LoginAccountUseCase _loginAccountUseCase;
    private readonly LogoutAccountUseCase _logoutAccountUseCase;
    private readonly IAccountRepository _accountRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly IPlayerRepository _playerRepository;
    private readonly IAccountAuthCookieService _accountCookieService;
    private readonly ISessionCookieService _sessionCookieService;
    private readonly ClaimPlayerUseCase _claimPlayerUseCase;
    private readonly ClaimRoomUseCase _claimRoomUseCase;

    public AccountController(
        RegisterAccountUseCase registerAccountUseCase,
        LoginAccountUseCase loginAccountUseCase,
        LogoutAccountUseCase logoutAccountUseCase,
        IAccountRepository accountRepository,
        IRoomRepository roomRepository,
        IPlayerRepository playerRepository,
        IAccountAuthCookieService accountCookieService,
        ISessionCookieService sessionCookieService,
        ClaimPlayerUseCase claimPlayerUseCase,
        ClaimRoomUseCase claimRoomUseCase)
    {
        _registerAccountUseCase = registerAccountUseCase;
        _loginAccountUseCase = loginAccountUseCase;
        _logoutAccountUseCase = logoutAccountUseCase;
        _accountRepository = accountRepository;
        _roomRepository = roomRepository;
        _playerRepository = playerRepository;
        _accountCookieService = accountCookieService;
        _sessionCookieService = sessionCookieService;
        _claimPlayerUseCase = claimPlayerUseCase;
        _claimRoomUseCase = claimRoomUseCase;
    }

    [HttpGet("/account/register")]
    public IActionResult Register([FromQuery] string? returnUrl, [FromQuery] string? claim)
    {
        ViewBag.ReturnUrl = SafeReturnUrl(returnUrl);
        ViewBag.Claim = claim;
        return View();
    }

    [HttpPost("/account/register")]
    public async Task<IActionResult> RegisterPost(
        [FromForm] string email,
        [FromForm] string password,
        [FromForm] string? displayName,
        [FromForm] string? returnUrl,
        [FromForm] string? claim,
        CancellationToken cancellationToken)
    {
        Application.Common.UseCaseResult<AccountAuthResponse> result = await _registerAccountUseCase.ExecuteAsync(new RegisterAccountRequest
        {
            Email = email,
            Password = password,
            DisplayName = displayName,
        }, cancellationToken);

        if (!result.Success || result.Value is null)
        {
            ViewBag.Error = result.Error ?? "Could not create account.";
            ViewBag.Email = email;
            ViewBag.DisplayName = displayName;
            ViewBag.ReturnUrl = SafeReturnUrl(returnUrl);
            ViewBag.Claim = claim;
            return View("Register");
        }

        Account? account = await _accountRepository.GetByIdAsync(result.Value.AccountId, cancellationToken);
        if (account is not null)
        {
            _accountCookieService.SetAccount(HttpContext, account);
        }

        return Redirect(NextUrlAfterAuth(returnUrl, claim));
    }

    [HttpGet("/account/login")]
    public IActionResult Login([FromQuery] string? returnUrl, [FromQuery] string? claim)
    {
        ViewBag.ReturnUrl = SafeReturnUrl(returnUrl);
        ViewBag.Claim = claim;
        return View();
    }

    [HttpPost("/account/login")]
    public async Task<IActionResult> LoginPost(
        [FromForm] string email,
        [FromForm] string password,
        [FromForm] string? returnUrl,
        [FromForm] string? claim,
        CancellationToken cancellationToken)
    {
        Application.Common.UseCaseResult<AccountAuthResponse> result = await _loginAccountUseCase.ExecuteAsync(new LoginAccountRequest
        {
            Email = email,
            Password = password,
        }, cancellationToken);

        if (!result.Success || result.Value is null)
        {
            ViewBag.Error = result.Error ?? "Could not sign in.";
            ViewBag.Email = email;
            ViewBag.ReturnUrl = SafeReturnUrl(returnUrl);
            ViewBag.Claim = claim;
            return View("Login");
        }

        Account? account = await _accountRepository.GetByIdAsync(result.Value.AccountId, cancellationToken);
        if (account is not null)
        {
            _accountCookieService.SetAccount(HttpContext, account);
        }

        return Redirect(NextUrlAfterAuth(returnUrl, claim));
    }

    [HttpPost("/account/logout")]
    public IActionResult Logout()
    {
        _logoutAccountUseCase.Execute();
        _accountCookieService.ClearAccount(HttpContext);
        return Redirect("/");
    }

    [HttpPost("/account/claim")]
    public async Task<IActionResult> Claim([FromForm] string claimType, [FromForm] string? returnUrl, CancellationToken cancellationToken)
    {
        AccountAuthContext? account = HttpContext.GetAccount();
        if (account is null)
        {
            string target = SafeReturnUrl(returnUrl);
            return Redirect($"/account/login?returnUrl={Uri.EscapeDataString(target)}&claim={Uri.EscapeDataString(claimType)}");
        }

        RoomSessionContext? session = HttpContext.GetRoomSession();
        if (session is null)
        {
            TempData["Error"] = "Open the room or character you want to claim, then try again.";
            return Redirect(SafeReturnUrl(returnUrl));
        }

        Application.Common.UseCaseResult<ClaimSessionResponse> result;
        if (string.Equals(claimType, "player", StringComparison.OrdinalIgnoreCase) && session.PlayerId is Guid playerId)
        {
            result = await _claimPlayerUseCase.ExecuteAsync(new ClaimPlayerRequest
            {
                AccountId = account.AccountId,
                RoomId = session.RoomId,
                PlayerId = playerId,
                ExistingSessionId = _sessionCookieService.GetSessionId(HttpContext),
            }, cancellationToken);
        }
        else if (string.Equals(claimType, "gm", StringComparison.OrdinalIgnoreCase))
        {
            result = await _claimRoomUseCase.ExecuteAsync(new ClaimRoomRequest
            {
                AccountId = account.AccountId,
                RoomId = session.RoomId,
                ExistingSessionId = _sessionCookieService.GetSessionId(HttpContext),
            }, cancellationToken);
        }
        else
        {
            result = Application.Common.UseCaseResult<ClaimSessionResponse>.Fail("That account claim is not valid for the current session.");
        }

        if (!result.Success || result.Value is null)
        {
            TempData["Error"] = result.Error ?? "Could not claim this session.";
            return Redirect(SafeReturnUrl(returnUrl));
        }

        _sessionCookieService.SetSession(HttpContext, result.Value.SessionId);
        TempData["AccountClaimed"] = "This session is now linked to your account.";
        return Redirect(SafeReturnUrl(returnUrl));
    }

    [HttpGet("/account")]
    public async Task<IActionResult> Dashboard(CancellationToken cancellationToken)
    {
        AccountAuthContext? account = HttpContext.GetAccount();
        if (account is null)
        {
            return Redirect("/account/login?returnUrl=/account");
        }

        IReadOnlyList<Room> rooms = await _roomRepository.ListByOwnerAccountAsync(account.AccountId, cancellationToken);
        IReadOnlyList<Player> players = await _playerRepository.ListByAccountAsync(account.AccountId, cancellationToken);
        List<AccountPlayerCardViewModel> playerCards = new();
        foreach (Player player in players)
        {
            Room? room = await _roomRepository.GetByIdAsync(player.RoomId, cancellationToken);
            if (room is null)
            {
                continue;
            }

            playerCards.Add(new AccountPlayerCardViewModel
            {
                PlayerId = player.Id,
                DisplayName = player.DisplayName,
                RoomCode = room.RoomCode,
                RoomName = room.Name,
            });
        }

        AccountDashboardViewModel model = new()
        {
            Account = account,
            Rooms = rooms,
            PlayerCards = playerCards,
        };

        return View(model);
    }

    private static string SafeReturnUrl(string? returnUrl)
    {
        if (string.IsNullOrWhiteSpace(returnUrl) || !returnUrl.StartsWith("/", StringComparison.Ordinal) || returnUrl.StartsWith("//", StringComparison.Ordinal))
        {
            return "/account";
        }

        return returnUrl;
    }

    private static string NextUrlAfterAuth(string? returnUrl, string? claim)
    {
        string safeReturnUrl = SafeReturnUrl(returnUrl);
        if (!string.IsNullOrWhiteSpace(claim))
        {
            string separator = safeReturnUrl.Contains('?', StringComparison.Ordinal) ? "&" : "?";
            return safeReturnUrl + separator + "claim=" + Uri.EscapeDataString(claim);
        }

        return safeReturnUrl;
    }
}

public sealed class AccountDashboardViewModel
{
    public AccountAuthContext Account { get; init; } = new();

    public IReadOnlyList<Room> Rooms { get; init; } = Array.Empty<Room>();

    public IReadOnlyList<AccountPlayerCardViewModel> PlayerCards { get; init; } = Array.Empty<AccountPlayerCardViewModel>();
}

public sealed class AccountPlayerCardViewModel
{
    public Guid PlayerId { get; init; }

    public string DisplayName { get; init; } = string.Empty;

    public string RoomCode { get; init; } = string.Empty;

    public string RoomName { get; init; } = string.Empty;
}
