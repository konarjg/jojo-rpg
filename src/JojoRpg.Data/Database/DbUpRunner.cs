using DbUp;
using DbUp.Engine;
using Microsoft.Extensions.Logging;

namespace JojoRpg.Data.Database;

public static class DbUpRunner
{
    public static void Migrate(string connectionString, ILogger? logger = null)
    {
        string? envPath = Environment.GetEnvironmentVariable("JOJO_MIGRATIONS");
        string scriptsPath = !string.IsNullOrEmpty(envPath) && Directory.Exists(envPath)
            ? envPath
            : Path.Combine(AppContext.BaseDirectory, "Database", "Migrations");
        EnsureDatabase.For.SqlDatabase(connectionString);

        UpgradeEngine upgrader = DeployChanges.To
            .SqlDatabase(connectionString)
            .WithScriptsFromFileSystem(scriptsPath)
            .LogToConsole()
            .Build();

        DatabaseUpgradeResult result = upgrader.PerformUpgrade();
        if (!result.Successful)
        {
            logger?.LogError(result.Error, "Database migration failed.");
            throw result.Error ?? new InvalidOperationException("Database migration failed.");
        }

        logger?.LogInformation("Database migrations applied from {Path}", scriptsPath);
    }
}
