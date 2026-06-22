using System.Diagnostics;
using DbUp;
using DbUp.Engine;
using Testcontainers.MsSql;

string repoRoot = FindRepoRoot();
string outputDir = Path.Combine(repoRoot, "src", "JojoRpg.Data", "Generated");
string migrationsDir = Path.Combine(repoRoot, "src", "JojoRpg.Data", "Database", "Migrations");

string? connectionString = Environment.GetEnvironmentVariable("SCHEMAGEN_CONNECTION_STRING");
MsSqlContainer? container = null;

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.WriteLine("SCHEMAGEN_CONNECTION_STRING not set; starting SQL Server Testcontainer...");
    container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();
    await container.StartAsync();
    connectionString = container.GetConnectionString();
}

try
{
    Console.WriteLine("Applying DbUp migrations from {0}", migrationsDir);
    ApplyMigrations(connectionString, migrationsDir);

    Directory.CreateDirectory(outputDir);
    Console.WriteLine("Scaffolding linq2db entities to {0}", outputDir);
    await RunLinq2DbScaffoldAsync(connectionString, outputDir);

    if (!File.Exists(Path.Combine(outputDir, "JojoDataConnection.cs")))
    {
        throw new InvalidOperationException("Schema codegen did not produce JojoDataConnection.cs.");
    }

    Console.WriteLine("Schema codegen complete.");
}
finally
{
    if (container is not null)
    {
        await container.DisposeAsync();
    }
}

static void ApplyMigrations(string connectionString, string scriptsPath)
{
    EnsureDatabase.For.SqlDatabase(connectionString);

    UpgradeEngine upgrader = DeployChanges.To
        .SqlDatabase(connectionString)
        .WithScriptsFromFileSystem(scriptsPath)
        .LogToConsole()
        .Build();

    DatabaseUpgradeResult result = upgrader.PerformUpgrade();
    if (!result.Successful)
    {
        throw result.Error ?? new InvalidOperationException("Database migration failed.");
    }
}

static async Task RunLinq2DbScaffoldAsync(string connectionString, string outputDir)
{
    ProcessStartInfo psi = new()
    {
        FileName = "dotnet",
        Arguments = $"linq2db scaffold -p SqlServer -c \"{connectionString}\" -o \"{outputDir}\" --namespace JojoRpg.Data.Generated",
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
    };

    using Process process = Process.Start(psi)!;
    string stdout = await process.StandardOutput.ReadToEndAsync();
    string stderr = await process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();

    if (!string.IsNullOrWhiteSpace(stdout))
    {
        Console.WriteLine(stdout);
    }

    if (process.ExitCode != 0)
    {
        Console.Error.WriteLine(stderr);
        throw new InvalidOperationException($"linq2db scaffold failed (exit {process.ExitCode}).");
    }
}

static string FindRepoRoot()
{
    DirectoryInfo? dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null)
    {
        if (File.Exists(Path.Combine(dir.FullName, "JojoRpg.sln")) || File.Exists(Path.Combine(dir.FullName, "JojoRpg.slnx")))
        {
            return dir.FullName;
        }

        dir = dir.Parent;
    }

    throw new InvalidOperationException("Could not find repository root.");
}
