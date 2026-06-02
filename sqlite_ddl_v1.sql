PRAGMA foreign_keys = ON;

-- RatLive v1 - SQLite DDL
-- Dieses Schema trennt fachliche Personentypen (user_details_council.type)
-- klar von Rollen und Rechten (roles, rights, role_rights, user_role_assignments).

BEGIN TRANSACTION;

-- users:
-- Stammdaten eines Nutzers. "namespace" ermoeglicht spaeter externe Auth-Quellen.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  namespace TEXT NOT NULL DEFAULT 'localhost',
  name TEXT NOT NULL,
  email TEXT,
  function TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  activation_dt TEXT NOT NULL DEFAULT (datetime('now')),
  deactivation_dt TEXT,
  UNIQUE(namespace, name)
);

-- users_localhost_credentials:
-- Lokale Login-Credentials (Passwort-Hash) fuer Benutzer im Namespace "localhost".
-- must_change_password = 1 erzwingt nach erfolgreichem Login den Passwortwechsel.
CREATE TABLE IF NOT EXISTS users_localhost_credentials (
  user_id INTEGER PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'argon2id',
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
  password_updated_dt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- users_certificates:
-- Vom System signierte Nutzer-Zertifikate fuer PDF-Signatur-Workflows.
CREATE TABLE IF NOT EXISTS users_certificates (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
  certificate_string TEXT NOT NULL,
  created_dt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- fractions:
-- Politische Fraktionen, denen Mitglieder zugeordnet sein koennen.
CREATE TABLE IF NOT EXISTS fractions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- user_details_council:
-- Fachliche Zusatzinfos fuer Ratsmitglieder/Sachkundige Buerger.
-- WICHTIG: "type" ist Personentyp, keine Berechtigung.
CREATE TABLE IF NOT EXISTS user_details_council (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  sworn_in_dt TEXT,
  type TEXT NOT NULL CHECK (type IN ('councilor', 'expert_citizen')),
  fraction_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (fraction_id) REFERENCES fractions(id)
);

-- committees:
-- Gremien/Ausschuesse, in denen Sitzungen stattfinden.
CREATE TABLE IF NOT EXISTS committees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  founding_date TEXT,
  committee_state TEXT NOT NULL DEFAULT 'PREPARED'
    CHECK (committee_state IN ('PREPARED', 'IN_DUTY', 'INACTIVE'))
);

-- committee_sessions:
-- Sitzung eines Gremiums; genau ein Eroeffner (start_user_id) je Sitzung.
CREATE TABLE IF NOT EXISTS committee_sessions (
  id INTEGER PRIMARY KEY,
  committee_id INTEGER NOT NULL,
  start_dt TEXT,
  end_dt TEXT,
  start_user_id INTEGER NOT NULL,
  FOREIGN KEY (committee_id) REFERENCES committees(id),
  FOREIGN KEY (start_user_id) REFERENCES users(id)
);

-- rights:
-- Kleinste autorisierbare Aktion im System (z.B. speech.request, protocol.edit).
-- right_key = stabiler technischer Schluessel fuer Policy-Pruefungen im Code.
-- module_key = organisatorisches Label fuer Anzeige, Filter und Dokumentation.
CREATE TABLE IF NOT EXISTS rights (
  id INTEGER PRIMARY KEY,
  right_key TEXT NOT NULL UNIQUE,
  module_key TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- roles:
-- Rollen sind Buendel von Rechten (z.B. committee_chair, protocol_recorder).
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('GLOBAL', 'COMMITTEE')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- role_rights:
-- N:M-Zuordnung, welche Rechte zu welcher Rolle gehoeren.
CREATE TABLE IF NOT EXISTS role_rights (
  role_id INTEGER NOT NULL,
  right_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, right_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (right_id) REFERENCES rights(id) ON DELETE CASCADE
);

-- user_role_assignments:
-- Vergibt Rollen an User, entweder global oder fuer ein konkretes Gremium.
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('GLOBAL', 'COMMITTEE')),
  committee_id INTEGER,
  valid_from TEXT NOT NULL DEFAULT (datetime('now')),
  valid_to TEXT,
  assigned_by_user_id INTEGER,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (committee_id) REFERENCES committees(id),
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id),
  CHECK (
    (scope_type = 'GLOBAL' AND committee_id IS NULL) OR
    (scope_type = 'COMMITTEE' AND committee_id IS NOT NULL)
  )
);

-- attendances:
-- Anwesenheit eines Users in einer Sitzung (Join/Leave).
CREATE TABLE IF NOT EXISTS attendances (
  attendance_id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  start_dt TEXT NOT NULL,
  end_dt TEXT,
  FOREIGN KEY (session_id) REFERENCES committee_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- contributions:
-- Tatsachlich gefuehrte Wortbeitraege. Bei Pause/Stop wird end_dt gesetzt,
-- length_seconds kann zur Performance optional mitgefuehrt werden.
CREATE TABLE IF NOT EXISTS contributions (
  contribution_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_id INTEGER NOT NULL,
  start_dt TEXT NOT NULL,
  end_dt TEXT NOT NULL,
  length_seconds INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES committee_sessions(id) ON DELETE CASCADE,
  CHECK (length_seconds >= 0)
);

-- api_keys:
-- API-Key-basierter Zugriff fuer technische Clients (z.B. Presentation-App).
-- Der Key ist laut Anforderung UUID-basiert und wird manuell gepflegt.
-- V1-Entscheidung: Speicherung im Klartext in der Spalte "key".
CREATE TABLE IF NOT EXISTS api_keys (
  key_id INTEGER PRIMARY KEY,
  endpoint TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_dt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- session_protocol_status:
-- Statusautomat fuer Niederschrift-Workflow.
CREATE TABLE IF NOT EXISTS session_protocol_status (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- session_protocols:
-- Kopfdatensatz einer Niederschrift je Sitzung.
CREATE TABLE IF NOT EXISTS session_protocols (
  protocol_id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL UNIQUE,
  protocol_recorder_user_id INTEGER NOT NULL,
  protocol_status_id INTEGER NOT NULL,
  created_dt TEXT NOT NULL DEFAULT (datetime('now')),
  updated_dt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES committee_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (protocol_recorder_user_id) REFERENCES users(id),
  FOREIGN KEY (protocol_status_id) REFERENCES session_protocol_status(id)
);

-- session_protocol_content:
-- Blockweise Markdown-Inhalte eines Protokolls in fester Reihenfolge.
CREATE TABLE IF NOT EXISTS session_protocol_content (
  content_id INTEGER PRIMARY KEY,
  protocol_id INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  content_markdown TEXT NOT NULL,
  FOREIGN KEY (protocol_id) REFERENCES session_protocols(protocol_id) ON DELETE CASCADE,
  UNIQUE(protocol_id, sequence)
);

-- Empfohlene Indizes fuer haeufige Zugriffe.
CREATE INDEX IF NOT EXISTS idx_sessions_committee ON committee_sessions(committee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendances(session_id);
CREATE INDEX IF NOT EXISTS idx_contrib_session ON contributions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_role_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_scope ON user_role_assignments(scope_type, committee_id);
CREATE INDEX IF NOT EXISTS idx_role_right_role ON role_rights(role_id);

-- Startwerte fuer Protokollstatus.
INSERT OR IGNORE INTO session_protocol_status (id, name) VALUES
  (1, 'EDITING'),
  (2, 'SIGNED_FROM_RECORDER'),
  (3, 'SIGNED_FROM_CHAIR');

COMMIT;
