PRAGMA foreign_keys = ON;

-- RatLive v1 - Seed-Daten
-- Diese Datei fuellt Stammdaten fuer lokale Entwicklung und Tests.
-- Sie kann mehrfach ausgefuehrt werden, da durchgaengig INSERT OR IGNORE verwendet wird.

BEGIN TRANSACTION;

-- =========================================================
-- 1) Fraktionen (Stammdaten)
-- =========================================================
INSERT OR IGNORE INTO fractions (id, name) VALUES
  (1, 'CDU'),
  (2, 'SPD'),
  (3, 'Gruene'),
  (4, 'FDP');

-- =========================================================
-- 2) Benutzer (Stammdaten)
-- =========================================================
INSERT OR IGNORE INTO users (
  id, namespace, name, email, function, first_name, last_name, activation_dt, deactivation_dt
) VALUES
  (1, 'localhost', 'sysadmin', 'sysadmin@ratlive.local', 'Systemadministrator', 'Alex', 'Admin', '2026-01-01 08:00:00', NULL),
  (2, 'localhost', 'vorsitz', 'vorsitz@ratlive.local', 'Ratsmitglied', 'Marie', 'Vorsitz', '2026-01-01 08:00:00', NULL),
  (3, 'localhost', 'rat1', 'rat1@ratlive.local', 'Ratsmitglied', 'Ratsmitglied', '1', '2026-01-01 08:00:00', NULL),
  (4, 'localhost', 'expertin', 'expertin@ratlive.local', 'Sachkundiger Buerger', 'Eva', 'Expertin', '2026-01-01 08:00:00', NULL),
  (5, 'localhost', 'protokoll', 'protokoll@ratlive.local', 'Protokollfuehrer', 'Paul', 'Protokoll', '2026-01-01 08:00:00', NULL),
  (6, 'localhost', 'useradmin', 'useradmin@ratlive.local', 'Verwaltung', 'Ursula', 'Useradmin', '2026-01-01 08:00:00', NULL),
  (7, 'localhost', 'rat2', 'rat2@ratlive.local', 'Ratsmitglied', 'Ratsmitglied', '2', '2026-01-01 08:00:00', NULL),
  (8, 'localhost', 'rat3', 'rat3@ratlive.local', 'Ratsmitglied', 'Ratsmitglied', '3', '2026-01-01 08:00:00', NULL),
  (9, 'localhost', 'rat4', 'rat4@ratlive.local', 'Ratsmitglied', 'Ratsmitglied', '4', '2026-01-01 08:00:00', NULL),
  (10, 'localhost', 'changepassword', 'changepassword@ratlive.local', 'Ratsmitglied', 'Change', 'Password', '2026-01-01 08:00:00', NULL);

-- Hinweis:
-- Passwort-Hashes sind Platzhalter und muessen in echten Umgebungen ersetzt werden.
-- V1-Startverhalten: Alle Seed-Accounts haben initial Initial123! und nur
-- der spezielle Benutzer "changepassword" ist mit must_change_password=1 markiert.
INSERT OR IGNORE INTO users_localhost_credentials (
  user_id, password_hash, password_algo, must_change_password, password_updated_dt
) VALUES
  (1, 'argon2id$demo$sysadmin_hash', 'argon2id', 0, '2026-01-01 08:00:00'),
  (2, 'argon2id$demo$chair_hash', 'argon2id', 0, '2026-01-01 08:00:00'),
  (3, 'argon2id$demo$rat1_hash', 'argon2id', 0, '2026-01-01 08:00:00'),
  (4, 'argon2id$demo$expert_hash', 'argon2id', 0, '2026-01-01 08:00:00'),
  (5, 'argon2id$demo$recorder_hash', 'argon2id', 0, '2026-01-01 08:00:00'),
  (6, 'argon2id$demo$useradmin_hash', 'argon2id', 0, '2026-01-01 08:00:00'),
  (7, 'argon2id$demo$rat2_hash', 'argon2id', 0, '2026-01-01 08:00:00'),
  (8, 'argon2id$demo$rat3_hash', 'argon2id', 0, '2026-01-01 08:00:00'),
  (9, 'argon2id$demo$rat4_hash', 'argon2id', 0, '2026-01-01 08:00:00'),
  (10, 'argon2id$demo$changepassword_hash', 'argon2id', 1, '2026-01-01 08:00:00');

-- =========================================================
-- 3) Fachliche Personen-Details (Stammdaten)
-- =========================================================
INSERT OR IGNORE INTO user_details_council (
  id, user_id, sworn_in_dt, type, fraction_id
) VALUES
  (1, 2, '2025-11-01 00:00:00', 'councilor', 2),
  (2, 3, '2024-11-01 00:00:00', 'councilor', 1),
  (3, 4, '2026-01-15 00:00:00', 'expert_citizen', 3),
  (4, 7, '2025-02-01 00:00:00', 'councilor', 1),
  (5, 8, '2025-03-01 00:00:00', 'councilor', 2),
  (6, 9, '2025-04-01 00:00:00', 'councilor', 2);

-- =========================================================
-- 4) Gremien (Stammdaten)
-- =========================================================
INSERT OR IGNORE INTO committees (
  id, name, founding_date, committee_state
) VALUES
  (1, 'Rat der Stadt Greven', '1975-01-01', 'IN_DUTY'),
  (2, 'Ausschuss fuer Finanzen', '1975-01-01', 'IN_DUTY'),
  (3, 'Ausschuss fuer Bauen', '1975-01-01', 'PREPARED');

-- =========================================================
-- 5) Rechte (Stammdaten)
-- =========================================================
-- right_key = stabiler technischer Schluessel fuer Rechtepruefungen.
-- module_key = organisatorisches Label fuer UI-Gruppierung, Filter und Doku.
INSERT OR IGNORE INTO rights (id, right_key, module_key, description, is_active) VALUES
  (1,  'auth.login', 'auth', 'Benutzeranmeldung', 1),
  (2,  'dashboard.view', 'dashboard', 'Dashboard anzeigen', 1),
  (3,  'session.list', 'session', 'Sitzungen auflisten', 1),
  (4,  'session.open', 'session', 'Sitzung eroeffnen', 1),
  (5,  'session.start', 'session', 'Sitzung starten', 1),
  (6,  'session.end', 'session', 'Sitzung beenden', 1),
  (7,  'session.join', 'session', 'Sitzung beitreten', 1),
  (8,  'session.leave', 'session', 'Sitzung verlassen', 1),
  (9,  'attendance.view', 'attendance', 'Anwesenheit anzeigen', 1),
  (10, 'speech.request', 'speech', 'Wortmeldung abgeben', 1),
  (11, 'speech.withdraw', 'speech', 'Wortmeldung zuruecknehmen', 1),
  (12, 'speech.list.view', 'speech', 'Wortmeldeliste anzeigen', 1),
  (13, 'speech.call', 'speech', 'Wortmeldung aufrufen', 1),
  (14, 'speech.pause', 'speech', 'Wortbeitrag pausieren', 1),
  (15, 'speech.stop', 'speech', 'Wortbeitrag beenden', 1),
  (16, 'speech.reorder', 'speech', 'Wortmeldungen umsortieren', 1),
  (17, 'speech.delete', 'speech', 'Wortmeldung loeschen', 1),
  (18, 'users.create', 'users', 'Nutzer anlegen', 1),
  (19, 'users.update', 'users', 'Nutzer bearbeiten', 1),
  (20, 'users.deactivate', 'users', 'Nutzer deaktivieren', 1),
  (21, 'users.reset_password', 'users', 'Passwort zuruecksetzen', 1),
  (22, 'users.assign_roles', 'users', 'Rollen zuweisen', 1),
  (23, 'profile.change_password', 'profile', 'Eigenes Passwort aendern', 1),
  (24, 'certificate.request', 'certificate', 'Eigenes Zertifikat anfordern', 1),
  (25, 'certificate.download_own', 'certificate', 'Eigenes Zertifikat herunterladen', 1),
  (26, 'protocol.edit', 'protocol', 'Niederschrift bearbeiten', 1),
  (27, 'protocol.generate_pdf', 'protocol', 'Niederschrift als PDF erzeugen', 1),
  (28, 'protocol.sign_recorder', 'protocol', 'Niederschrift als Protokollfuehrer signieren', 1),
  (29, 'protocol.sign_chair', 'protocol', 'Niederschrift als Vorsitz signieren', 1),
  (30, 'protocol.download', 'protocol', 'Niederschrift herunterladen', 1),
  (31, 'system.info.view', 'admin', 'Systeminformationen anzeigen', 1),
  (32, 'system.backup.download', 'admin', 'Backup herunterladen', 1),
  (33, 'system.api_test', 'admin', 'API-Testseite nutzen', 1),
  (34, 'auditlog.view', 'admin', 'Auditlog einsehen', 1);

-- =========================================================
-- 6) Rollen (Stammdaten)
-- =========================================================
INSERT OR IGNORE INTO roles (id, role_key, display_name, scope_type, is_active) VALUES
  (1, 'system_admin', 'Systemadministrator', 'GLOBAL', 1),
  (2, 'user_admin', 'Benutzerverwaltung', 'GLOBAL', 1),
  (3, 'protocol_admin', 'Protokolladministration', 'GLOBAL', 1),
  (4, 'dashboard_user', 'Basiszugriff Dashboard', 'GLOBAL', 1),
  (5, 'committee_chair', 'Vorsitz in Gremium', 'COMMITTEE', 1),
  (6, 'committee_member_voting', 'Stimmberechtigtes Mitglied', 'COMMITTEE', 1),
  (7, 'committee_member_advisory', 'Beratendes Mitglied', 'COMMITTEE', 1),
  (8, 'protocol_recorder', 'Protokollfuehrer in Gremium', 'COMMITTEE', 1);

-- =========================================================
-- 7) Rollen-Rechte-Zuordnung (Stammdaten)
-- =========================================================
-- system_admin: alle aktiven Rechte.
INSERT OR IGNORE INTO role_rights (role_id, right_id)
SELECT 1, id FROM rights WHERE is_active = 1;

-- dashboard_user
INSERT OR IGNORE INTO role_rights (role_id, right_id)
SELECT 4, id FROM rights WHERE right_key IN (
  'auth.login',
  'dashboard.view',
  'session.list',
  'session.join',
  'session.leave',
  'speech.list.view',
  'profile.change_password',
  'certificate.request',
  'certificate.download_own'
);

-- committee_member_voting
INSERT OR IGNORE INTO role_rights (role_id, right_id)
SELECT 6, id FROM rights WHERE right_key IN (
  'attendance.view',
  'speech.request',
  'speech.withdraw'
);

-- committee_member_advisory
INSERT OR IGNORE INTO role_rights (role_id, right_id)
SELECT 7, id FROM rights WHERE right_key IN (
  'attendance.view',
  'speech.request',
  'speech.withdraw'
);

-- committee_chair
INSERT OR IGNORE INTO role_rights (role_id, right_id)
SELECT 5, id FROM rights WHERE right_key IN (
  'session.open',
  'session.start',
  'session.end',
  'attendance.view',
  'speech.call',
  'speech.pause',
  'speech.stop',
  'speech.reorder',
  'speech.delete'
);

-- protocol_recorder
INSERT OR IGNORE INTO role_rights (role_id, right_id)
SELECT 8, id FROM rights WHERE right_key IN (
  'protocol.edit',
  'protocol.generate_pdf',
  'protocol.sign_recorder',
  'protocol.download'
);

-- protocol_admin
INSERT OR IGNORE INTO role_rights (role_id, right_id)
SELECT 3, id FROM rights WHERE right_key IN (
  'protocol.edit',
  'protocol.generate_pdf',
  'protocol.download',
  'auditlog.view'
);

-- user_admin
INSERT OR IGNORE INTO role_rights (role_id, right_id)
SELECT 2, id FROM rights WHERE right_key IN (
  'users.create',
  'users.update',
  'users.deactivate',
  'users.reset_password',
  'users.assign_roles'
);

-- =========================================================
-- 8) Rollenvergabe an Benutzer (Stammdaten)
-- =========================================================
-- Global:
INSERT OR IGNORE INTO user_role_assignments (
  id, user_id, role_id, scope_type, committee_id, valid_from, valid_to, assigned_by_user_id, assigned_at, revoked_at
) VALUES
  (1, 1, 1, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (2, 1, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (3, 2, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (4, 3, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (5, 4, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (6, 5, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (7, 6, 2, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (8, 6, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (9, 5, 3, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (10, 7, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (11, 8, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (12, 9, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (13, 10, 4, 'GLOBAL', NULL, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL);

-- Gremienbezogen:
INSERT OR IGNORE INTO user_role_assignments (
  id, user_id, role_id, scope_type, committee_id, valid_from, valid_to, assigned_by_user_id, assigned_at, revoked_at
) VALUES
  (20, 2, 5, 'COMMITTEE', 1, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (21, 2, 6, 'COMMITTEE', 1, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (22, 3, 6, 'COMMITTEE', 1, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (23, 4, 7, 'COMMITTEE', 1, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (24, 5, 8, 'COMMITTEE', 1, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (25, 3, 6, 'COMMITTEE', 2, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (26, 2, 5, 'COMMITTEE', 2, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (27, 7, 6, 'COMMITTEE', 1, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (28, 8, 6, 'COMMITTEE', 1, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL),
  (29, 9, 6, 'COMMITTEE', 2, '2026-01-01 08:00:00', NULL, 1, '2026-01-01 08:00:00', NULL);

-- =========================================================
-- 9) API-Keys (Stammdaten)
-- =========================================================
INSERT OR IGNORE INTO api_keys (key_id, endpoint, key, is_active, created_dt) VALUES
  (1, '/api/presentation/overlay', 'c8be09f0-1d10-4f6c-b9c1-8abcb6f40540', 1, '2026-01-01 08:00:00'),
  (2, '/api/presentation/overlay', '5d5a4578-ef71-4b53-b8dc-1bfbf97fc5d4', 1, '2026-01-01 08:00:00');

-- =========================================================
-- 10) Optionales Demo-Setup fuer Tests (kein Muss fuer Produktivbetrieb)
-- =========================================================
INSERT OR IGNORE INTO committee_sessions (
  id, committee_id, start_dt, end_dt, start_user_id
) VALUES
  (1, 1, '2026-06-02 18:00:00', NULL, 2);

INSERT OR IGNORE INTO attendances (
  attendance_id, session_id, user_id, start_dt, end_dt
) VALUES
  (1, 1, 2, '2026-06-02 18:00:00', NULL),
  (2, 1, 3, '2026-06-02 18:03:00', NULL),
  (3, 1, 4, '2026-06-02 18:05:00', NULL),
  (4, 1, 5, '2026-06-02 18:01:00', NULL);

INSERT OR IGNORE INTO contributions (
  contribution_id, user_id, session_id, start_dt, end_dt, length_seconds
) VALUES
  (1, 3, 1, '2026-06-02 18:10:00', '2026-06-02 18:12:05', 125),
  (2, 4, 1, '2026-06-02 18:12:10', '2026-06-02 18:14:40', 150);

-- Statuswerte werden bereits in sqlite_ddl_v1.sql gesetzt,
-- diese Inserts sind nur als zusaetzliche Absicherung idempotent.
INSERT OR IGNORE INTO session_protocol_status (id, name) VALUES
  (1, 'EDITING'),
  (2, 'SIGNED_FROM_RECORDER'),
  (3, 'SIGNED_FROM_CHAIR');

INSERT OR IGNORE INTO session_protocols (
  protocol_id, session_id, protocol_recorder_user_id, protocol_status_id, created_dt, updated_dt
) VALUES
  (1, 1, 5, 1, '2026-06-02 19:00:00', '2026-06-02 19:10:00');

INSERT OR IGNORE INTO session_protocol_content (
  content_id, protocol_id, sequence, content_markdown
) VALUES
  (1, 1, 0, '# Einleitung\n\nBeginn der Sitzung.'),
  (2, 1, 100, '## TOP 1\n\nBericht zur Kenntnis genommen.'),
  (3, 1, 2147483647, '# Abschluss\n\nEnde der Sitzung.');

-- Beispiel-Zertifikateintrag fuer Demo-User (nicht echt).
INSERT OR IGNORE INTO users_certificates (
  id, user_id, valid_from, valid_to, revoked, certificate_string, created_dt
) VALUES
  (1, 5, '2026-01-01 00:00:00', '2027-01-01 00:00:00', 0, '-----BEGIN CERTIFICATE-----\nDEMO\n-----END CERTIFICATE-----', '2026-01-01 08:00:00');

COMMIT;
