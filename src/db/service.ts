import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { initializeDatabase } from "./bootstrap";
import {
  type AttendanceEntry,
  type CommitteeName,
  type CommitteeSessionStatus,
  type CommitteeSummary,
  type CompletedSessionInfo,
  type DashboardState,
  type Faction,
  type Gender,
  type PersonRole,
  type Participant,
  type SessionSummary,
  type SpeechEntry,
  type SpeechStatus
} from "./types";

const dataDir = path.join(__dirname, "..", "..", "data");
const dbPath = path.join(dataDir, "ratsitzung.sqlite");
const defaultCommittees: CommitteeName[] = ["Fraktionssitzung", "Schulausschuss", "Kulturausschuss"];

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

initializeDatabase(db, defaultCommittees);

function getNowIso(): string {
  return new Date().toISOString();
}

function getCommitteeNameById(committeeId: number): string {
  const row = db
    .prepare(
      `
        SELECT name
        FROM committees
        WHERE id = ?
      `
    )
    .get(committeeId) as { name: string } | undefined;

  if (!row) {
    throw new Error("Committee not found");
  }

  return row.name;
}

function isChairForCommittee(token: string, committeeId: number): boolean {
  const row = db
    .prepare(
      `
        SELECT 1 as isChair
        FROM participants p
        INNER JOIN rats_member_committee_chairs c ON c.participant_token = p.token
        WHERE p.token = ? AND c.committee_id = ?
      `
    )
    .get(token, committeeId) as { isChair: number } | undefined;

  return Boolean(row);
}

function getAttendanceRows(sessionId: number): AttendanceEntry[] {
  const rows = db
    .prepare(
      `
        SELECT
          a.participant_token as participantToken,
          p.first_name as firstName,
          p.last_name as lastName,
          p.member_function as memberFunction,
          d.faction as faction,
          a.checked_in_at as checkedInAt,
          a.checked_out_at as checkedOutAt
        FROM committee_session_attendance a
        INNER JOIN participants p ON p.token = a.participant_token
        LEFT JOIN rats_member_details d ON d.participant_token = p.token
        WHERE a.session_id = ?
        ORDER BY a.checked_in_at ASC, p.last_name, p.first_name
      `
    )
    .all(sessionId) as Array<{
    participantToken: string;
    firstName: string;
    lastName: string;
    memberFunction: PersonRole;
    faction: Faction | null;
    checkedInAt: string;
    checkedOutAt: string | null;
  }>;

  return rows.map((row) => ({
    participantToken: row.participantToken,
    firstName: row.firstName,
    lastName: row.lastName,
    memberFunction: row.memberFunction,
    faction: row.faction,
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt
  }));
}

function getSpeechRows(sessionId: number): SpeechEntry[] {
  const now = Date.now();
  const rows = db
    .prepare(
      `
        SELECT
          s.id as speechId,
          s.session_id as sessionId,
          s.participant_token as participantToken,
          p.first_name as firstName,
          p.last_name as lastName,
          p.member_function as memberFunction,
          d.faction as faction,
          s.requested_by_token as requestedByToken,
          s.requested_at as requestedAt,
          s.finished_at as finishedAt,
          s.total_speaking_seconds as totalSpeakingSeconds,
          s.active_started_at as activeStartedAt,
          s.status as status,
          s.sequence_number as sequenceNumber
        FROM speech_requests s
        INNER JOIN participants p ON p.token = s.participant_token
        LEFT JOIN rats_member_details d ON d.participant_token = p.token
        WHERE s.session_id = ?
        ORDER BY s.sequence_number ASC, s.id ASC
      `
    )
    .all(sessionId) as Array<{
    speechId: number;
    sessionId: number;
    participantToken: string;
    firstName: string;
    lastName: string;
    memberFunction: PersonRole;
    faction: Faction | null;
    requestedByToken: string;
    requestedAt: string;
    finishedAt: string | null;
    totalSpeakingSeconds: number;
    activeStartedAt: string | null;
    status: SpeechStatus;
    sequenceNumber: number;
  }>;

  return rows.map((row) => {
    const activeStartedAt = row.activeStartedAt ? Date.parse(row.activeStartedAt) : null;
    const activeSeconds = row.status === "ACTIVE" && activeStartedAt ? Math.max(0, Math.floor((now - activeStartedAt) / 1000)) : 0;

    return {
      speechId: row.speechId,
      sessionId: row.sessionId,
      participantToken: row.participantToken,
      firstName: row.firstName,
      lastName: row.lastName,
      memberFunction: row.memberFunction,
      faction: row.faction,
      requestedByToken: row.requestedByToken,
      requestedAt: row.requestedAt,
      finishedAt: row.finishedAt,
      totalSpeakingSeconds: row.totalSpeakingSeconds,
      activeStartedAt: row.activeStartedAt,
      status: row.status,
      sequenceNumber: row.sequenceNumber,
      effectiveSpeakingSeconds: row.totalSpeakingSeconds + activeSeconds
    };
  });
}

export function getSessionSummary(sessionId: number): SessionSummary | undefined {
  const row = db
    .prepare(
      `
        SELECT
          s.id as sessionId,
          s.committee_id as committeeId,
          c.name as committeeName,
          s.status as status,
          s.started_at as startedAt,
          s.stopped_at as stoppedAt,
          s.started_by_token as startedByToken,
          s.stopped_by_token as stoppedByToken
        FROM committee_sessions s
        INNER JOIN committees c ON c.id = s.committee_id
        WHERE s.id = ?
      `
    )
    .get(sessionId) as
    | {
        sessionId: number;
        committeeId: number;
        committeeName: string;
        status: CommitteeSessionStatus;
        startedAt: string;
        stoppedAt: string | null;
        startedByToken: string;
        stoppedByToken: string | null;
      }
    | undefined;

  if (!row) {
    return undefined;
  }

  return {
    sessionId: row.sessionId,
    committeeId: row.committeeId,
    committeeName: row.committeeName,
    status: row.status,
    startedAt: row.startedAt,
    stoppedAt: row.stoppedAt,
    startedByToken: row.startedByToken,
    stoppedByToken: row.stoppedByToken,
    attendees: getAttendanceRows(sessionId),
    speeches: getSpeechRows(sessionId)
  };
}

export function getCompletedSessions(): CompletedSessionInfo[] {
  const rows = db
    .prepare(
      `
        SELECT
          s.id as sessionId,
          s.committee_id as committeeId,
          c.name as committeeName,
          s.started_at as startedAt,
          s.stopped_at as stoppedAt
        FROM committee_sessions s
        INNER JOIN committees c ON c.id = s.committee_id
        WHERE s.status = 'STOPPED' AND s.stopped_at IS NOT NULL
        ORDER BY s.stopped_at DESC, s.id DESC
      `
    )
    .all() as Array<{
    sessionId: number;
    committeeId: number;
    committeeName: string;
    startedAt: string;
    stoppedAt: string;
  }>;

  return rows.map((row) => ({
    sessionId: row.sessionId,
    committeeId: row.committeeId,
    committeeName: row.committeeName,
    startedAt: row.startedAt,
    stoppedAt: row.stoppedAt
  }));
}

function getRunningSessionSummaries(): SessionSummary[] {
  const rows = db
    .prepare(
      `
        SELECT id
        FROM committee_sessions
        WHERE status = 'RUNNING'
        ORDER BY started_at ASC, id ASC
      `
    )
    .all() as Array<{ id: number }>;

  return rows.map((row) => getSessionSummary(row.id)).filter((row): row is SessionSummary => Boolean(row));
}

function getActiveSessionForCommittee(committeeId: number): SessionSummary | null {
  const row = db
    .prepare(
      `
        SELECT id
        FROM committee_sessions
        WHERE committee_id = ? AND status = 'RUNNING'
        ORDER BY started_at DESC, id DESC
        LIMIT 1
      `
    )
    .get(committeeId) as { id: number } | undefined;

  if (!row) {
    return null;
  }

  return getSessionSummary(row.id) ?? null;
}

export function getChairedCommittees(token: string): CommitteeSummary[] {
  const rows = db
    .prepare(
      `
        SELECT
          c.id as committeeId,
          c.name as committeeName
        FROM rats_member_committee_chairs chair
        INNER JOIN committees c ON c.id = chair.committee_id
        WHERE chair.participant_token = ?
        ORDER BY c.name ASC
      `
    )
    .all(token) as Array<{
    committeeId: number;
    committeeName: string;
  }>;

  return rows.map((row) => ({
    committeeId: row.committeeId,
    committeeName: row.committeeName,
    activeSession: getActiveSessionForCommittee(row.committeeId)
  }));
}

export function getDashboardState(token: string): DashboardState {
  const participant = findParticipantByToken(token);
  if (!participant) {
    throw new Error("Participant not found");
  }

  return {
    participant,
    chairedCommittees: getChairedCommittees(token),
    runningSessions: getRunningSessionSummaries()
  };
}

function requireParticipantExists(token: string): Participant {
  const participant = findParticipantByToken(token);
  if (!participant) {
    throw new Error("Participant not found");
  }

  return participant;
}

function requireRunningSession(sessionId: number): { sessionId: number; committeeId: number } {
  const row = db
    .prepare(
      `
        SELECT id as sessionId, committee_id as committeeId
        FROM committee_sessions
        WHERE id = ? AND status = 'RUNNING'
      `
    )
    .get(sessionId) as { sessionId: number; committeeId: number } | undefined;

  if (!row) {
    throw new Error("Running session not found");
  }

  return row;
}

function requireSpeechContext(speechId: number): { speechId: number; sessionId: number; committeeId: number; participantToken: string; status: SpeechStatus } {
  const row = db
    .prepare(
      `
        SELECT
          s.id as speechId,
          s.session_id as sessionId,
          cs.committee_id as committeeId,
          s.participant_token as participantToken,
          s.status as status
        FROM speech_requests s
        INNER JOIN committee_sessions cs ON cs.id = s.session_id
        WHERE s.id = ?
      `
    )
    .get(speechId) as
    | {
        speechId: number;
        sessionId: number;
        committeeId: number;
        participantToken: string;
        status: SpeechStatus;
      }
    | undefined;

  if (!row) {
    throw new Error("Speech not found");
  }

  return row;
}

function requireChairPermission(token: string, committeeId: number): Participant {
  const participant = requireParticipantExists(token);
  if (participant.memberFunction !== "Ratsmitglied" || !isChairForCommittee(token, committeeId)) {
    throw new Error("Not authorized as chair");
  }

  return participant;
}

function getNextSequenceNumber(sessionId: number): number {
  const row = db
    .prepare(
      `
        SELECT COALESCE(MAX(sequence_number), 0) + 1 as nextSequence
        FROM speech_requests
        WHERE session_id = ? AND status IN ('REQUESTED', 'ACTIVE', 'PAUSED')
      `
    )
    .get(sessionId) as { nextSequence: number } | undefined;

  return row?.nextSequence ?? 1;
}

function isParticipantCheckedIn(sessionId: number, participantToken: string): boolean {
  const row = db
    .prepare(
      `
        SELECT 1 as isCheckedIn
        FROM committee_session_attendance
        WHERE session_id = ? AND participant_token = ? AND checked_out_at IS NULL
      `
    )
    .get(sessionId, participantToken) as { isCheckedIn: number } | undefined;

  return Boolean(row);
}

function getSessionAttendanceRow(sessionId: number, participantToken: string): { checkedInAt: string; checkedOutAt: string | null } | undefined {
  const row = db
    .prepare(
      `
        SELECT checked_in_at as checkedInAt, checked_out_at as checkedOutAt
        FROM committee_session_attendance
        WHERE session_id = ? AND participant_token = ?
      `
    )
    .get(sessionId, participantToken) as { checkedInAt: string; checkedOutAt: string | null } | undefined;

  return row;
}

function getSpeechRecord(speechId: number): SpeechEntry {
  const rows = db
    .prepare(
      `
        SELECT
          s.id as speechId,
          s.session_id as sessionId,
          s.participant_token as participantToken,
          p.first_name as firstName,
          p.last_name as lastName,
          p.member_function as memberFunction,
          d.faction as faction,
          s.requested_by_token as requestedByToken,
          s.requested_at as requestedAt,
          s.finished_at as finishedAt,
          s.total_speaking_seconds as totalSpeakingSeconds,
          s.active_started_at as activeStartedAt,
          s.status as status,
          s.sequence_number as sequenceNumber
        FROM speech_requests s
        INNER JOIN participants p ON p.token = s.participant_token
        LEFT JOIN rats_member_details d ON d.participant_token = p.token
        WHERE s.id = ?
      `
    )
    .get(speechId) as
    | {
        speechId: number;
        sessionId: number;
        participantToken: string;
        firstName: string;
        lastName: string;
        memberFunction: PersonRole;
        faction: Faction | null;
        requestedByToken: string;
        requestedAt: string;
        finishedAt: string | null;
        totalSpeakingSeconds: number;
        activeStartedAt: string | null;
        status: SpeechStatus;
        sequenceNumber: number;
      }
    | undefined;

  if (!rows) {
    throw new Error("Speech not found");
  }

  const activeStartedAt = rows.activeStartedAt ? Date.parse(rows.activeStartedAt) : null;
  const activeSeconds = rows.status === "ACTIVE" && activeStartedAt ? Math.max(0, Math.floor((Date.now() - activeStartedAt) / 1000)) : 0;

  return {
    speechId: rows.speechId,
    sessionId: rows.sessionId,
    participantToken: rows.participantToken,
    firstName: rows.firstName,
    lastName: rows.lastName,
    memberFunction: rows.memberFunction,
    faction: rows.faction,
    requestedByToken: rows.requestedByToken,
    requestedAt: rows.requestedAt,
    finishedAt: rows.finishedAt,
    totalSpeakingSeconds: rows.totalSpeakingSeconds,
    activeStartedAt: rows.activeStartedAt,
    status: rows.status,
    sequenceNumber: rows.sequenceNumber,
    effectiveSpeakingSeconds: rows.totalSpeakingSeconds + activeSeconds
  };
}

function resequenceSessionSpeeches(sessionId: number): void {
  const rows = db
    .prepare(
      `
        SELECT id
        FROM speech_requests
        WHERE session_id = ? AND status IN ('REQUESTED', 'ACTIVE', 'PAUSED')
        ORDER BY sequence_number ASC, id ASC
      `
    )
    .all(sessionId) as Array<{ id: number }>;

  const update = db.prepare(
    `
      UPDATE speech_requests
      SET sequence_number = ?
      WHERE id = ?
    `
  );

  rows.forEach((row, index) => {
    update.run(index + 1, row.id);
  });
}

export function startCommitteeSession(committeeId: number, chairToken: string): SessionSummary {
  const participant = requireChairPermission(chairToken, committeeId);

  const existing = db
    .prepare(
      `
        SELECT id
        FROM committee_sessions
        WHERE committee_id = ? AND status = 'RUNNING'
      `
    )
    .get(committeeId) as { id: number } | undefined;

  if (existing) {
    throw new Error("Committee session already running");
  }

  const startedAt = getNowIso();
  const insertSession = db.prepare(
    `
      INSERT INTO committee_sessions (committee_id, status, started_at, started_by_token)
      VALUES (?, 'RUNNING', ?, ?)
    `
  );

  const insertAttendance = db.prepare(
    `
      INSERT INTO committee_session_attendance (session_id, participant_token, checked_in_at)
      VALUES (?, ?, ?)
    `
  );

  const sessionId = db.transaction(() => {
    const result = insertSession.run(committeeId, startedAt, chairToken);
    const sessionIdValue = Number(result.lastInsertRowid);
    insertAttendance.run(sessionIdValue, participant.token, startedAt);
    return sessionIdValue;
  })();

  const session = getSessionSummary(sessionId);
  if (!session) {
    throw new Error("Unable to load created session");
  }

  return session;
}

export function stopCommitteeSession(sessionId: number, chairToken: string): SessionSummary {
  const session = requireRunningSession(sessionId);
  requireChairPermission(chairToken, session.committeeId);

  const stoppedAt = getNowIso();
  const updateSession = db.prepare(
    `
      UPDATE committee_sessions
      SET status = 'STOPPED', stopped_at = ?, stopped_by_token = ?
      WHERE id = ?
    `
  );

  const updateAttendance = db.prepare(
    `
      UPDATE committee_session_attendance
      SET checked_out_at = COALESCE(checked_out_at, ?)
      WHERE session_id = ? AND checked_out_at IS NULL
    `
  );

  const finishActiveSpeeches = db.prepare(
    `
      UPDATE speech_requests
      SET
        status = 'FINISHED',
        finished_at = ?,
        total_speaking_seconds = total_speaking_seconds + CASE
          WHEN active_started_at IS NULL THEN 0
          ELSE CAST((julianday(?) - julianday(active_started_at)) * 86400 AS INTEGER)
        END,
        active_started_at = NULL
      WHERE session_id = ? AND status = 'ACTIVE'
    `
  );

  db.transaction(() => {
    updateSession.run(stoppedAt, chairToken, sessionId);
    updateAttendance.run(stoppedAt, sessionId);
    finishActiveSpeeches.run(stoppedAt, stoppedAt, sessionId);
  })();

  const updated = getSessionSummary(sessionId);
  if (!updated) {
    throw new Error("Unable to load stopped session");
  }

  return updated;
}

export function checkInParticipant(sessionId: number, participantToken: string): AttendanceEntry {
  requireRunningSession(sessionId);
  requireParticipantExists(participantToken);

  const checkedInAt = getNowIso();
  db.prepare(
    `
      INSERT INTO committee_session_attendance (session_id, participant_token, checked_in_at, checked_out_at)
      VALUES (?, ?, ?, NULL)
      ON CONFLICT(session_id, participant_token)
      DO UPDATE SET checked_in_at = excluded.checked_in_at, checked_out_at = NULL
    `
  ).run(sessionId, participantToken, checkedInAt);

  const row = getSessionAttendanceRow(sessionId, participantToken);
  if (!row) {
    throw new Error("Attendance record missing");
  }

  const participant = requireParticipantExists(participantToken);
  return {
    participantToken,
    firstName: participant.firstName,
    lastName: participant.lastName,
    memberFunction: participant.memberFunction,
    faction: participant.faction,
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt
  };
}

export function checkOutParticipant(sessionId: number, participantToken: string): AttendanceEntry {
  requireRunningSession(sessionId);
  requireParticipantExists(participantToken);

  const checkedOutAt = getNowIso();
  const result = db.prepare(
    `
      UPDATE committee_session_attendance
      SET checked_out_at = ?
      WHERE session_id = ? AND participant_token = ? AND checked_out_at IS NULL
    `
  ).run(checkedOutAt, sessionId, participantToken);

  if (result.changes === 0) {
    throw new Error("Participant is not checked in");
  }

  const row = getSessionAttendanceRow(sessionId, participantToken);
  if (!row) {
    throw new Error("Attendance record missing");
  }

  const participant = requireParticipantExists(participantToken);
  return {
    participantToken,
    firstName: participant.firstName,
    lastName: participant.lastName,
    memberFunction: participant.memberFunction,
    faction: participant.faction,
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt
  };
}

export function requestSpeech(sessionId: number, participantToken: string, requestedByToken: string): SpeechEntry {
  requireRunningSession(sessionId);
  requireParticipantExists(participantToken);
  requireParticipantExists(requestedByToken);

  if (!isParticipantCheckedIn(sessionId, participantToken)) {
    throw new Error("Participant must be checked in");
  }

  const existing = db
    .prepare(
      `
        SELECT id
        FROM speech_requests
        WHERE session_id = ? AND participant_token = ? AND status IN ('REQUESTED', 'ACTIVE', 'PAUSED')
      `
    )
    .get(sessionId, participantToken) as { id: number } | undefined;

  if (existing) {
    throw new Error("Speech request already exists");
  }

  const now = getNowIso();
  const nextSequence = getNextSequenceNumber(sessionId);
  const result = db.prepare(
    `
      INSERT INTO speech_requests (
        session_id,
        participant_token,
        requested_by_token,
        requested_at,
        total_speaking_seconds,
        active_started_at,
        status,
        sequence_number
      ) VALUES (?, ?, ?, ?, 0, NULL, 'REQUESTED', ?)
    `
  ).run(sessionId, participantToken, requestedByToken, now, nextSequence);

  return getSpeechRecord(Number(result.lastInsertRowid));
}

export function addSpeechOnBehalf(sessionId: number, chairToken: string, participantToken: string): SpeechEntry {
  const session = requireRunningSession(sessionId);
  requireChairPermission(chairToken, session.committeeId);
  return requestSpeech(sessionId, participantToken, chairToken);
}

export function withdrawSpeech(sessionId: number, participantToken: string): SpeechEntry {
  requireRunningSession(sessionId);

  const row = db
    .prepare(
      `
        SELECT id, status
        FROM speech_requests
        WHERE session_id = ? AND participant_token = ? AND status IN ('REQUESTED', 'PAUSED')
        ORDER BY sequence_number ASC, id ASC
        LIMIT 1
      `
    )
    .get(sessionId, participantToken) as { id: number; status: SpeechStatus } | undefined;

  if (!row) {
    throw new Error("No withdrawable speech found");
  }

  db.prepare(
    `
      UPDATE speech_requests
      SET status = 'WITHDRAWN', finished_at = ?, active_started_at = NULL
      WHERE id = ?
    `
  ).run(getNowIso(), row.id);

  resequenceSessionSpeeches(sessionId);
  return getSpeechRecord(row.id);
}

export function deleteSpeech(speechId: number, chairToken: string): SpeechEntry {
  const context = requireSpeechContext(speechId);
  requireChairPermission(chairToken, context.committeeId);

  if (context.status === "ACTIVE") {
    throw new Error("Active speeches must be paused or finished before deletion");
  }

  db.prepare(
    `
      UPDATE speech_requests
      SET status = 'DELETED', finished_at = COALESCE(finished_at, ?), active_started_at = NULL
      WHERE id = ?
    `
  ).run(getNowIso(), speechId);

  resequenceSessionSpeeches(context.sessionId);
  return getSpeechRecord(speechId);
}

export function moveSpeech(speechId: number, chairToken: string, direction: "up" | "down" | "top"): SpeechEntry[] {
  const context = requireSpeechContext(speechId);
  requireChairPermission(chairToken, context.committeeId);

  const rows = db
    .prepare(
      `
        SELECT id, status, sequence_number as sequenceNumber
        FROM speech_requests
        WHERE session_id = ? AND status IN ('REQUESTED', 'ACTIVE', 'PAUSED')
        ORDER BY sequence_number ASC, id ASC
      `
    )
    .all(context.sessionId) as Array<{ id: number; status: SpeechStatus; sequenceNumber: number }>;

  const currentIndex = rows.findIndex((row) => row.id === speechId);
  if (currentIndex === -1) {
    throw new Error("Speech not found in queue");
  }

  if (rows[currentIndex].status === "FINISHED") {
    throw new Error("Finished speeches cannot be moved");
  }

  let targetIndex = currentIndex;
  if (direction === "up") {
    targetIndex = Math.max(0, currentIndex - 1);
  } else if (direction === "down") {
    targetIndex = Math.min(rows.length - 1, currentIndex + 1);
  } else {
    targetIndex = 0;
  }

  if (targetIndex === currentIndex) {
    return rows.map((row) => getSpeechRecord(row.id));
  }

  const [moved] = rows.splice(currentIndex, 1);
  rows.splice(targetIndex, 0, moved);

  const update = db.prepare(
    `
      UPDATE speech_requests
      SET sequence_number = ?
      WHERE id = ?
    `
  );

  db.transaction(() => {
    rows.forEach((row, index) => update.run(index + 1, row.id));
  })();

  return rows.map((row) => getSpeechRecord(row.id));
}

export function startSpeech(speechId: number, chairToken: string): SpeechEntry {
  const context = requireSpeechContext(speechId);
  requireChairPermission(chairToken, context.committeeId);

  const activeSpeech = db
    .prepare(
      `
        SELECT id
        FROM speech_requests
        WHERE session_id = ? AND status = 'ACTIVE'
      `
    )
    .get(context.sessionId) as { id: number } | undefined;

  if (activeSpeech && activeSpeech.id !== speechId) {
    throw new Error("Another speech is already active");
  }

  if (context.status === "ACTIVE") {
    return getSpeechRecord(speechId);
  }

  db.prepare(
    `
      UPDATE speech_requests
      SET status = 'ACTIVE', active_started_at = ?
      WHERE id = ? AND status IN ('REQUESTED', 'PAUSED')
    `
  ).run(getNowIso(), speechId);

  return getSpeechRecord(speechId);
}

export function pauseSpeech(speechId: number, chairToken: string): SpeechEntry {
  const context = requireSpeechContext(speechId);
  requireChairPermission(chairToken, context.committeeId);

  const row = db
    .prepare(
      `
        SELECT active_started_at as activeStartedAt, total_speaking_seconds as totalSpeakingSeconds, status
        FROM speech_requests
        WHERE id = ?
      `
    )
    .get(speechId) as { activeStartedAt: string | null; totalSpeakingSeconds: number; status: SpeechStatus } | undefined;

  if (!row || row.status !== "ACTIVE" || !row.activeStartedAt) {
    throw new Error("Speech is not active");
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(row.activeStartedAt)) / 1000));
  db.prepare(
    `
      UPDATE speech_requests
      SET status = 'PAUSED',
          total_speaking_seconds = total_speaking_seconds + ?,
          active_started_at = NULL
      WHERE id = ?
    `
  ).run(elapsedSeconds, speechId);

  return getSpeechRecord(speechId);
}

export function finishSpeech(speechId: number, chairToken: string): SpeechEntry {
  const context = requireSpeechContext(speechId);
  requireChairPermission(chairToken, context.committeeId);

  const row = db
    .prepare(
      `
        SELECT active_started_at as activeStartedAt, total_speaking_seconds as totalSpeakingSeconds, status
        FROM speech_requests
        WHERE id = ?
      `
    )
    .get(speechId) as { activeStartedAt: string | null; totalSpeakingSeconds: number; status: SpeechStatus } | undefined;

  if (!row) {
    throw new Error("Speech not found");
  }

  let additionalSeconds = 0;
  if (row.status === "ACTIVE" && row.activeStartedAt) {
    additionalSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(row.activeStartedAt)) / 1000));
  }

  db.prepare(
    `
      UPDATE speech_requests
      SET status = 'FINISHED',
          finished_at = ?,
          total_speaking_seconds = total_speaking_seconds + ?,
          active_started_at = NULL
      WHERE id = ?
    `
  ).run(getNowIso(), additionalSeconds, speechId);

  resequenceSessionSpeeches(context.sessionId);

  return getSpeechRecord(speechId);
}

export function findParticipantByToken(token: string): Participant | undefined {
  const row = db
    .prepare(
      `
        SELECT
          p.token,
          p.title as title,
          p.first_name as firstName,
          p.last_name as lastName,
          p.gender as gender,
          p.member_function as memberFunction,
          d.faction as faction,
          CASE WHEN COUNT(ch.committee_id) > 0 THEN 1 ELSE 0 END as isChair,
          GROUP_CONCAT(c.name, '||') as chairedBodies
        FROM participants p
        LEFT JOIN rats_member_details d ON d.participant_token = p.token
        LEFT JOIN rats_member_committee_chairs ch ON ch.participant_token = p.token
        LEFT JOIN committees c ON c.id = ch.committee_id
        WHERE p.token = ?
        GROUP BY p.token, p.title, p.first_name, p.last_name, p.gender, p.member_function, d.faction
      `
    )
    .get(token) as
    | {
        token: string;
        title: string | null;
        firstName: string;
        lastName: string;
        gender: Gender;
        memberFunction: PersonRole;
        faction: Faction | null;
        isChair: number;
        chairedBodies: string | null;
      }
    | undefined;

  if (!row) {
    return undefined;
  }

  return {
    token: row.token,
    title: row.title,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender,
    memberFunction: row.memberFunction,
    faction: row.faction,
    isChair: row.isChair === 1,
    chairedBodies: row.chairedBodies ? row.chairedBodies.split("||") : []
  };
}

export function getAllParticipants(): Participant[] {
  const rows = db
    .prepare(
      `
        SELECT
          p.token,
          p.title as title,
          p.first_name as firstName,
          p.last_name as lastName,
          p.gender as gender,
          p.member_function as memberFunction,
          d.faction as faction,
          CASE WHEN COUNT(ch.committee_id) > 0 THEN 1 ELSE 0 END as isChair,
          GROUP_CONCAT(c.name, '||') as chairedBodies
        FROM participants p
        LEFT JOIN rats_member_details d ON d.participant_token = p.token
        LEFT JOIN rats_member_committee_chairs ch ON ch.participant_token = p.token
        LEFT JOIN committees c ON c.id = ch.committee_id
        GROUP BY p.token, p.title, p.first_name, p.last_name, p.gender, p.member_function, d.faction
        ORDER BY p.member_function, isChair DESC, d.faction, p.last_name, p.first_name
      `
    )
    .all() as Array<{
    token: string;
    title: string | null;
    firstName: string;
    lastName: string;
    gender: Gender;
    memberFunction: PersonRole;
    faction: Faction | null;
    isChair: number;
    chairedBodies: string | null;
  }>;

  return rows.map((row) => ({
    token: row.token,
    title: row.title,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender,
    memberFunction: row.memberFunction,
    faction: row.faction,
    isChair: row.isChair === 1,
    chairedBodies: row.chairedBodies ? row.chairedBodies.split("||") : []
  }));
}

export function getRandomParticipant(): Participant | undefined {
  const rows = getAllParticipants();
  if (rows.length === 0) {
    return undefined;
  }

  const randomIndex = Math.floor(Math.random() * rows.length);
  return rows[randomIndex];
}
