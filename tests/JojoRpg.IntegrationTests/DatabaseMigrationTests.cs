using JojoRpg.Data.Database;
using Testcontainers.MsSql;

namespace JojoRpg.IntegrationTests;

public class DatabaseMigrationTests
{
    [Fact]
    public async Task DbUp_AppliesInitialMigration()
    {
        await using MsSqlContainer container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();
        await container.StartAsync();

        string migrationsSource = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "src", "JojoRpg.Data", "Database", "Migrations"));
        string tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        foreach (string file in Directory.GetFiles(migrationsSource, "*.sql"))
        {
            File.Copy(file, Path.Combine(tempDir, Path.GetFileName(file)));
        }

        Environment.SetEnvironmentVariable("JOJO_MIGRATIONS", tempDir);
        DbUpRunner.Migrate(container.GetConnectionString());
    }
}
