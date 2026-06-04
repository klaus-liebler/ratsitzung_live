using Dapper;
using System.Security.Claims;
using Microsoft.Data.Sqlite;
using RatLiveMain.Auth;
using RatLiveMain.Data;
using RatLiveMain.Sessions;

namespace RatLiveMain.Endpoints;

sealed class ContributionShareDto
{
    public string FractionName { get; init; } = string.Empty;
    public string FractionColorRgb { get; init; } = "128,128,128";
    public long TotalSeconds { get; set; }
}

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
        group.MapGet("/{sessionId:int}/chair/speech-requests", ChairSpeechRequests);
        group.MapPost("/{sessionId:int}/chair/speech-requests", ChairCreateSpeechRequest);
        group.MapPost("/{sessionId:int}/chair/speech-requests/{userId:int}/play", ChairPlaySpeechRequest);
        group.MapPost("/{sessionId:int}/chair/speech-requests/{userId:int}/pause", ChairPauseSpeechRequest);
        group.MapPost("/{sessionId:int}/chair/speech-requests/{userId:int}/stop", ChairStopSpeechRequest);
        group.MapPost("/{sessionId:int}/chair/speech-requests/{userId:int}/move-top", ChairMoveSpeechRequestTop);
        group.MapPost("/{sessionId:int}/chair/speech-requests/{userId:int}/move-up", ChairMoveSpeechRequestUp);
        group.MapPost("/{sessionId:int}/chair/speech-requests/{userId:int}/move-down", ChairMoveSpeechRequestDown);
        group.MapDelete("/{sessionId:int}/chair/speech-requests/{userId:int}", ChairDeleteSpeechRequest);
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
                s.opened_dt AS OpenedDt,
                s.start_dt AS StartDt,
                s.start_user_id AS StartUserId,
                (starter.first_name || ' ' || starter.last_name) AS OpenedByDisplayName,
                (
                    SELECT COUNT(1)
                    FROM attendances a
                    WHERE a.session_id = s.id AND a.end_dt IS NULL
                ) AS ActiveParticipants,
                EXISTS(
                    SELECT 1
                    FROM attendances a
                    WHERE a.session_id = s.id AND a.user_id = @userId AND a.end_dt IS NULL
                ) AS IsJoined,
                CASE
                    WHEN s.start_user_id = @userId THEN 1
                    WHEN EXISTS(
                        SELECT 1
                        FROM user_role_assignments ura
                        INNER JOIN roles r ON r.id = ura.role_id
                        WHERE ura.user_id = @userId
                          AND r.role_key = 'system_admin'
                          AND ura.scope_type = 'GLOBAL'
                          AND ura.revoked_at IS NULL
                          AND (ura.valid_to IS NULL OR ura.valid_to >= datetime('now'))
                    ) THEN 1
                    ELSE 0
                END AS CanManageSession
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

        var stopped = speechRequests.StopAndRemove(sessionId, userId);
        if (stopped.Contribution is not null)
        {
            await CloseContribution(connection, stopped.Contribution.ContributionId, stopped.Contribution.StartedAtUtc, tx);
        }

        await tx.CommitAsync();

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
                f.name AS FractionName,
                a.start_dt AS JoinedAt,
                0 AS HasSpeechRequest
            FROM attendances a
            INNER JOIN users u ON u.id = a.user_id
            LEFT JOIN user_details_council udc ON udc.user_id = u.id
            LEFT JOIN fractions f ON f.id = udc.fraction_id
            WHERE a.session_id = @sessionId
              AND a.end_dt IS NULL
            ORDER BY a.start_dt ASC, u.id ASC
        """, new { sessionId })).ToList();

        var activeUserIds = participants.Select(p => p.UserId).ToList();
        speechRequests.RemoveStaleRequests(sessionId, activeUserIds);
        var requestingUsers = speechRequests.GetRequestingUsers(sessionId);
        var queueSnapshot = speechRequests.GetSnapshot(sessionId);

        var result = participants.Select(p => new SessionParticipantDto
        {
            UserId = p.UserId,
            Username = p.Username,
            DisplayName = p.DisplayName,
            FractionName = p.FractionName,
            JoinedAt = p.JoinedAt,
            HasSpeechRequest = requestingUsers.Contains(p.UserId)
        }).ToList();

        return Results.Ok(new
        {
            sessionId,
            myUserId = userId,
            hasMySpeechRequest = requestingUsers.Contains(userId),
            activeSpeakerUserId = queueSnapshot.ActiveUserId,
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
                            AND s.start_dt IS NOT NULL
        """, new { sessionId, userId });

        if (joinedInOpenSession == 0)
        {
                        return Results.BadRequest(new { error = "Wortmeldung erst nach Sitzungsstart in aktiver, beigetretener Sitzung moeglich." });
        }

        var hasRequest = speechRequests.Toggle(sessionId, userId);
        return Results.Ok(new { ok = true, hasSpeechRequest = hasRequest });
    }

    private static async Task<IResult> ChairState(int sessionId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        var active = speechRequests.GetActiveContribution(sessionId);
        var contributionShares = await LoadContributionShares(connection, sessionId, active);
        var currentSpeaker = await LoadUserDisplay(connection, active?.UserId);

        return Results.Ok(new
        {
            sessionId,
            access.SessionStartDt,
            access.SessionOpenedDt,
            isStarted = access.IsStarted,
            durationSeconds = access.DurationSeconds,
            committeeName = access.CommitteeName,
            canManageSession = access.CanManageSession,
            currentSpeakerUserId = active?.UserId,
            currentSpeakerUsername = currentSpeaker?.Username,
            currentSpeakerDisplayName = currentSpeaker?.DisplayName,
            contributionShares
        });
    }

    private static async Task<IResult> ChairSpeechRequests(int sessionId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        var participants = (await connection.QueryAsync<(int UserId, string Username, string DisplayName, string? FractionName)>("""
            SELECT
                u.id AS UserId,
                u.name AS Username,
                (u.first_name || ' ' || u.last_name) AS DisplayName,
                f.name AS FractionName
            FROM attendances a
            INNER JOIN users u ON u.id = a.user_id
            LEFT JOIN user_details_council udc ON udc.user_id = u.id
            LEFT JOIN fractions f ON f.id = udc.fraction_id
            WHERE a.session_id = @sessionId
              AND a.end_dt IS NULL
        """, new { sessionId })).ToList();

        var activeUserIds = participants.Select(p => p.UserId).ToList();
        speechRequests.RemoveStaleRequests(sessionId, activeUserIds);

        var byUserId = participants.ToDictionary(p => p.UserId, p => p);
        var snapshot = speechRequests.GetSnapshot(sessionId);
        var ordered = snapshot.Items
            .Where(r => byUserId.ContainsKey(r.UserId))
            .Select(r => new
            {
                userId = r.UserId,
                username = byUserId[r.UserId].Username,
                displayName = byUserId[r.UserId].DisplayName,
                fractionName = byUserId[r.UserId].FractionName,
                requestedAt = r.RequestedAt,
                state = r.State.ToString().ToLowerInvariant(),
                isActive = snapshot.ActiveUserId == r.UserId
            })
            .ToList();

        return Results.Ok(new
        {
            sessionId,
            activeUserId = snapshot.ActiveUserId,
            requests = ordered
        });
    }

    private static async Task<IResult> ChairCreateSpeechRequest(int sessionId, CreateSpeechRequestForUserRequest request, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        if (!access.IsStarted)
        {
            return Results.BadRequest(new { error = "Wortmeldungen koennen erst nach Sitzungsstart erstellt werden." });
        }

        if (request.UserId <= 0)
        {
            return Results.BadRequest(new { error = "userId ist erforderlich." });
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        var isJoined = await connection.ExecuteScalarAsync<int>("""
            SELECT COUNT(1)
            FROM attendances a
            INNER JOIN committee_sessions s ON s.id = a.session_id
            WHERE a.session_id = @sessionId
              AND a.user_id = @userId
              AND a.end_dt IS NULL
              AND s.end_dt IS NULL
        """, new { sessionId, userId = request.UserId });

        if (isJoined == 0)
        {
            return Results.BadRequest(new { error = "Wortmeldung kann nur fuer beigetretene Benutzer erstellt werden." });
        }

        var created = speechRequests.Add(sessionId, request.UserId);
        return Results.Ok(new { ok = true, created, alreadyRequested = !created });
    }

    private static async Task<IResult> ChairPlaySpeechRequest(int sessionId, int userId, PlaySpeechRequest? request, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        if (!access.IsStarted)
        {
            return Results.BadRequest(new { error = "Sitzung ist noch nicht gestartet." });
        }

        if (userId <= 0)
        {
            return Results.BadRequest(new { error = "userId ist erforderlich." });
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        if (!await IsJoinedInActiveSession(connection, sessionId, userId))
        {
            return Results.BadRequest(new { error = "Wortmeldung kann nur fuer beigetretene Benutzer gestartet werden." });
        }

        var snapshot = speechRequests.GetSnapshot(sessionId);
        if (!snapshot.Items.Any(i => i.UserId == userId))
        {
            return Results.BadRequest(new { error = "Es gibt keine Wortmeldung fuer diesen Benutzer." });
        }

        if (snapshot.ActiveUserId == userId)
        {
            return Results.Ok(new { ok = true, alreadyActive = true });
        }

        if (snapshot.ActiveUserId is not null && request?.ForceStopCurrent != true)
        {
            return Results.BadRequest(new
            {
                error = "Ein anderer Redebeitrag ist aktiv. Bitte bestaetigen.",
                requiresConfirm = true,
                currentActiveUserId = snapshot.ActiveUserId
            });
        }

        await connection.OpenAsync();
        await using var tx = await connection.BeginTransactionAsync();

        if (snapshot.ActiveUserId is not null)
        {
            var paused = speechRequests.PauseActive(sessionId);
            if (paused is null)
            {
                await tx.RollbackAsync();
                return Results.Conflict(new { error = "Aktiver Redebeitrag konnte nicht sauber pausiert werden." });
            }

            await CloseContribution(connection, paused.ContributionId, paused.StartedAtUtc, tx);
        }

        var startedAt = DateTime.UtcNow;
        var contributionId = await OpenContribution(connection, sessionId, userId, startedAt, tx);
        var activated = speechRequests.Activate(sessionId, userId, contributionId, startedAt);
        if (!activated)
        {
            await connection.ExecuteAsync("DELETE FROM contributions WHERE contribution_id = @contributionId", new { contributionId }, tx);
            await tx.RollbackAsync();
            return Results.Conflict(new { error = "Wortmeldung konnte nicht aktiviert werden." });
        }

        await tx.CommitAsync();
        return Results.Ok(new { ok = true, activeUserId = userId });
    }

    private static async Task<IResult> ChairPauseSpeechRequest(int sessionId, int userId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        if (!speechRequests.IsUserActive(sessionId, userId))
        {
            return Results.BadRequest(new { error = "Der Benutzer ist aktuell nicht aktiv am Reden." });
        }

        var paused = speechRequests.PauseActive(sessionId);
        if (paused is null || paused.UserId != userId)
        {
            return Results.BadRequest(new { error = "Aktiver Redebeitrag konnte nicht pausiert werden." });
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        await CloseContribution(connection, paused.ContributionId, paused.StartedAtUtc);
        return Results.Ok(new { ok = true, pausedUserId = userId });
    }

    private static async Task<IResult> ChairStopSpeechRequest(int sessionId, int userId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        var result = speechRequests.StopAndRemove(sessionId, userId);
        if (!result.Removed)
        {
            return Results.NotFound(new { error = "Wortmeldung nicht gefunden." });
        }

        if (result.Contribution is not null)
        {
            await using var connection = new SqliteConnection(db.ConnectionString);
            await CloseContribution(connection, result.Contribution.ContributionId, result.Contribution.StartedAtUtc);
        }

        return Results.Ok(new { ok = true, stoppedUserId = userId });
    }

    private static async Task<IResult> ChairDeleteSpeechRequest(int sessionId, int userId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        return await ChairStopSpeechRequest(sessionId, userId, principal, db, speechRequests);
    }

    private static async Task<IResult> ChairMoveSpeechRequestTop(int sessionId, int userId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        var moved = speechRequests.MoveTop(sessionId, userId);
        return moved ? Results.Ok(new { ok = true }) : Results.NotFound(new { error = "Wortmeldung nicht gefunden." });
    }

    private static async Task<IResult> ChairMoveSpeechRequestUp(int sessionId, int userId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        var moved = speechRequests.MoveUp(sessionId, userId);
        return moved ? Results.Ok(new { ok = true }) : Results.NotFound(new { error = "Wortmeldung nicht gefunden." });
    }

    private static async Task<IResult> ChairMoveSpeechRequestDown(int sessionId, int userId, ClaimsPrincipal principal, AppDb db, SpeechRequestStore speechRequests)
    {
        var access = await GetChairAccess(sessionId, principal, db);
        if (!access.Ok)
        {
            return access.Result!;
        }

        var moved = speechRequests.MoveDown(sessionId, userId);
        return moved ? Results.Ok(new { ok = true }) : Results.NotFound(new { error = "Wortmeldung nicht gefunden." });
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

        var active = speechRequests.GetActiveContribution(sessionId);
        if (active is not null)
        {
            await CloseContribution(connection, active.ContributionId, active.StartedAtUtc, tx);
        }

        await tx.CommitAsync();

        speechRequests.ClearSession(sessionId);

        return Results.Ok(new { ok = true, ended = true });
    }

    private static async Task<(bool Ok, IResult? Result, string? SessionStartDt, string SessionOpenedDt, bool IsStarted, long DurationSeconds, string CommitteeName, bool CanManageSession)> GetChairAccess(
        int sessionId,
        ClaimsPrincipal principal,
        AppDb db)
    {
        if (!AuthTokenService.TryGetUserId(principal, out var userId))
        {
            return (false, Results.Unauthorized(), null, string.Empty, false, 0, string.Empty, false);
        }

        await using var connection = new SqliteConnection(db.ConnectionString);
        var data = await connection.QuerySingleOrDefaultAsync<(int StartUserId, string OpenedDt, string? StartDt, string CommitteeName, int IsOpen, int IsSystemAdmin)>("""
            SELECT
                s.start_user_id AS StartUserId,
                s.opened_dt AS OpenedDt,
                s.start_dt AS StartDt,
                c.name AS CommitteeName,
                CASE WHEN s.end_dt IS NULL THEN 1 ELSE 0 END AS IsOpen,
                CASE
                    WHEN EXISTS(
                        SELECT 1
                        FROM user_role_assignments ura
                        INNER JOIN roles r ON r.id = ura.role_id
                        WHERE ura.user_id = @userId
                          AND r.role_key = 'system_admin'
                          AND ura.scope_type = 'GLOBAL'
                          AND ura.revoked_at IS NULL
                          AND (ura.valid_to IS NULL OR ura.valid_to >= datetime('now'))
                    ) THEN 1
                    ELSE 0
                END AS IsSystemAdmin
            FROM committee_sessions s
            INNER JOIN committees c ON c.id = s.committee_id
            WHERE s.id = @sessionId
        """, new { sessionId, userId });

        if (data.StartUserId == 0)
        {
            return (false, Results.NotFound(new { error = "Sitzung nicht gefunden." }), null, string.Empty, false, 0, string.Empty, false);
        }

        if (data.IsOpen == 0)
        {
            return (false, Results.BadRequest(new { error = "Sitzung ist bereits beendet." }), data.StartDt, data.OpenedDt, data.StartDt is not null, 0, data.CommitteeName, false);
        }

        var canManageSession = data.StartUserId == userId || data.IsSystemAdmin > 0;

        if (!canManageSession)
        {
            return (false, Results.Forbid(), data.StartDt, data.OpenedDt, data.StartDt is not null, 0, data.CommitteeName, false);
        }

        long durationSeconds = 0;
        var isStarted = data.StartDt is not null;
        if (DateTime.TryParse(data.StartDt, out var startedAt))
        {
            durationSeconds = Math.Max(0, (long)(DateTime.UtcNow - DateTime.SpecifyKind(startedAt, DateTimeKind.Utc)).TotalSeconds);
        }

        return (true, null, data.StartDt, data.OpenedDt, isStarted, durationSeconds, data.CommitteeName, canManageSession);
    }

    private static async Task<bool> IsJoinedInActiveSession(SqliteConnection connection, int sessionId, int userId)
    {
        var count = await connection.ExecuteScalarAsync<int>("""
            SELECT COUNT(1)
            FROM attendances a
            INNER JOIN committee_sessions s ON s.id = a.session_id
            WHERE a.session_id = @sessionId
              AND a.user_id = @userId
              AND a.end_dt IS NULL
              AND s.end_dt IS NULL
        """, new { sessionId, userId });

        return count > 0;
    }

    private static async Task<long> OpenContribution(SqliteConnection connection, int sessionId, int userId, DateTime startedAtUtc, System.Data.Common.DbTransaction? tx = null)
    {
        var dt = startedAtUtc.ToString("yyyy-MM-dd HH:mm:ss");
        await connection.ExecuteAsync("""
            INSERT INTO contributions (user_id, session_id, start_dt, end_dt, length_seconds)
            VALUES (@userId, @sessionId, @dt, @dt, 0)
        """, new { userId, sessionId, dt }, tx);

        return await connection.ExecuteScalarAsync<long>("SELECT last_insert_rowid();", transaction: tx);
    }

    private static async Task CloseContribution(SqliteConnection connection, long contributionId, DateTime startedAtUtc, System.Data.Common.DbTransaction? tx = null)
    {
        var now = DateTime.UtcNow;
        var endDt = now.ToString("yyyy-MM-dd HH:mm:ss");
        var lengthSeconds = Math.Max(0, (long)(now - startedAtUtc).TotalSeconds);

        await connection.ExecuteAsync("""
            UPDATE contributions
            SET end_dt = @endDt,
                length_seconds = @lengthSeconds
            WHERE contribution_id = @contributionId
        """, new { contributionId, endDt, lengthSeconds }, tx);
    }

    private static async Task<(string Username, string DisplayName)?> LoadUserDisplay(SqliteConnection connection, int? userId)
    {
        if (userId is null)
        {
            return null;
        }

        return await connection.QuerySingleOrDefaultAsync<(string Username, string DisplayName)>("""
            SELECT
                u.name AS Username,
                (u.first_name || ' ' || u.last_name) AS DisplayName
            FROM users u
            WHERE u.id = @userId
        """, new { userId });
    }

    private static async Task<List<ContributionShareDto>> LoadContributionShares(SqliteConnection connection, int sessionId, ActiveContributionRef? active)
    {
        var shares = (await connection.QueryAsync<ContributionShareDto>("""
            SELECT
                f.name AS FractionName,
                COALESCE(NULLIF(f.color_rgb, ''), '128,128,128') AS FractionColorRgb,
                COALESCE(SUM(c.length_seconds), 0) AS TotalSeconds
            FROM contributions c
            INNER JOIN users u ON u.id = c.user_id
            INNER JOIN user_details_council udc ON udc.user_id = u.id
            INNER JOIN fractions f ON f.id = udc.fraction_id
            WHERE c.session_id = @sessionId
            GROUP BY f.name, f.color_rgb
        """, new { sessionId })).ToList();

        if (active is not null)
        {
            var extra = Math.Max(0, (long)(DateTime.UtcNow - active.StartedAtUtc).TotalSeconds);
            var activeFraction = await connection.QuerySingleOrDefaultAsync<(string FractionName, string FractionColorRgb)?>("""
                SELECT
                    f.name AS FractionName,
                    COALESCE(NULLIF(f.color_rgb, ''), '128,128,128') AS FractionColorRgb
                FROM users u
                INNER JOIN user_details_council udc ON udc.user_id = u.id
                INNER JOIN fractions f ON f.id = udc.fraction_id
                WHERE u.id = @userId
            """, new { userId = active.UserId });

            if (activeFraction is not null && !string.IsNullOrWhiteSpace(activeFraction.Value.FractionName))
            {
                var idx = shares.FindIndex(s => s.FractionName == activeFraction.Value.FractionName);
                if (idx >= 0)
                {
                    shares[idx].TotalSeconds += extra;
                }
                else
                {
                    shares.Add(new ContributionShareDto
                    {
                        FractionName = activeFraction.Value.FractionName,
                        FractionColorRgb = activeFraction.Value.FractionColorRgb,
                        TotalSeconds = extra
                    });
                }
            }
        }

        return shares.OrderByDescending(s => s.TotalSeconds).ThenBy(s => s.FractionName).ToList();
    }
}
