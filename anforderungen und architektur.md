# Hinweis
Die im folgenden beschriebene Applikation existiert bereits als frühes proof-of-concept in diesem Verzeichnis als nodejs-Applikation. Dort wurde eine Token-basierte Authentifikation verwendet.   Sie soll als ASP.NET-Apllikation mit User/Passwort/JWT-Authentifikation neu aufgebaut werden. Der bestehende Sourcecode soll in ein Unterverzeichnis nodejs_poc verschoben werden Konkret bauen wir Version v1.

# Glossar
- Gremium: Eine für eine bestimmten Zeitraum definierte Teilmenge der user, die sich zu Sitzungen zusammenfinden
- Sitzung: Ein terminiertes Treffen eines Gremiums mit dem Ziel, über vorab kommunizierte Tagesordnungspunkte (Abkürzung TOP) zu debattieren und Entscheidungen zu treffen. Alternativ zu Entscheidungen: Informationen zur Kenntnis zu nehmen
- Vorsitz: Ein Mitglied eines Gremiums, dem diese Rolle mit Bezug zum Gremium gegeben wurde, hat im System das Recht, eine Sitzung des Gremium zu eröffnen, zu starten und zu beenden. Außerdem das Recht, Wortmeldungen aufzurufen und den Wortbeitrag zu beenden
- Personentyp: Fachliche Einordnung einer Person (z.B. Bürgermeister, Ratsmitglied, Sachkundiger Bürger). Ein Personentyp steuert keine Berechtigungen.
- Rolle: Ein Bündel von Rechten. Rollen können global oder gremienbezogen vergeben werden.
- Recht: Eine einzelne erlaubte Aktion im System (z.B. speech.request, session.start, protocol.edit)
- Niederschrift: Die Dokumentation der Tagesordnungspunkte einer Sitzung

# Grundbeschreibung
Die Applikation soll in verschiedenen Sitzungen des Rates der Stadt Greven (Gesamtsitzung, Ausschusssitzungen, Fraktionssitzungen) verwendet werden können, um die folgenden Anwendungsfälle abzudecken
- Anwesenheitsverwaltung für Sitzungen
- Wortmeldungs-Verwaltung einschließlich Messung der Redezeit
- Erstellung der Sitzungsniederschrift einschließlich Review-Workflow


# Technologien
- serverseitig zu einer ASP.NET
- Clientseitig verbindlich: Vite + Lit + TypeScript
- SQLite als Datenbank
- REST-API mit JSON
- Websockets zur Aktualisierung
- Authentifizierung durch Benutzername + Passwort + JSON Web Tokens  (im POC wurden noch GUID-Tokens verwendet, die werden gelöschj)

# Bibliotheken (Festlegungen v1)
Die folgenden Bibliotheken und technischen Bausteine sind für v1 verbindlich festgelegt.

## Backend (ASP.NET)
- ASP.NET Core Web API: HTTP-API, Routing, Middleware, Fehlerbehandlung
- Microsoft.AspNetCore.Authentication.JwtBearer: JWT-Authentifizierung und Autorisierung
- Microsoft.Data.Sqlite + Dapper: SQLite-Zugriff und Mapping (SQL-first-Ansatz)
- DbUp: Ausführung und Versionierung der SQL-Skripte (DDL/Seed)
- Serilog: konfigurierbares Application-Logging
- CsvHelper: Schreiben und Lesen von auditlog.csv
- FluentValidation: Request- und Domain-Validierung
- Swashbuckle (OpenAPI/Swagger): API-Dokumentation und API-Testbarkeit

## Protokoll/PDF und Signierung
- Markdown-Verarbeitung: Markdig
- Template-Verarbeitung: Handlebars.Net
- PDF-Erzeugung und Signierung: iText 7 (+ iText pdfHTML + iText BouncyCastle Adapter)
- Signatur-Stack ist verbindlich: Markdown -> HTML -> PDF -> digitale Signatur (Protokollant, danach Chair)
- Zertifikats- und CSR-Verarbeitung erfolgt ausschließlich in .NET (kein externes Tool, kein Fallback)

## Frontend
- Vite + TypeScript + Lit
- Markdown-Editor für edit_protocol: Toast UI Editor (Fallback-Option: EasyMDE)
- Diagramme (chair_session): Chart.js

## Betrieb und Hilfsfunktionen
- ZIP-Backups: System.IO.Compression (ZipArchive)

## Referenzimplementierung (verbindlicher Techniknachweis)
- Das Testprogramm im Verzeichnis pdf_creation_and_signing_test dient als Referenz für den finalen PDF-/Signatur-Workflow.
- Referenzdateien:
  - pdf_creation_and_signing_test/Program.cs
  - pdf_creation_and_signing_test/pdf_creation_and_signing_test.csproj
  - Ausgabedateien: protocol.pdf, protocol_sigA.pdf, protocol_sigA_sigB.pdf


# Datenbank-Struktur
Die vollständige Datenbank-Struktur ist in der Datei sqlite_ddl_v1.sql beschrieben.
Beispiel- und Stammdaten für Entwicklungs- und Testumgebungen sind in sqlite_seed_v1.sql beschrieben.

Wichtig:
- Rollen und Rechte sind getrennt modelliert.
- Eine Rolle ist ein Bündel von Rechten.
- Rechte werden über role_rights einer Rolle zugeordnet.
- Rollen werden über user_role_assignments einem User zugewiesen (global oder gremienbezogen).
- Das lokale Credential-Modell enthält ein Flag must_change_password für den v1-Initialbetrieb.

Hinweis zu api_keys: Der API-Key ist eine UUID. Die Tabelle wird manuell gepflegt. In v1 wird der API-Key in der Datenbank im Klartext gespeichert (kein Hashing).

## Passwort-Initialisierung (v1 pragmatisch)
- Seed-Accounts erhalten ein temporäres Initialpasswort (als Hash) und sind mit must_change_password=1 markiert.
- Beim ersten erfolgreichen Login wird der Nutzer zwingend auf die Passwort-Ändern-Seite geführt.
- Erst nach erfolgreicher Änderung wird must_change_password auf 0 gesetzt.
- Passwort-Reset in manage_users setzt ein neues temporäres Passwort und must_change_password wieder auf 1.
- password_hash bleibt immer NOT NULL; ein "NULL = noch nicht gesetzt"-Sonderfall wird in v1 nicht verwendet.
- Beim Passwortwechsel sind zwei identische Eingaben verpflichtend (Neues Passwort + Wiederholung). Ohne Übereinstimmung darf nicht gespeichert werden.
- Die UI soll Browser-/Passwortmanager-Vorschläge für starke neue Passwörter aktiv unterstützen (Autocomplete-Standard für new-password).

# Kommunikationskonzept
Der Server stellt für jeden Anwendungsfall eine SPA-Website zur verfügung. Die Website holt sich dann über die Rest-API die dynamischen Inhalte. Listen sollen in angemessener Häufigkeit (3sek) gepollt werden.

Für zukünftige Version: Um die Liste der Wortmeldungen und der eingebuchten Teilnehmer sehr dynamisch aktualisieren zu können, soll außerdem eine Websocket-Verbindung vorgesehen werden. Die Website baut zunächst die Websocket-Verbindung auf und registiert sich damit implizit für Aktualisierungsnachrichten. Der Server erkennt den Neuaufbau und sendet die komplette aktuelle Liste an den Client und deren Versionsnummer an den Client. Jede Aktualisierung der Liste inkrementiert deren Versionsnummer. Jede Aktualisierung bewirkt, dass alle Clients eine Update-Nachricht bekommen.

# Berechtigungskonzept
Jeder Anwendungsfall soll durch eine eigene Website unter einer eigenen URL abgebildet werden. Ein Benutzer hat 1...N Rollen. Eine Rolle bündelt Rechte; die Rechte steuern den Zugriff auf Seiten und Aktionen. Rechte können sich auf ein bestimmtes Gremium beschränken oder allgemeingültig, also pauschal für alle Gremien gültig, sein. Ein Nutzer mit Rolle "system_admin" darf alles.
Eine User darf mehrere allgemeingültige Rollen haben. Er darf auch in Bezug zu einem Gremium mehrere Rollen haben.
Der Zugriff auf Funktionen erfolgt immer über Rechteprüfung (nicht über URL-Namen von Rollen). Das Dashboard muss passend zu den zugewiesenen Rechten aufgebaut werden.


## Nicht funktionale Anforderungen
- Kommunikation verschlüsselt!
- Datenschutzaspekte: Es werden persönliche Daten verarbeitet. Nur ein entsprechend berechtigter Nutzer darf dies einsehen
- Nachvollziehbarkeit: Alle Änderungen an Rechten und Zugehörigkeiten müssen in einer log-Datei "auditlog.csv (Zeitstempel, Nutzer, Änderung) protokolliert werden. Alle weiteren Änderungen müssen nicht protokolliert, sondern nur in der Datenbank abgelegt werden.
- Logging: Die Arbeitsweise des Programms soll durch ein konfigurierbares logging nachvollzogen werden können
- Barrierefreiheit: Kann insofern realisiert werden, dass in der HTML-UI nicht unpassende Strukturen (blinde Tabellen, verschachtelte DIV), sondern "screen reader kompatible" Elemente (flexbox + einfache Struktur?) verwendet werden
- Backup wird im Anwendungsfall "administrator" beschrieben
- Browser-Kompatibilität: Es müssen nur neue Browser unterstützt werden (bitte keine Altlasten!)

- TODO an die KI: Stelle hier Ideen / Formulierungen für weitere Nicht-funktionale Anforderungen ein.
- Dieser TODO-Block ist explizit NICHT Teil von v1 und wird erst für spätere Versionen ausgearbeitet.
## Nicht-Funktionale Anforderung Konfiguration
Die Software soll eine von ASP.NET gut unterstützte Konfigurationsstrategie über JSON- oder yml-Dateien verwenden, um die folgenden Informationen abzulegen
- voller Pfad zum Zertifikat-Container (.pfx) der CA, die zum Signieren von Nutzerzertifikaten benötigt wird
- voller Pfad zur Zertifikat-Container-Datei (also der Datei, die sowohl), die für die HTTPS-Verschlüsselung benötigt wird
- Einstellungen für das Zertifikat (CN, OU, O, L, ST, C)
- Hinweis: CSR-Verarbeitung und Signierung erfolgen in v1 ausschließlich in .NET (kein externes Tool, kein Fallback)
- Bei einem Neustart/Crash ist die Wortmeldungsliste weg. Das ist ok

# Anwendungsfall-Beschreibungen bzw. Beschreibung der UI
Jeder Anwendungsfall ist durch eine eigene Webseite mit jeweils angepasster UI dargestellt. Einzig der Header mit Logo und Menü und der Footer und das CSS-Design sind gleich

Modernes und sehr reduziertes Design. Insbesondere für die Dashboards kompakte Darstellung. Das heißt: Keine Panels mit Badges, sondern gebänderte Tabellen mit sinnvollen, am Inhalt orientierten Spaltenbreiten.
Im Header soll immer das Bild in der Datei "Logo_Stadt_Greven.svg" angezeigt werden. Außerdem horizontales Menü mit Links zu den vom Nutzer (wg. Berechtigung) erreichbaren Seiten. Responsive Design (Menü -->"Hamburger, Logo kleiner, zweispaltig -->einspaltig).
Im Footer Link zum Impressum und Zeitstempel der Bereitstellung und des GIT-Commits (+dirty).

## login
Eingabe Benutzername und Passwort.
Wenn must_change_password=1 ist, erfolgt nach erfolgreichem Login eine erzwungene Umleitung zum Passwortwechsel.

## dashboard (Alias /)
Das dashboard ist der Standard-Anwendungsfall und ist über die root-URL (nach login!) erreichbar. Alle user haben Zugang zu diesem Dashboard.

### Layout vor Beitritt zu einer Sitzung
- Panel "Aktive Sitzungen": Es werden alle gegenwärtig laufenden Sitzungen angezeigt, in die man sich gemäß Berechtigungen einklinken könnte. Dahinter jeweils ein Button: Beitreten. Sobald man einer bestehenden Sitzung beigetreten ist, ändert sich die Anzeige. Außerdem wird die Anwesenheit ab dann erfasst. Ein bloßer Login genügt also nicht.
- Darunter Panel "Neue Sitzung eröffnen".Es werden alle Gremien angezeigt, in denen man eine Vorsitzender-Rolle hat und in denen gerade keine Sitzungen eröffnet sind. Dahinter jeweils ein Button "Sitzung öffnen". Ein Klick darauf öffnet nicht nur die Sitzung, sondern führt den Vorsitzenden auch direkt zum chairdashboard. In eine offene Sitzung können dann weitere Teilnehmer beitreten. Von jedem Gremium kann es zu einem Zeitpunkt nur eine geöffnete Sitzung geben. Zu einem Zeitpunkt können aber mehrere Sitzungen, nämlich von unterschiedlichen Gremien existieren.

### Layout nach Beitritt zu einer Sizung
- Panel zur Bedienung mit Button "Sitzung verlassen" und Button "Wortmeldung"
-- "Sizung verlassen" wird nur nach "Möchten Sie wirklich"-Sicherheitsabfrage durchgeführt
-- "Wortmeldung" lockt sich ein. Button ändert sich in "Wortmeldung zurücknehmen" und damit kann man sich wieder aus der Rednerliste austragen. Wird man vom Vorsitzenden Aufgerufen, dann wird die Wortmeldung automatisch zurück genommen.
- Darunter Panel mit aktuell aktiven Wortmeldungen. Falls eine Person vom Vorsitzenen aufgerufen wurde und sprechen darf, wird diese Farblich hervorgehoben. Ist man selbst der Redner, soll ein grünes bildschirmfüllendes Overlay mit dem weißen großen Text "Sprechen Sie bitte" angezeigt werden.


## manage_users
CRUD für alle User (wobei ein Löschen nur ein "inaktiv" setzen bedeutet) , insbesondere auch:
- Passwort eines Nutzers auf einen Standardwert zurücksetzen
- Rechte eines Nutzers verwalten

Hinweis: Ein Passwort-Reset setzt im Credential-Datensatz must_change_password=1.

## manage_my_user
Selbst-Management des angemeldeten Nutzers. Auf diese Seite haben alle authentifizierten Nutzer Zugriff (heißt: Um auf "manage_my_user" zugreifen zu können, braucht man nicht das Recht/die Rolle "manage_my_user")
Panel "Passwort ändern" mit den folgenden Regeln:
- Zwei Eingabefelder für das neue Passwort (Passwort und Bestätigung), die identisch sein müssen.
- Übliche Komplexität einfordern (mindestens 10 Zeichen, mindestens 1 Großbuchstabe, mindestens 1 Zahl).
- Browser-/Passwortmanager-Vorschläge für neue starke Passwörter sollen aktiv unterstützt werden.
Panel "Zertifikat erstellen" (wird angezeigt, sofern der Nutzer noch kein gültiges Zertifikat erstellt hat.)
Die UI unterstützt das folgende schrittweise Vorgehen:
- Schritt 1 User klickt auf  Button "Erzeugen" hinter Beschreibungstext "Erzeuge zufälligen privaten Schlüssel". Browser erstellt zufälligen privaten Schlüssel und zeigt ihn an
- Schritt 2: User klickt auf Button "Speichern" hinter Beschreibung "Privaten Schlüssel als Datei speichern". Browser bietet das Abspeichern an.
- Schritt 3: User klickt auf "Erzeugen und Senden" hinter "Öffentlichen Schlüssel aus privatem Schlüssel erzeugen, und zusammen mit Informationen zur Person als Certificate Signing Request an den Server senden, fertiges Zertifikat auf dem Server ablegen". Browser sendet CSR an den Server, Server verarbeitet und signiert in .NET, Server legt Zertifikat in der Datenbank ab
- Schritt 5: User klickt auf "Zertifikat runterladen und lokal speichern" Browser fordert Zertifikat vom Server an und bietet das lokale Abspeichern an


## chair_session (alias chair)
Dashboard für den Vorsitzenden zur Leitung und Steuerung einer Sitzung
### Layout:
- Header "Sitzung <Gremienname>" 
- Kontrollpanel 
-- Button "Sitzung starten" (Nach dem Start können weiterhin Teilnehmer beitreten. Unterscheide: Mit der Eröffnung können teilnehmer beitreten. Ab dem Start können Wortmeldungen abgegeben werden.)
-- Button "Sitzung beenden" (nach Sicherheitsabfrage!), 
-- Sitzungsbeginn, 
-- Dauer bis jetzt
-- Tortendiagramm mit den Redeanteilen
-- Aktuell Sprechender
- Dann Zweispaltiges  Layout (resposiv). 
-- Links die Wortmeldungsliste
-- Rechts die Anwesenheitsliste
### Zur Wortmeldungsliste
Wenn ein Ratsmitglied sich meldet, wird es unten an die Wortmeldungsliste angehängt. Die Liste wird als kompakte Tabelle dargestellt. Erste Spalte "Nachname, Vorname (Fraktion)". Zweite Spalte mit den fünf horizontal nebeneinander stehenden Buttons
- Wortmeldung aufrufen, dargestellt als Button mit dem Wiedergabe/Play-Symbol
- Wortbeitrag beenden, dargestellt als Button mit dem Stop-Symbol
- Eintrag ganz nach oben, dargestellt als Button mit dem Symbol zwei Pfeile nach oben
- Eintrag hoch, dargestellt als Button mit dem Symbol Pfeil nach oben
- Eintrag runter, dargestellt als Button mit dem Symbol Pfeil nach unten
- Eintrag löschen, dargestellt als Button mit dem Symbol Mülleimer

Ein Klick auf "Play" färbt die Zeile grün ein und "Play" wird zum "Pause"-Symbol. Die Zeitmessung beginnt. Ein Klick auf Pause pausiert die Zeitmessung, aber der Eintrag bleibt grün. Ein Klick auf Stop beendet die Zeitmessung. Der Eintrag verschwindet auch aus der Liste.
Ein Klick auf ein anderes Play stellt zunächst eine "Sind Sie sicher"-Rückfrage. Falls "Ja", dann wird der gegenwärtige Wortbeitrag gestoppt und der angeklickte gestartet. Die Wortmeldungsliste wird im Server lediglich im RAM abgelegt (Dictionary session_id -->Wortmeldungsliste).  Nur die tatsächlich aufgerufenen Beiträge werden dann in der Datenbank dokumentiert. Es darf pro Sitzung immer nur genau einen aktiven Redner geben. Eine pausierte Wortmeldung kann fortgesetzt werden. Redezeiten müssen pro Sitzung erfasst werden. Eine Pausierung schließt einen Beitrag in der Datenbank ab (length_seconds wird gesetzt). Ein erneutes Anstarten erstellt einen neuen Eintrag in der Datenbank. Der Ende-Zeitpunkt entspricht beim Erstellen den Start-Zeitpunkt des Redebeitrags. Die korrekte Ende-Zeit wird also beim Pausieren oder beim Stoppen gesetzt.

### Zur Anwesenheitsliste
Wenn sich ein entsprechend berechtigter Nutzer in eine Sitzung einklinkt, dann erscheint er in der Anwesenheitsliste. Direkt nach Eröffnung einer Sitzung ist da zunächst nur der Vorsitzende selbst eingetragen.

### Hinweis
Der Chair kann sich insbesondere auch selbst in die Redeliste aufnehmen. Wenn er dran ist, darf der Bildschirm NICHT mit einem grünen Overlay quasi unbedienbar werden, weil sonst der Chair seine eigene Rede nicht beenden könnte


## administer_system (alias admin)
Diese Website enthält
- Panel Test: eine gute Auswahl an Klick-Links zum Testen der REST-API
- Panel System Info: Systeminformation, unter anderem:
-- die Version der RatLive-Software, 
-- die Dateigröße von Datenbank und Log-Datei und Audit-Datei
- Informationen zum Zertifikatsdienst in .NET (aktiv/fehlerhaft, letzte Signiermeldung)
- Panel Datensicherung: Datenbank, Log-Datei(en), Audit-Datei(en) und ggf weitere? Daten werden auf Klick in ein ZIP-Archiv gepackt und zum Download angeboten


 ## edit_protocol
 In zwei verknüpften Dropdowns "Gremium" und "Sitzung" lassen sich geöffnete oder abgeschlossene Sitzungen auswählen und dafür die Niederschrift erstellen und editieren. Die Niederschrift kann gemäß Berechtigungskonzept von jeder Person erstellt werden, die das Recht bzw die Rolle "edit_protocol" hat. Alle Texte sollen im Browser in einem Online-Markdown-Editor Blockweise geschrieben werden

 ### Bedienlogik
 Ein neues Protokoll soll mit einem Einleitung- und einem Abschluss-Block mit Freitext vorbelegt werden. Zwischen diesen beiden Elementen können nun Blöcke einfefügt werden. Welche Blöcke dies sind und welches Template für diesen Block im Editor eingefügt wird, wird über template-Dateien im "./protocol_templates"-Ordner bestimmt. Dort sollen bei Auslieferung existieren:
 - ./protocol_templates/global_header.md: Äußerer Header der Gesamtdokumentes
 - ./protocol_templates/header_template.md: Template für den Einleitungs-Block
 - ./protocol_templates/footer_template.md: Template mit den Abschlussblock
 - ./protocol_templates/block/<Anzeigename>.md Template für den Bl
 - ./protocol_templates/global_footer.md: Abschluss der Gesamtdokumentes
 - ./protocol_templates/resources/... : Hier können weitere Ressourcen (Bilder) liegen, die im Dokument benötigt werden und über Markdown eingebunden werden
Bei Auslieferung der Software sollen alle Templates befüllt sein. Außerdem sollen die folgenden Block-Templates erstellt sein
 1.) Tagesordnungspunkt mit Kenntnisnahme (Template-Inhalt "Überschrift TOP xyz, Leerzeile, lorem ipsum, Ergebnis: Zur Kenntnis genommen")
 2.) Tagesordnungspunkt mit Beschluss (Template-Inhalt "Überschrift TOP xyz, Leerzeile, lorem ipsum, Ergebnis: Ja x, Nein y, Enthaltungen z")
 3.) Freitext (Template-Inhalt "Lorem Ipsum")

Der Block wird eingefügt und der Editor für den Block wird in Abhängigkeit des Typs mit einem passenden Template versorgt. 

 ### Dynamischer Text
Innerhalb des Markdowns, besonder in den Headern kann "Handlebars" verwendet werden, um dynamischen Text/Textblöcke zu generieren. Für dieses Templating stehen die folgenden Variablen zur Verfügung
- Gremienname, Sitzungsdatum und Sitzungszeit
- Vorsitzender, Protokollführer
- Datum der Protokollerstellung (also der Durchführung des Templating-Prozesses mit dem Ziel, ein PDF zu erstellen)
- Anwesende Teilnehmer (Name, Vorname, Fraktion)

 ### Design des Editors
 Für die Eingabe soll ein leistungsfähiger Browserbasierter Editor für Markdown eingebunden werden.  Blöcke zwischen Einleitung und Abschluss können verschoben werden nach oben oder nach unten. Blöcken können gelöscht werden. Neue Blöcke können hinzugefügt werden. Die Reihenfolge der Blocke wird über eine Sequenznummer vordefiniert. Einleitung hat immer die Sequenznummer 0 und Abschluss immer den größten numerischen Wert (bzw einen sehr großen wert, bspw (2^31)-1)). Ganz unten gibt es ein Button "Speichern", der die Infos in der Datenbank aktualsiert

 ### Workflow
 Ganz unten gibt es auch einen Button "PDF generieren". Dieser speichert zunächst in der Datenbank und lässt dann ein PDF-Dokument erstellen. Das PDF-Dokument enthält die Blöcke in der folgenden Reihenfolge
 - global_header
 - Blöcke gemäß Sequenznummer aufsteigend (also zuerst Einleitung, dann "normale" Blöcke und dann Abschluss)
 - global_footer
 
  Dieses PDF-Dokument wird außerdem unmittelbar mit dem Zertifikat des Protokollanten digital signiert und damit auch vor Veränderungen geschützt (wobei PDF-Kommentare möglich bleiben sollen). Das PDF-Dokument wird auf dem Server im unterverzeichnis /session_protocols/signed_from_recorder/<id des gremiums>/<yyyy-MM-dd> <id der session> abgelegt

## sign_protocol
Alle User mit dem "chair_session"-Recht haben auch das recht, diese Seite zu öffnen, also diesen Anwendungsfall zu nutzen.
Dem Nutzer werden alle Dokumente angezeigt, die sich im Ordner /session_protocols/signed_from_recorder/<id des gremiums> befinden. Es sollen alle Gremien-ids durchsucht werden, für die der User eben das "chair_session" Recht hat. Es soll nach Gremium gruppiert werden. Der User kann sich das Dokument downloaden und er kann es mit seinem Zertifikat digital signieren. Ein derart signiertes Dokument wird aus dem /signed_from_recorder/-Ordner entfernt und in einem entsprechenden /signed_from_chair/-Ordner abgelegt. Damit ist der Workflow beendet
  

# Python-basiertes Präsentationsprogramm
Es soll ein Python-Programm implementiert werden, das unter Verwendung eines besonderes REST-Endpunktes per sekündlichem Polling ständig die aktuelle Wortmeldungsliste und die kummulierten Redezeiten als Overlay auf dem Bildschirm darstellt. Dieser Endpunkt verlangt eine Autentifizierung über einen API-Key, der in der Tabelle "api_keys" eingetragen sein muss. 