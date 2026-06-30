param(
    [string]$BaseUrl = $(if ($env:JOJO_BASE_URL) { $env:JOJO_BASE_URL } else { "https://jojorpg.runasp.net" }),
    [switch]$SkipPlayer
)

$ErrorActionPreference = "Stop"

function Write-Check {
    param([string]$Name, [bool]$Ok, [string]$Detail = "")
    $mark = if ($Ok) { "PASS" } else { "FAIL" }
    $suffix = if ($Detail) { " - $Detail" } else { "" }
    Write-Host "[$mark] $Name$suffix"
    if (-not $Ok) { $script:failed = $true }
}

$script:failed = $false
$roomName = "agent-smoke-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "JoJo RPG prod smoke - $BaseUrl"
Write-Host "Creating room: $roomName"

$gmSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$createPage = Invoke-WebRequest -Uri "$BaseUrl/rooms" -Method POST `
    -Body @{ name = $roomName } `
    -WebSession $gmSession -UseBasicParsing

$finalUri = $createPage.BaseResponse.ResponseUri.ToString()
if ($finalUri -notmatch '/room/([^/]+)/gm') {
    Write-Check "Create room redirect" $false "Unexpected final URL: $finalUri"
    exit 1
}

$roomCode = $Matches[1]
Write-Check "Create room" $true "room=$roomCode"

$gmHtml = $createPage.Content

Write-Check "GM page HTTP 200" ($createPage.StatusCode -eq 200)
Write-Check "GM sticky board" ($gmHtml -match 'gm-sticky-board')
Write-Check "GM color swatches" ($gmHtml -match 'gm-sticky-palette-swatch')
Write-Check "GM sticky-board.js" ($gmHtml -match 'sticky-board\.js')

$gmCode = $null
if ($gmHtml -match 'Save your GM code[\s\S]*?<code>([^<]+)</code>') {
    $gmCode = $Matches[1]
    Write-Check "GM code banner" $true "captured for re-auth"
} else {
    Write-Check "GM code banner" $true "not shown (session already established)"
}

$stickyJs = Invoke-WebRequest -Uri "$BaseUrl/js/legacy/sticky-board.js" -UseBasicParsing
Write-Check "sticky-board.js asset" (($stickyJs.StatusCode -eq 200) -and ($stickyJs.Content -match 'StickyBoard'))

$css = Invoke-WebRequest -Uri "$BaseUrl/css/rulebook.css" -UseBasicParsing
Write-Check "rulebook.css asset" (($css.StatusCode -eq 200) -and ($css.Content -match 'gm-sticky-palette-swatch'))
Write-Check "Account mobile CSS" ($css.Content -match 'auth-page' -and $css.Content -match 'min-height:\s*44px' -and $css.Content -match 'account-dashboard')

$loginPage = Invoke-WebRequest -Uri "$BaseUrl/account/login" -UseBasicParsing
Write-Check "Account login page HTTP 200" ($loginPage.StatusCode -eq 200)
Write-Check "Account login mobile form" ($loginPage.Content -match 'class="auth-input"' -and $loginPage.Content -match 'autocomplete="email"')

$registerPage = Invoke-WebRequest -Uri "$BaseUrl/account/register" -UseBasicParsing
Write-Check "Account register page HTTP 200" ($registerPage.StatusCode -eq 200)
Write-Check "Account register mobile form" ($registerPage.Content -match 'autocomplete="new-password"' -and $registerPage.Content -match 'auth-btn')

if (-not $SkipPlayer) {
    $playerSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    Invoke-WebRequest -Uri "$BaseUrl/room/$roomCode/join" -Method POST `
        -Body @{ displayName = "Smoke Player" } `
        -WebSession $playerSession -UseBasicParsing | Out-Null

    $playPage = Invoke-WebRequest -Uri "$BaseUrl/room/$roomCode/play" -WebSession $playerSession -UseBasicParsing
    $playHtml = $playPage.Content

    Write-Check "Player play page HTTP 200" ($playPage.StatusCode -eq 200)
    Write-Check "Player sticky board" ($playHtml -match 'player-sticky-board')
    Write-Check "Player color swatches" ($playHtml -match 'gm-sticky-palette-swatch')
    Write-Check "Player sheet shell" ($playHtml -match 'sheet-shell')
    Write-Check "Legacy player claim banner" ($playHtml -match 'account-banner')
}

if ($gmCode) {
    Write-Host ""
    Write-Host "GM code (store for re-auth): $gmCode"
}

Write-Host ""
Write-Host "Test room: $roomCode"
if ($script:failed) {
    Write-Host "SMOKE TEST FAILED"
    exit 1
}

Write-Host "SMOKE TEST PASSED"
exit 0
