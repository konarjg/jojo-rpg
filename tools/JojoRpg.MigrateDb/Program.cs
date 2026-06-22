using JojoRpg.Data.Database;

string? connectionString = args.FirstOrDefault()
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default");

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("Provide a connection string argument or set ConnectionStrings__Default.");
    return 1;
}

string migrationsDir = Path.Combine(FindRepoRoot(), "src", "JojoRpg.Data", "Database", "Migrations");
Environment.SetEnvironmentVariable("JOJO_MIGRATIONS", migrationsDir);
DbUpRunner.Migrate(connectionString);
Console.WriteLine("Database migrations applied.");
return 0;

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
