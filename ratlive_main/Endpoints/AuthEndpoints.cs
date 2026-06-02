using Dapper;
using System.Security.Claims;
using Microsoft.Data.Sqlite;
using RatLiveMain.Auth;
using RatLiveMain.Data;
using RatLiveMain.Options;

namespace RatLiveMain.Endpoints;

static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/login", Login);
        group.MapGet("/me", Me).RequireAuthorization();
        group.MapPost("/change-password", ChangePassword).RequireAuthorization();

        return app;
    }

    private static async Task<IResult> Login(LoginRequest request, AppDb db, JwtOptions jwt, BootstrapOptions bootstrap)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest(new { error = "Benutzername und Passwort sind erforderlich." });
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        var user = await connection.QuerySingleOrDefaultAsync<LoginUser>("""
            SELECT
                u.id AS Id,
                u.name AS Username,
                u.first_name AS FirstName,
                u.last_name AS LastName,
                u.deactivation_dt AS DeactivationDt,
                c.password_hash AS PasswordHash,
                c.must_change_password AS MustChangePassword
            FROM users u
            INNER JOIN users_localhost_credentials c ON c.user_id = u.id
            WHERE u.namespace = 'localhost' AND lower(u.name) = lower(@username)
        """, new { username = request.Username.Trim() });

        if (user is null || user.DeactivationDt is not null)
        {
            return Results.Unauthorized();
        }

        if (!PasswordService.Verify(user.PasswordHash, request.Password, bootstrap.DemoInitialPassword))
        {
            return Results.Unauthorized();
        }

        var token = AuthTokenService.CreateToken(user, jwt);

        return Results.Ok(new LoginResponse(
            token,
            jwt.ExpiresInMinutes * 60,
            user.MustChangePassword,
            $"{user.FirstName} {user.LastName}"));
    }

    private static async Task<IResult> Me(ClaimsPrincipal principal, AppDb db)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return Results.Unauthorized();
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        var user = await connection.QuerySingleOrDefaultAsync<MeUser>("""
            SELECT
                u.id AS Id,
                u.name AS Username,
                u.first_name AS FirstName,
                u.last_name AS LastName,
                c.must_change_password AS MustChangePassword
            FROM users u
            INNER JOIN users_localhost_credentials c ON c.user_id = u.id
            WHERE u.id = @userId
        """, new { userId });

        var canOpenSession = await connection.ExecuteScalarAsync<int>("""
            SELECT COUNT(1)
            FROM user_role_assignments ura
            INNER JOIN role_rights rr ON rr.role_id = ura.role_id
            INNER JOIN rights r ON r.id = rr.right_id
            WHERE ura.user_id = @userId
              AND r.right_key = 'session.open'
              AND ura.revoked_at IS NULL
              AND (ura.valid_to IS NULL OR ura.valid_to >= datetime('now'))
        """, new { userId });

        return user is null
            ? Results.Unauthorized()
            : Results.Ok(new
            {
                user.Id,
                user.Username,
                DisplayName = $"{user.FirstName} {user.LastName}",
                user.MustChangePassword,
                CanOpenSession = canOpenSession > 0
            });
    }

    private static async Task<IResult> ChangePassword(ChangePasswordRequest request, ClaimsPrincipal principal, AppDb db)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return Results.Unauthorized();
        }

        var newPassword = request.NewPassword?.Trim() ?? string.Empty;
        if (!PasswordService.IsStrongEnough(newPassword))
        {
            return Results.BadRequest(new { error = "Neues Passwort ist zu schwach (mindestens 10 Zeichen, 1 Zahl, 1 Grossbuchstabe)." });
        }

        var hash = PasswordService.Hash(newPassword);

        await using var connection = new SqliteConnection(db.ConnectionString);
        await connection.ExecuteAsync("""
            UPDATE users_localhost_credentials
            SET password_hash = @hash,
                password_algo = 'argon2id',
                must_change_password = 0,
                password_updated_dt = datetime('now')
            WHERE user_id = @userId
        """, new { hash, userId });

        return Results.Ok(new { ok = true });
    }
}
