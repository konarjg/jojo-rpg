using System.Diagnostics;
using JojoRpg.Data.Database;
using Testcontainers.MsSql;

string repoRoot = FindRepoRoot();
string outputDir = Path.Combine(repoRoot, "src", "JojoRpg.Data", "Generated");
string migrationsDir = Path.Combine(repoRoot, "src", "JojoRpg.Data", "Database", "Migrations");
Console.WriteLine("Starting SQL Server Testcontainer...");
await using MsSqlContainer container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();
await container.StartAsync();

string connectionString = container.GetConnectionString();
Console.WriteLine("Applying DbUp migrations from {0}", migrationsDir);

string tempMigrations = Path.Combine(Path.GetTempPath(), "jojo-migrations-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(tempMigrations);
foreach (string file in Directory.GetFiles(migrationsDir, "*.sql"))
{
    File.Copy(file, Path.Combine(tempMigrations, Path.GetFileName(file)), true);
}

Environment.SetEnvironmentVariable("JOJO_MIGRATIONS", tempMigrations);
DbUpRunner.Migrate(connectionString);
Directory.CreateDirectory(outputDir);

ProcessStartInfo psi = new()
{
    FileName = "dotnet",
    Arguments = $"linq2db scaffold -p SqlServer -c \"{connectionString}\" -o \"{outputDir}\" --namespace JojoRpg.Data.Generated",
    RedirectStandardOutput = true,
    RedirectStandardError = true,
    UseShellExecute = false
};

using Process process = Process.Start(psi)!;
string stdout = await process.StandardOutput.ReadToEndAsync();
string stderr = await process.StandardError.ReadToEndAsync();
await process.WaitForExitAsync();

Console.WriteLine(stdout);
if (process.ExitCode != 0)
{
    Console.Error.WriteLine(stderr);
    Console.WriteLine("linq2db scaffold failed (exit {0}). Using existing Generated/ if present.", process.ExitCode);
    Environment.Exit(process.ExitCode);
}

Console.WriteLine("Schema codegen complete.");

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