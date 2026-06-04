using DbUp;
using DbUp.Engine;
using Microsoft.Data.Sqlite;

namespace RatLiveMain.Bootstrap;

static class DatabaseBootstrapper
{
    public static void EnsureDatabaseSchema(string repoRoot, string dbPath, string connectionString)
    {
        var ddlPath = Path.Combine(repoRoot, "sqlite_ddl_v1.sql");
        var seedPath = Path.Combine(repoRoot, "sqlite_seed_v1.sql");

        if (!File.Exists(ddlPath) || !File.Exists(seedPath))
        {
            throw new FileNotFoundException("sqlite_ddl_v1.sql oder sqlite_seed_v1.sql wurde im Repo-Root nicht gefunden.");
        }

        Directory.CreateDirectory(Path.GetDirectoryName(dbPath) ?? repoRoot);

        if (!File.Exists(dbPath))
        {
            using var bootstrapConnection = new SqliteConnection(connectionString);
            bootstrapConnection.Open();
        }

        var ddlScript = new SqlScript(Path.GetFileName(ddlPath), File.ReadAllText(ddlPath));

        var upgrader = DeployChanges.To
            .SqliteDatabase(connectionString)
            .WithScripts([ddlScript])
            .Build();

        var result = upgrader.PerformUpgrade();
        if (!result.Successful)
        {
            throw new InvalidOperationException("DB-Initialisierung fehlgeschlagen", result.Error);
        }

        // Seed wird absichtlich direkt ausgefuehrt, damit Platzhalter-Hashes mit '$...$' nicht
        // durch DbUp-Variablenersetzung fehlinterpretiert werden.
        using var connection = new SqliteConnection(connectionString);
        connection.Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = File.ReadAllText(seedPath);
        cmd.ExecuteNonQuery();
    }
}
