using JojoRpg.Data.Database;
using Testcontainers.MsSql;

namespace JojoRpg.IntegrationTests;

public sealed class SqlTestFixture : IAsyncLifetime
{
    private MsSqlContainer? _container;

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        _container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();
        await _container.StartAsync();
        ConnectionString = _container.GetConnectionString();
        ApplyMigrations(ConnectionString);
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    public static void ApplyMigrations(string connectionString)
    {
        string migrationsSource = FindMigrationsDirectory();
        string tempDir = Path.Combine(Path.GetTempPath(), "jojo-migrations-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        foreach (string file in Directory.GetFiles(migrationsSource, "*.sql"))
        {
            File.Copy(file, Path.Combine(tempDir, Path.GetFileName(file)), true);
        }

        Environment.SetEnvironmentVariable("JOJO_MIGRATIONS", tempDir);
        DbUpRunner.Migrate(connectionString);
    }

    public static string FindMigrationsDirectory()
    {
        DirectoryInfo? dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            string candidate = Path.Combine(dir.FullName, "src", "JojoRpg.Data", "Database", "Migrations");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            if (File.Exists(Path.Combine(dir.FullName, "JojoRpg.slnx")) || File.Exists(Path.Combine(dir.FullName, "JojoRpg.sln")))
            {
                throw new DirectoryNotFoundException($"Migrations folder not found at {candidate}.");
            }

            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("Could not find repository root for DbUp migrations.");
    }
}

[CollectionDefinition("Sql")]
public sealed class SqlCollection : ICollectionFixture<SqlTestFixture>
{
}
