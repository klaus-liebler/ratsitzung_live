import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  type CommitteeName,
  type SeedParticipant
} from "./types";

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      token TEXT PRIMARY KEY,
      title TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'keine Angabe' CHECK (gender IN ('weiblich', 'maennlich', 'divers', 'keine Angabe')),
      member_function TEXT NOT NULL CHECK (
        member_function IN (
          'Administrator',
          'Verwaltungsmitglied',
          'Ratsmitglied',
          'Sachkundiger Bürger',
          'Vereidigter',
          'Gast'
        )
      )
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rats_member_details (
      participant_token TEXT PRIMARY KEY,
      faction TEXT NOT NULL,
      FOREIGN KEY (participant_token) REFERENCES participants(token) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS committees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rats_member_committee_chairs (
      participant_token TEXT NOT NULL,
      committee_id INTEGER NOT NULL,
      PRIMARY KEY (participant_token, committee_id),
      FOREIGN KEY (participant_token) REFERENCES participants(token) ON DELETE CASCADE,
      FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS committee_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      committee_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('RUNNING', 'STOPPED')),
      started_at TEXT NOT NULL,
      stopped_at TEXT,
      started_by_token TEXT NOT NULL,
      stopped_by_token TEXT,
      FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE CASCADE,
      FOREIGN KEY (started_by_token) REFERENCES participants(token) ON DELETE RESTRICT,
      FOREIGN KEY (stopped_by_token) REFERENCES participants(token) ON DELETE RESTRICT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS committee_session_attendance (
      session_id INTEGER NOT NULL,
      participant_token TEXT NOT NULL,
      checked_in_at TEXT NOT NULL,
      checked_out_at TEXT,
      PRIMARY KEY (session_id, participant_token),
      FOREIGN KEY (session_id) REFERENCES committee_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_token) REFERENCES participants(token) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS speech_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      participant_token TEXT NOT NULL,
      requested_by_token TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      finished_at TEXT,
      total_speaking_seconds INTEGER NOT NULL DEFAULT 0,
      active_started_at TEXT,
      status TEXT NOT NULL CHECK (status IN ('REQUESTED', 'ACTIVE', 'PAUSED', 'FINISHED', 'DELETED', 'WITHDRAWN')),
      sequence_number INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES committee_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_token) REFERENCES participants(token) ON DELETE CASCADE,
      FOREIGN KEY (requested_by_token) REFERENCES participants(token) ON DELETE RESTRICT
    )
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_rats_details_only_for_rats_insert
    BEFORE INSERT ON rats_member_details
    FOR EACH ROW
    WHEN (
      SELECT member_function
      FROM participants
      WHERE token = NEW.participant_token
    ) != 'Ratsmitglied'
    BEGIN
      SELECT RAISE(ABORT, 'rats_member_details only allowed for Ratsmitglied');
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_rats_details_only_for_rats_update
    BEFORE UPDATE OF participant_token ON rats_member_details
    FOR EACH ROW
    WHEN (
      SELECT member_function
      FROM participants
      WHERE token = NEW.participant_token
    ) != 'Ratsmitglied'
    BEGIN
      SELECT RAISE(ABORT, 'rats_member_details only allowed for Ratsmitglied');
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_chairs_only_for_rats_insert
    BEFORE INSERT ON rats_member_committee_chairs
    FOR EACH ROW
    WHEN (
      SELECT member_function
      FROM participants
      WHERE token = NEW.participant_token
    ) != 'Ratsmitglied'
    BEGIN
      SELECT RAISE(ABORT, 'rats_member_committee_chairs only allowed for Ratsmitglied');
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_chairs_only_for_rats_update
    BEFORE UPDATE OF participant_token ON rats_member_committee_chairs
    FOR EACH ROW
    WHEN (
      SELECT member_function
      FROM participants
      WHERE token = NEW.participant_token
    ) != 'Ratsmitglied'
    BEGIN
      SELECT RAISE(ABORT, 'rats_member_committee_chairs only allowed for Ratsmitglied');
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_cleanup_rats_data_on_role_change
    AFTER UPDATE OF member_function ON participants
    FOR EACH ROW
    WHEN NEW.member_function != 'Ratsmitglied'
    BEGIN
      DELETE FROM rats_member_details WHERE participant_token = NEW.token;
      DELETE FROM rats_member_committee_chairs WHERE participant_token = NEW.token;
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_session_attendance_only_in_running_session
    BEFORE INSERT ON committee_session_attendance
    FOR EACH ROW
    WHEN (
      SELECT status
      FROM committee_sessions
      WHERE id = NEW.session_id
    ) != 'RUNNING'
    BEGIN
      SELECT RAISE(ABORT, 'attendance only allowed for running sessions');
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_speech_only_in_running_session
    BEFORE INSERT ON speech_requests
    FOR EACH ROW
    WHEN (
      SELECT status
      FROM committee_sessions
      WHERE id = NEW.session_id
    ) != 'RUNNING'
    BEGIN
      SELECT RAISE(ABORT, 'speech only allowed for running sessions');
    END
  `);
}

function ensureSpeechRequestsShape(db: Database.Database): void {
  const tableSqlRow = db
    .prepare(
      `
        SELECT sql
        FROM sqlite_master
        WHERE type = 'table' AND name = 'speech_requests'
      `
    )
    .get() as { sql: string | null } | undefined;

  const tableSql = tableSqlRow?.sql ?? "";
  const hasWithdrawnStatus = /WITHDRAWN/i.test(tableSql);
  if (hasWithdrawnStatus) {
    return;
  }

  const relatedTriggers = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'trigger' AND sql LIKE '%speech_requests%'
      `
    )
    .all() as Array<{ name: string }>;

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.transaction(() => {
      for (const trigger of relatedTriggers) {
        const escapedName = trigger.name.replace(/"/g, '""');
        db.exec(`DROP TRIGGER IF EXISTS "${escapedName}"`);
      }

      db.exec(`
        CREATE TABLE speech_requests_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          participant_token TEXT NOT NULL,
          requested_by_token TEXT NOT NULL,
          requested_at TEXT NOT NULL,
          finished_at TEXT,
          total_speaking_seconds INTEGER NOT NULL DEFAULT 0,
          active_started_at TEXT,
          status TEXT NOT NULL CHECK (status IN ('REQUESTED', 'ACTIVE', 'PAUSED', 'FINISHED', 'DELETED', 'WITHDRAWN')),
          sequence_number INTEGER NOT NULL,
          FOREIGN KEY (session_id) REFERENCES committee_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (participant_token) REFERENCES participants(token) ON DELETE CASCADE,
          FOREIGN KEY (requested_by_token) REFERENCES participants(token) ON DELETE RESTRICT
        )
      `);

      db.exec(`
        INSERT INTO speech_requests_new (
          id,
          session_id,
          participant_token,
          requested_by_token,
          requested_at,
          finished_at,
          total_speaking_seconds,
          active_started_at,
          status,
          sequence_number
        )
        SELECT
          id,
          session_id,
          participant_token,
          requested_by_token,
          requested_at,
          finished_at,
          total_speaking_seconds,
          active_started_at,
          status,
          sequence_number
        FROM speech_requests
      `);

      db.exec("DROP TABLE speech_requests");
      db.exec("ALTER TABLE speech_requests_new RENAME TO speech_requests");
    })();
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }

  createSchema(db);
}

function hasParticipantColumn(db: Database.Database, columnName: string): boolean {
  const tableColumns = db.prepare("PRAGMA table_info(participants)").all() as Array<{ name: string }>;
  return tableColumns.some((column) => column.name === columnName);
}

function tryDropParticipantColumn(db: Database.Database, columnName: string): void {
  if (!hasParticipantColumn(db, columnName)) {
    return;
  }

  try {
    db.exec(`ALTER TABLE participants DROP COLUMN ${columnName}`);
  } catch {
    // Older SQLite runtimes may not support DROP COLUMN; schema keeps working without hard failure.
  }
}

function rebuildParticipantsTableWithoutLegacyColumns(db: Database.Database): void {
  const hasLegacyColumns = hasParticipantColumn(db, "faction") || hasParticipantColumn(db, "is_chair");
  if (!hasLegacyColumns) {
    return;
  }

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE participants_new (
          token TEXT PRIMARY KEY,
          title TEXT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          gender TEXT NOT NULL DEFAULT 'keine Angabe' CHECK (gender IN ('weiblich', 'maennlich', 'divers', 'keine Angabe')),
          member_function TEXT NOT NULL CHECK (
            member_function IN (
              'Administrator',
              'Verwaltungsmitglied',
              'Ratsmitglied',
              'Sachkundiger Bürger',
              'Vereidigter',
              'Gast'
            )
          )
        )
      `);

      db.exec(`
        INSERT INTO participants_new (token, title, first_name, last_name, gender, member_function)
        SELECT
          token,
          title,
          first_name,
          last_name,
          CASE
            WHEN gender IN ('weiblich', 'maennlich', 'divers', 'keine Angabe') THEN gender
            ELSE 'keine Angabe'
          END,
          member_function
        FROM participants
      `);

      db.exec("DROP TABLE participants");
      db.exec("ALTER TABLE participants_new RENAME TO participants");
    })();
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }

  // Recreate triggers that were bound to the replaced participants table.
  createSchema(db);
}

function ensureParticipantColumns(db: Database.Database): void {
  const tableColumns = db.prepare("PRAGMA table_info(participants)").all() as Array<{ name: string }>;
  const hasTitleColumn = tableColumns.some((column) => column.name === "title");
  const hasGenderColumn = tableColumns.some((column) => column.name === "gender");

  if (!hasTitleColumn) {
    db.exec("ALTER TABLE participants ADD COLUMN title TEXT");
  }
  if (!hasGenderColumn) {
    db.exec("ALTER TABLE participants ADD COLUMN gender TEXT NOT NULL DEFAULT 'keine Angabe'");
  }

  db.exec("UPDATE participants SET gender = 'keine Angabe' WHERE gender IS NULL OR TRIM(gender) = ''");

  tryDropParticipantColumn(db, "is_chair");
  tryDropParticipantColumn(db, "faction");

  rebuildParticipantsTableWithoutLegacyColumns(db);
}

function ensureRatsMemberDetailsShape(db: Database.Database): void {
  const tableInfo = db.prepare("PRAGMA table_info(rats_member_details)").all() as Array<{ name: string }>;
  const hasLegacyDetailsChair = tableInfo.some((column) => column.name === "is_chair");
  const tableSqlRow = db
    .prepare(
      `
        SELECT sql
        FROM sqlite_master
        WHERE type = 'table' AND name = 'rats_member_details'
      `
    )
    .get() as { sql: string | null } | undefined;

  const tableSql = tableSqlRow?.sql ?? "";
  const hasLegacyFactionCheck = /faction\s+IN\s*\(/i.test(tableSql);

  if (!hasLegacyDetailsChair && !hasLegacyFactionCheck) {
    return;
  }

  const relatedTriggers = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'trigger' AND sql LIKE '%rats_member_details%'
      `
    )
    .all() as Array<{ name: string }>;

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.transaction(() => {
      for (const trigger of relatedTriggers) {
        const escapedName = trigger.name.replace(/"/g, '""');
        db.exec(`DROP TRIGGER IF EXISTS "${escapedName}"`);
      }

      db.exec(`
        CREATE TABLE rats_member_details_new (
          participant_token TEXT PRIMARY KEY,
          faction TEXT NOT NULL,
          FOREIGN KEY (participant_token) REFERENCES participants(token) ON DELETE CASCADE
        )
      `);

      db.exec(`
        INSERT INTO rats_member_details_new (participant_token, faction)
        SELECT
          participant_token,
          COALESCE(NULLIF(TRIM(faction), ''), 'Fraktionslos')
        FROM rats_member_details
      `);

      db.exec("DROP TABLE rats_member_details");
      db.exec("ALTER TABLE rats_member_details_new RENAME TO rats_member_details");
    })();
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }

  // Recreate dropped triggers bound to this table.
  createSchema(db);
}

function ensureDefaultCommittees(db: Database.Database, defaultCommittees: CommitteeName[]): void {
  const insertCommittee = db.prepare(
    `
      INSERT OR IGNORE INTO committees (name)
      VALUES (?)
    `
  );

  for (const committee of defaultCommittees) {
    insertCommittee.run(committee);
  }
}

function getCommitteeId(db: Database.Database, name: string): number {
  const row = db
    .prepare(
      `
        SELECT id
        FROM committees
        WHERE name = ?
      `
    )
    .get(name) as { id: number } | undefined;

  if (row) {
    return row.id;
  }

  db.prepare(
    `
      INSERT INTO committees (name)
      VALUES (?)
    `
  ).run(name);

  return getCommitteeId(db, name);
}

function migrateLegacyRatsDetails(db: Database.Database, defaultCommittees: CommitteeName[]): void {
  ensureDefaultCommittees(db, defaultCommittees);

  const hasLegacyFactionColumn = hasParticipantColumn(db, "faction");
  const detailsColumns = db.prepare("PRAGMA table_info(rats_member_details)").all() as Array<{ name: string }>;
  const hasLegacyDetailsChair = detailsColumns.some((column) => column.name === "is_chair");

  db.exec(
    `
    INSERT OR IGNORE INTO rats_member_details (participant_token, faction${hasLegacyDetailsChair ? ", is_chair" : ""})
    SELECT
      p.token,
      ${
        hasLegacyFactionColumn
          ? `COALESCE(NULLIF(TRIM(p.faction), ''), 'Fraktionslos')`
          : `'Fraktionslos'`
      }${hasLegacyDetailsChair ? ", 0" : ""}
    FROM participants p
    WHERE p.member_function = 'Ratsmitglied'
  `
  );

  if (hasLegacyDetailsChair) {
    const legacyChairs = db
      .prepare(
        `
          SELECT participant_token as participantToken
          FROM rats_member_details
          WHERE is_chair = 1
        `
      )
      .all() as Array<{ participantToken: string }>;

    const committeeId = getCommitteeId(db, "Fraktionssitzung");
    const insertChair = db.prepare(
      `
        INSERT OR IGNORE INTO rats_member_committee_chairs (participant_token, committee_id)
        VALUES (?, ?)
      `
    );

    for (const row of legacyChairs) {
      insertChair.run(row.participantToken, committeeId);
    }
  }

  const hasLegacyIsChairColumn = hasParticipantColumn(db, "is_chair");
  const legacyParticipantChairs = hasLegacyIsChairColumn
    ? (db
        .prepare(
          `
            SELECT token
            FROM participants
            WHERE member_function = 'Ratsmitglied' AND COALESCE(is_chair, 0) = 1
          `
        )
        .all() as Array<{ token: string }>)
    : [];

  const fallbackCommitteeId = getCommitteeId(db, "Fraktionssitzung");
  const insertChair = db.prepare(
    `
      INSERT OR IGNORE INTO rats_member_committee_chairs (participant_token, committee_id)
      VALUES (?, ?)
    `
  );

  for (const row of legacyParticipantChairs) {
    insertChair.run(row.token, fallbackCommitteeId);
  }

  db.exec(`
    DELETE FROM rats_member_details
    WHERE participant_token IN (
      SELECT token FROM participants WHERE member_function != 'Ratsmitglied'
    )
  `);

  db.exec(`
    DELETE FROM rats_member_committee_chairs
    WHERE participant_token IN (
      SELECT token FROM participants WHERE member_function != 'Ratsmitglied'
    )
  `);
}

function seedParticipants(db: Database.Database): void {
  const seedRows: SeedParticipant[] = [
    { title: "Dr.", firstName: "Alex", lastName: "Berg", gender: "maennlich", memberFunction: "Administrator" },
    { firstName: "Anna", lastName: "Keller", gender: "weiblich", memberFunction: "Verwaltungsmitglied" },
    { firstName: "Bernd", lastName: "Neumann", gender: "maennlich", memberFunction: "Verwaltungsmitglied" },
    {
      firstName: "Clara",
      lastName: "Wendt",
      gender: "weiblich",
      memberFunction: "Ratsmitglied",
      ratsInfo: { faction: "CDU", chairedBodies: ["Fraktionssitzung", "Schulausschuss"] }
    },
    { firstName: "Dirk", lastName: "Sommer", gender: "maennlich", memberFunction: "Ratsmitglied", ratsInfo: { faction: "SPD", chairedBodies: [] } },
    { firstName: "Lena", lastName: "Bauer", gender: "weiblich", memberFunction: "Ratsmitglied", ratsInfo: { faction: "Grüne", chairedBodies: ["Kulturausschuss"] } },
    { firstName: "Murat", lastName: "Schulze", gender: "maennlich", memberFunction: "Ratsmitglied", ratsInfo: { faction: "Linke", chairedBodies: [] } },
    { firstName: "Eva", lastName: "Hansen", gender: "weiblich", memberFunction: "Sachkundiger Bürger" },
    { firstName: "Farid", lastName: "Meyer", gender: "maennlich", memberFunction: "Sachkundiger Bürger" },
    { firstName: "Greta", lastName: "Lorenz", gender: "weiblich", memberFunction: "Vereidigter" },
    { firstName: "Hasan", lastName: "Krueger", gender: "maennlich", memberFunction: "Vereidigter" },
    { firstName: "Ida", lastName: "Busch", gender: "weiblich", memberFunction: "Gast" },
    { firstName: "Jonas", lastName: "Riedel", gender: "maennlich", memberFunction: "Gast" }
  ];

  const insertParticipant = db.prepare(
    `
      INSERT INTO participants (token, title, first_name, last_name, gender, member_function)
      VALUES (@token, @title, @firstName, @lastName, @gender, @memberFunction)
    `
  );

  const detailsColumns = db.prepare("PRAGMA table_info(rats_member_details)").all() as Array<{ name: string }>;
  const hasLegacyDetailsChair = detailsColumns.some((column) => column.name === "is_chair");

  const insertRatsDetails = hasLegacyDetailsChair
    ? db.prepare(
        `
          INSERT INTO rats_member_details (participant_token, faction, is_chair)
          VALUES (@participantToken, @faction, 0)
        `
      )
    : db.prepare(
        `
          INSERT INTO rats_member_details (participant_token, faction)
          VALUES (@participantToken, @faction)
        `
      );

  const insertChair = db.prepare(
    `
      INSERT OR IGNORE INTO rats_member_committee_chairs (participant_token, committee_id)
      VALUES (@participantToken, @committeeId)
    `
  );

  const insertMany = db.transaction((rows: SeedParticipant[]) => {
    for (const row of rows) {
      const token = randomUUID();
      insertParticipant.run({
        token,
        title: row.title ?? null,
        firstName: row.firstName,
        lastName: row.lastName,
        gender: row.gender ?? "keine Angabe",
        memberFunction: row.memberFunction
      });

      if (row.memberFunction === "Ratsmitglied" && row.ratsInfo) {
        insertRatsDetails.run({
          participantToken: token,
          faction: row.ratsInfo.faction
        });

        for (const committeeName of row.ratsInfo.chairedBodies) {
          const committeeId = getCommitteeId(db, committeeName);
          insertChair.run({
            participantToken: token,
            committeeId
          });
        }
      }
    }
  });

  insertMany(seedRows);
}

function ensureAdministratorCoverage(db: Database.Database): void {
  const adminCount = db
    .prepare(
      `
        SELECT COUNT(*) as count
        FROM participants
        WHERE member_function = 'Administrator'
      `
    )
    .get() as { count: number };

  if (adminCount.count > 0) {
    return;
  }

  db.prepare(
    `
      INSERT INTO participants (token, title, first_name, last_name, gender, member_function)
      VALUES (@token, NULL, 'Admin', 'Standard', 'keine Angabe', 'Administrator')
    `
  ).run({ token: randomUUID() });
}

interface RealRatsMember {
  title?: string;
  firstName: string;
  lastName: string;
  gender: "weiblich" | "maennlich";
  faction: string;
  isFraktionssitzungChair: boolean;
}

function ensureRealRatsMembers(db: Database.Database): void {
  const fraktionssitzungId = getCommitteeId(db, "Fraktionssitzung");
  const detailsColumns = db.prepare("PRAGMA table_info(rats_member_details)").all() as Array<{ name: string }>;
  const hasLegacyDetailsChair = detailsColumns.some((column) => column.name === "is_chair");

  const members: RealRatsMember[] = [
    { firstName: "Johannes", lastName: "Wilp", gender: "maennlich", faction: "CDU Greven re", isFraktionssitzungChair: true },
    { firstName: "Eike", lastName: "Brinkhaus", gender: "maennlich", faction: "CDU Greven li", isFraktionssitzungChair: true },
    { firstName: "Philipp", lastName: "Nientiedt", gender: "maennlich", faction: "CDU Greven li", isFraktionssitzungChair: true },
    { firstName: "Martinus", lastName: "Benning", gender: "maennlich", faction: "CDU Greven re", isFraktionssitzungChair: false },
    { firstName: "Silke", lastName: "Eisenrichter", gender: "weiblich", faction: "CDU Greven re", isFraktionssitzungChair: false },
    { firstName: "Michael", lastName: "Gries", gender: "maennlich", faction: "CDU Greven re", isFraktionssitzungChair: false },
    { firstName: "Thomas", lastName: "Horstmann", gender: "maennlich", faction: "CDU Greven re", isFraktionssitzungChair: false },
    { firstName: "Dames", lastName: "Joud", gender: "maennlich", faction: "CDU Greven re", isFraktionssitzungChair: false },
    { firstName: "Liz", lastName: "Kühlert", gender: "weiblich", faction: "CDU Greven li", isFraktionssitzungChair: false },
    { firstName: "Bettina", lastName: "Kurney", gender: "weiblich", faction: "CDU Greven li", isFraktionssitzungChair: false },
    { title: "Prof. Dr.", firstName: "Klaus", lastName: "Liebler", gender: "maennlich", faction: "CDU Greven re", isFraktionssitzungChair: false },
    { title: "Dr.", firstName: "Tim", lastName: "Schubert", gender: "maennlich", faction: "CDU Greven re", isFraktionssitzungChair: false },
    { firstName: "Alfons", lastName: "Schulze Jochmaring", gender: "maennlich", faction: "CDU Greven re", isFraktionssitzungChair: false },
    { firstName: "Klaus", lastName: "Schwenken", gender: "maennlich", faction: "CDU Reckenfeld", isFraktionssitzungChair: false },
    { firstName: "Chantal", lastName: "Sluka", gender: "weiblich", faction: "CDU Greven re", isFraktionssitzungChair: false },
    { firstName: "Steve", lastName: "Sterthues", gender: "maennlich", faction: "CDU Reckenfeld", isFraktionssitzungChair: false },
    { firstName: "Anika", lastName: "Stöcker", gender: "weiblich", faction: "CDU Reckenfeld", isFraktionssitzungChair: false }
  ];

  const findParticipant = db.prepare(
    `
      SELECT token
      FROM participants
      WHERE first_name = ? AND last_name = ? AND member_function = 'Ratsmitglied'
      LIMIT 1
    `
  );

  const insertParticipant = db.prepare(
    `
      INSERT INTO participants (token, title, first_name, last_name, gender, member_function)
      VALUES (?, ?, ?, ?, ?, 'Ratsmitglied')
    `
  );

  const updateParticipant = db.prepare(
    `
      UPDATE participants
      SET title = ?, gender = ?, member_function = 'Ratsmitglied'
      WHERE token = ?
    `
  );

  const upsertFaction = hasLegacyDetailsChair
    ? db.prepare(
        `
          INSERT INTO rats_member_details (participant_token, faction, is_chair)
          VALUES (?, ?, 0)
          ON CONFLICT(participant_token)
          DO UPDATE SET faction = excluded.faction
        `
      )
    : db.prepare(
        `
          INSERT INTO rats_member_details (participant_token, faction)
          VALUES (?, ?)
          ON CONFLICT(participant_token)
          DO UPDATE SET faction = excluded.faction
        `
      );

  const insertChair = db.prepare(
    `
      INSERT OR IGNORE INTO rats_member_committee_chairs (participant_token, committee_id)
      VALUES (?, ?)
    `
  );

  const removeChair = db.prepare(
    `
      DELETE FROM rats_member_committee_chairs
      WHERE participant_token = ? AND committee_id = ?
    `
  );

  db.transaction(() => {
    for (const member of members) {
      const existing = findParticipant.get(member.firstName, member.lastName) as { token: string } | undefined;
      const token = existing?.token ?? randomUUID();

      if (!existing) {
        insertParticipant.run(token, member.title ?? null, member.firstName, member.lastName, member.gender);
      } else {
        updateParticipant.run(member.title ?? null, member.gender, token);
      }

      upsertFaction.run(token, member.faction);

      if (member.isFraktionssitzungChair) {
        insertChair.run(token, fraktionssitzungId);
      } else {
        removeChair.run(token, fraktionssitzungId);
      }
    }
  })();
}

export function initializeDatabase(db: Database.Database, defaultCommittees: CommitteeName[]): void {
  createSchema(db);
  ensureSpeechRequestsShape(db);
  ensureRatsMemberDetailsShape(db);
  migrateLegacyRatsDetails(db, defaultCommittees);
  ensureParticipantColumns(db);

  const result = db.prepare("SELECT COUNT(*) as count FROM participants").get() as { count: number };
  if (result.count === 0) {
    seedParticipants(db);
  }

  ensureAdministratorCoverage(db);
  ensureRealRatsMembers(db);
}
