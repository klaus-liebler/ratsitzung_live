using Dapper;
using System.Security.Claims;
using Microsoft.Data.Sqlite;
using RatLiveMain.Auth;
using RatLiveMain.Data;
using RatLiveMain.Sessions;

namespace RatLiveMain.Endpoints;

static class SessionEndpoints
{
    public static IEndpointRouteBuilder MapSessionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/sessions").RequireAuthorization();

        group.MapGet("/active", Active);
        group.MapGet("/openable", Openable);
        group.MapPost("/open", Open);
        group.MapPost("/{sessionId:int}/join", Join);
        group.MapPost("/{sessionId:int}/leave", Leave);
        group.MapGet("/{sessionId:int}/participants", Participants);
        group.MapPost("/{sessionId:int}/speech-request/toggle", ToggleSpeechRequest);
        group.MapGet("/{sessionId:int}/chair/state", ChairState);
        group.MapPost("/{sessionId:int}/chair/start", ChairStart);
        group.MapPost("/{sessionId:int}/chair/end", ChairEnd);

        return app;
    }

    private static async Task<IResult> Active(ClaimsPrincipal principal, AppDb db)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return Results.Unauthorized();
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        var sessions = await connection.QueryAsync<ActiveSessionDto>("""
            SELECT
                s.id AS SessionId,
                s.committee_id AS CommitteeId,
                c.name AS CommitteeName,
                s.opened_dt AS StartDt,
                s.start_user_id AS StartUserId,
                (starter.first_name || ' ' || starter.last_name) AS StartedByDisplayName,
                (
                    SELECT COUNT(1)
                    FROM attendances a
                    WHERE a.session_id = s.id AND a.end_dt IS NULL
                ) AS ActiveParticipants,
                EXISTS(
                    SELECT 1
                    FROM attendances a
                    WHERE a.session_id = s.id AND a.user_id = @userId AND a.end_dt IS NULL
                ) AS IsJoined
            FROM committee_sessions s
            INNER JOIN committees c ON c.id = s.committee_id
            INNER JOIN users starter ON starter.id = s.start_user_id
            WHERE s.end_dt IS NULL
            ORDER BY s.opened_dt DESC, s.id DESC
        """, new { userId });

        return Results.Ok(sessions);
    }

    private static async Task<IResult> Join(int sessionId, ClaimsPrincipal principal, AppDb db)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return Results.Unauthorized();
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        await connection.OpenAsync();
        await using var tx = await connection.BeginTransactionAsync();

        var sessionExistsAndOpen = await connection.ExecuteScalarAsync<int>("""
            SELECT COUNT(1)
            FROM committee_sessions s
            WHERE s.id = @sessionId
              AND s.end_dt IS NULL
        """, new { sessionId }, tx);

        if (sessionExistsAndOpen == 0)
        {
            await tx.RollbackAsync();
            return Results.NotFound(new { error = "Sitzung nicht gefunden oder nicht aktiv." });
        }

        var hasOpenAttendance = await connection.ExecuteScalarAsync<int>("""
            SELECT COUNT(1)
            FROM attendances a
            WHERE a.session_id = @sessionId
              AND a.user_id = @userId
              AND a.end_dt IS NULL
        """, new { sessionId, userId }, tx);

        if (hasOpenAttendance > 0)
        {
            await tx.CommitAsync();
            return Results.Ok(new { ok = true, alreadyJoined = true });
        }

        await connection.ExecuteAsync("""
            INSERT INTO attendances (session_id, user_id, start_dt, end_dt)
            VALUES (@sessionId, @userId, datetime('now'), NULL)
        """, new { sessionId, userId }, tx);

        await tx.CommitAsync();
        return Results.Ok(new { ok = true, alreadyJoined = false });
    }

    private static async Task<IResult> Openable(ClaimsPrincipal principal, AppDb db)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return Results.Unauthorized();
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        var rows = await connection.QueryAsync<OpenableCommitteeDto>("""
            SELECT
                c.id AS CommitteeId,
                c.name AS CommitteeName
            FROM committees c
            WHERE c.committee_state = 'IN_DUTY'
              AND NOT EXISTS (
                SELECT 1
                FROM committee_sessions s
                WHERE s.committee_id = c.id
                  AND s.end_dt IS NULL
              )
              AND (
                EXISTS (
                    SELECT 1
                    FROM user_role_assignments ura
                    INNER JOIN role_rights rr ON rr.role_id = ura.role_id
                    INNER JOIN rights r ON r.id = rr.right_id
                    WHERE ura.user_id = @userId
                      AND r.right_key = 'session.open'
                      AND ura.scope_type = 'GLOBAL'
                      AND ura.revoked_at IS NULL
                      AND (ura.valid_to IS NULL OR ura.valid_to >= datetime('now'))
                )
                OR EXISTS (
                    SELECT 1
                    FROM user_role_assignments ura
                    INNER JOIN role_rights rr ON rr.role_id = ura.role_id
                    INNER JOIN rights r ON r.id = rr.right_id
                    WHERE ura.user_id = @userId
                      AND r.right_key = 'session.open'
                      AND ura.scope_type = 'COMMITTEE'
                      AND ura.committee_id = c.id
                      AND ura.revoked_at IS NULL
                      AND (ura.valid_to IS NULL OR ura.valid_to >= datetime('now'))
                )
              )
            ORDER BY c.name ASC
        """, new { userId });

        return Results.Ok(rows);
    }

    private static async Task<IResult> Open(OpenSessionRequest request, ClaimsPrincipal principal, AppDb db)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return Results.Unauthorized();
        }

        if (request.CommitteeId <= 0)
        {
            return Results.BadRequest(new { error = "committeeId ist erforderlich." });
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        await connection.OpenAsync();
        await using var tx = await connection.BeginTransactionAsync();

        var hasRight = await connection.ExecuteScalarAsync<int>("""
            SELECT COUNT(1)
            FROM user_role_assignments ura
            INNER JOIN role_rights rr ON rr.role_id = ura.role_id
            INNER JOIN rights r ON r.id = rr.right_id
            WHERE ura.user_id = @userId
              AND r.right_key = 'session.open'
              AND ura.revoked_at IS NULL
              AND (ura.valid_to IS NULL OR ura.valid_to >= datetime('now'))
              AND (
                ura.scope_type = 'GLOBAL'
                OR (ura.scope_type = 'COMMITTEE' AND ura.committee_id = @committeeId)
              )
        """, new { userId, committeeId = request.CommitteeId }, tx);

        if (hasRight == 0)
        {
            await tx.RollbackAsync();
            return Results.Forbid();
        }

        var alreadyOpen = await connection.ExecuteScalarAsync<int>("""
            SELECT COUNT(1)
            FROM committee_sessions s
            WHERE s.committee_id = @committeeId
              AND s.end_dt IS NULL
        """, new { committeeId = request.CommitteeId }, tx);

        if (alreadyOpen > 0)
        {
            await tx.RollbackAsync();
            return Results.BadRequest(new { error = "Fuer dieses Gremium ist bereits eine Sitzung offen." });
        }

        await connection.ExecuteAsync("""
            INSERT INTO committee_sessions (committee_id, opened_dt, start_dt, end_dt, start_user_id)
            VALUES (@committeeId, datetime('now'), NULL, NULL, @userId)
        """, new { committeeId = request.CommitteeId, userId }, tx);

        var sessionId = await connection.ExecuteScalarAsync<long>("SELECT last_insert_rowid();", transaction: tx);

        await connection.ExecuteAsync("""
            INSERT INTO attendances (session_id, user_id, start_dt, end_dt)
            VALUES (@sessionId, @userId, datetime('now'), NULL)
        """, new { sessionId, userId }, tx);

        await tx.CommitAsync();
        return Results.Ok(new { ok = true, sessionId });
    }

    private static async Task<IResult> Leave(int sessionId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return Results.Unauthorized();
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        await connection.OpenAsync();
        await using var tx = await connection.BeginTransactionAsync();

        var updated = await connection.ExecuteAsync("""
            UPDATE attendances
            SET end_dt = datetime('now')
            WHERE attendance_id = (
                SELECT attendance_id
                FROM attendances
                WHERE session_id = @sessionId
                  AND user_id = @userId
                  AND end_dt IS NULL
                ORDER BY start_dt DESC, attendance_id DESC
                LIMIT 1
            )
        """, new { sessionId, userId }, tx);

        await tx.CommitAsync();
        speechRequests.ClearUserRequest(sessionId, userId);

        return Results.Ok(new { ok = true, alreadyLeft = updated == 0 });
    }

    private static async Task<IResult> Participants(int sessionId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return Results.Unauthorized();
        }

        await using var connection = new SqliteConnection(db.ConnectionString);

        var isJoined = await connection.ExecuteScalarAsync<int>("""
            SELECT COUNT(1)
            FROM attendances
            WHERE session_id = @sessionId
              AND user_id = @userId
              AND end_dt IS NULL
        """, new { sessionId, userId });

        if (isJoined == 0)
        {
            return Results.Forbid();
        }

        var participants = (await connection.QueryAsync<SessionParticipantDto>("""
            SELECT
                u.id AS UserId,
                u.name AS Username,
                (u.first_name || ' ' || u.last_name) AS DisplayName,
                a.start_dt AS JoinedAt,
                0 AS HasSpeechRequest
            FROM attendances a
            INNER JOIN users u ON u.id = a.user_id
            WHERE a.session_id = @sessionId
              AND a.end_dt IS NULL
            ORDER BY a.start_dt ASC, u.id ASC
        """, new { sessionId })).ToList();

        var activeUserIds = participants.Select(p => p.UserId).ToList();
        speechRequests.RemoveStaleRequests(sessionId, activeUserIds);
        var requestingUsers = speechRequests.GetRequestingUsers(sessionId);

        var result = participants.Select(p => new SessionParticipantDto
        {
            UserId = p.UserId,
            Username = p.Username,
            DisplayName = p.DisplayName,
            JoinedAt = p.JoinedAt,
            HasSpeechRequest = requestingUsers.Contains(p.UserId)
        }).ToList();

        return Results.Ok(new
        {
            sessionId,
            myUserId = userId,
            hasMySpeechRequest = requestingUsers.Contains(userId),
            participants = result
        });
    }

    private static async Task<IResult> ToggleSpeechRequest(int sessionId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return Results.Unauthorized();
        }

        await using var connection = new SqliteConnection(db.ConnectionString);

        var joinedInOpenSession = await connection.ExecuteScalarAsync<int>("""
            SELECT COUNT(1)
            FROM attendances a
            INNER JOIN committee_sessions s ON s.id = a.session_id
            WHERE a.session_id = @sessionId
              AND a.user_id = @userId
              AND a.end_dt IS NULL
              AND s.end_dt IS NULL
        """, new { sessionId, userId });

        if (joinedInOpenSession == 0)
        {
            return Results.BadRequest(new { error = "Wortmeldung nur in aktiver, beigetretener Sitzung moeglich." });
        }

        var hasRequest = speechRequests.Toggle(sessionId, userId);
        return Results.Ok(new { ok = true, hasSpeechRequest = hasRequest });
    }

    private static async Task<IResult> ChairState(int sessionId, ClaimsPrincipal principal, AppDb db)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        return Results.Ok(new
        {
            sessionId,
            access.SessionStartDt,
            isStarted = access.IsStarted,
            durationSeconds = access.DurationSeconds,
            committeeName = access.CommitteeName
        });
    }

    private static async Task<IResult> ChairStart(int sessionId, ClaimsPrincipal principal, AppDb db)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        await connection.ExecuteAsync("""
            UPDATE committee_sessions
            SET start_dt = COALESCE(start_dt, datetime('now'))
            WHERE id = @sessionId
              AND end_dt IS NULL
        """, new { sessionId });

        return Results.Ok(new { ok = true, isStarted = true });
    }

    private static async Task<IResult> ChairEnd(int sessionId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        await connection.OpenAsync();
        await using var tx = await connection.BeginTransactionAsync();

        await connection.ExecuteAsync("""
            UPDATE committee_sessions
            SET end_dt = datetime('now')
            WHERE id = @sessionId
              AND end_dt IS NULL
        """, new { sessionId }, tx);

        await connection.ExecuteAsync("""
            UPDATE attendances
            SET end_dt = datetime('now')
            WHERE session_id = @sessionId
              AND end_dt IS NULL
        """, new { sessionId }, tx);

        await tx.CommitAsync();

        speechRequests.ClearSession(sessionId);

        return Results.Ok(new { ok = true, ended = true });
    }

    private static async Task<(bool Ok, IResult? Result, string? SessionStartDt, bool IsStarted, long DurationSeconds, string CommitteeName)> GetChairAccess(
        int sessionId,
        ClaimsPrincipal principal,
        AppDb db)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return (false, Results.Unauthorized(), null, false, 0, string.Empty);
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        var data = await connection.QuerySingleOrDefaultAsync<(int StartUserId, string? StartDt, string CommitteeName, int IsOpen)>("""
            SELECT
                s.start_user_id AS StartUserId,
                s.start_dt AS StartDt,
                c.name AS CommitteeName,
                CASE WHEN s.end_dt IS NULL THEN 1 ELSE 0 END AS IsOpen
            FROM committee_sessions s
            INNER JOIN committees c ON c.id = s.committee_id
            WHERE s.id = @sessionId
        """, new { sessionId });

        if (data.StartUserId == 0)
        {
            return (false, Results.NotFound(new { error = "Sitzung nicht gefunden." }), null, false, 0, string.Empty);
        }

        if (data.IsOpen == 0)
        {
            return (false, Results.BadRequest(new { error = "Sitzung ist bereits beendet." }), data.StartDt, data.StartDt is not null, 0, data.CommitteeName);
        }

        if (data.StartUserId != userId)
        {
            return (false, Results.Forbid(), data.StartDt, data.StartDt is not null, 0, data.CommitteeName);
        }

        long durationSeconds = 0;
        var isStarted = data.StartDt is not null;
        if (DateTime.TryParse(data.StartDt, out var startedAt))
        {
            durationSeconds = Math.Max(0, (long)(DateTime.UtcNow - DateTime.SpecifyKind(startedAt, DateTimeKind.Utc)).TotalSeconds);
        }

        return (true, null, data.StartDt, isStarted, durationSeconds, data.CommitteeName);
    }
}
