using Dapper;
using DbUp;
using DbUp.Engine;
using Microsoft.Data.Sqlite;
using RatLiveMain.Auth;

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

        // Runtime schema safety for existing DBs: introduce opened_dt for already created tables.
        var hasOpenedDt = connection.ExecuteScalar<long>("""
            SELECT COUNT(1)
            FROM pragma_table_info('committee_sessions')
            WHERE name = 'opened_dt'
        """);

        if (hasOpenedDt == 0)
        {
            connection.Execute("ALTER TABLE committee_sessions ADD COLUMN opened_dt TEXT;");
        }

        connection.Execute("""
            UPDATE committee_sessions
            SET opened_dt = COALESCE(opened_dt, start_dt, datetime('now'))
            WHERE opened_dt IS NULL
        """);
    }

    public static void NormalizeDemoPasswords(string connectionString, string demoInitialPassword)
    {
        var realHash = PasswordService.Hash(demoInitialPassword);

        using var connection = new SqliteConnection(connectionString);
        connection.Open();

        connection.Execute("""
            UPDATE users_localhost_credentials
            SET password_hash = @realHash,
                password_algo = 'argon2id',
                password_updated_dt = datetime('now')
            WHERE password_hash LIKE 'argon2id$demo$%'
        """, new { realHash });
    }
}
