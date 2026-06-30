using JojoRpg.Application;
using JojoRpg.Application.Ports.Notifications;
using JojoRpg.Data;
using JojoRpg.Data.Database;
using JojoRpg.Web.Auth;
using JojoRpg.Web.Hubs;
using JojoRpg.Web.Middleware;
using JojoRpg.Web.SignalR;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

string connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

builder.Services.AddControllersWithViews();
builder.Services.AddSignalR();
builder.Services.AddApplication();
builder.Services.AddJojoRpgData(connectionString);
builder.Services.AddScoped<ISessionCookieService, SessionCookieService>();
builder.Services.AddScoped<IAccountAuthCookieService, AccountAuthCookieService>();
builder.Services.AddScoped<IPlayerCodeCookieService, PlayerCodeCookieService>();
builder.Services.AddScoped<IRoomLookup, RoomLookup>();
builder.Services.AddScoped<ICampaignNotifier, CampaignNotifier>();

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseStaticFiles();
app.UseRouting();
app.UseAccountAuth();
app.UseRoomSession();
app.MapControllers();
app.MapHub<CampaignHub>("/hubs/campaign");

try
{
    DbUpRunner.Migrate(connectionString, app.Logger);
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "DbUp migration skipped — database may be unavailable during startup.");
}

app.Run();

public partial class Program { }
