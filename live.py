import ctypes
import json
import os
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request

import keyboard
from PyQt5 import QtCore, QtGui, QtWidgets

try:
    import secret as _secret
except ImportError:
    _secret = None

ADMIN_SESSION_KEY = getattr(_secret, "ADMIN_SESSION_KEY", "")
API_BASE_URL = getattr(_secret, "API_BASE_URL", "http://localhost:3000")
OVERLAY_SCREEN_INDEX = getattr(_secret, "OVERLAY_SCREEN_INDEX", None)


# Windows-Konstanten
WS_EX_LAYERED = 0x80000
WS_EX_TRANSPARENT = 0x20
GWL_EXSTYLE = -20

OPEN_SPEECH_STATUSES = {"REQUESTED", "ACTIVE", "PAUSED"}
STATUS_LABELS = {
    "REQUESTED": "Gemeldet",
    "ACTIVE": "Aktiv",
    "PAUSED": "Pausiert",
}


def get_configured_token() -> str:
    # Reihenfolge: Env-Override > secret.py
    return os.getenv("RATLIVE_ADMIN_SESSION_KEY", "").strip() or ADMIN_SESSION_KEY.strip()


def parse_optional_non_negative_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def get_preferred_screen_index(argv: list[str]) -> int | None:
    # Prioritaet: CLI --screen > Env > secret.py
    for index, arg in enumerate(argv):
        if arg == "--screen" and index + 1 < len(argv):
            return parse_optional_non_negative_int(argv[index + 1])
        if arg.startswith("--screen="):
            return parse_optional_non_negative_int(arg.split("=", 1)[1])

    env_value = os.getenv("RATLIVE_SCREEN_INDEX", "").strip()
    if env_value:
        return parse_optional_non_negative_int(env_value)

    return parse_optional_non_negative_int(OVERLAY_SCREEN_INDEX)


def choose_screen(app: QtWidgets.QApplication, preferred_index: int | None) -> QtGui.QScreen:
    screens = app.screens()
    if not screens:
        raise RuntimeError("Kein Bildschirm gefunden")

    if preferred_index is not None and 0 <= preferred_index < len(screens):
        return screens[preferred_index]

    if len(screens) == 1:
        return screens[0]

    primary_screen = app.primaryScreen()
    current_index = screens.index(primary_screen) if primary_screen in screens else 0
    options: list[str] = []
    for idx, screen in enumerate(screens):
        geometry = screen.geometry()
        options.append(f"{idx}: {screen.name()} ({geometry.width()}x{geometry.height()} @ {geometry.x()},{geometry.y()})")

    selected_text, confirmed = QtWidgets.QInputDialog.getItem(
        None,
        "Bildschirm waehlen",
        "Overlay auf Bildschirm:",
        options,
        current_index,
        False,
    )

    if confirmed and selected_text:
        selected_index = parse_optional_non_negative_int(selected_text.split(":", 1)[0])
        if selected_index is not None and selected_index < len(screens):
            return screens[selected_index]

    return screens[current_index]


def build_state_url(base_url: str, token: str) -> str:
    query = urllib.parse.urlencode({"token": token})
    return f"{base_url.rstrip('/')}/api/state?{query}"


def fetch_dashboard_state(base_url: str, token: str) -> tuple[dict | None, str | None]:
    if not token:
        return None, "Kein Token gesetzt. Bitte in secret.py ADMIN_SESSION_KEY setzen."

    url = build_state_url(base_url, token)
    request = urllib.request.Request(url, method="GET")

    try:
        with urllib.request.urlopen(request, timeout=4) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
            return None, f"API Fehler {exc.code}: {payload.get('error', 'Unbekannt')}"
        except Exception:
            return None, f"API Fehler {exc.code}"
    except Exception as exc:  # noqa: BLE001
        return None, f"Verbindungsfehler: {exc}"

    if not payload.get("ok"):
        return None, f"API Antwortfehler: {payload.get('error', 'Unbekannt')}"

    return payload.get("state", {}), None


def render_speaker_lines(state: dict) -> list[str]:
    lines: list[str] = []
    running_sessions = state.get("runningSessions", [])

    for session in running_sessions:
        speeches = [
            speech
            for speech in session.get("speeches", [])
            if speech.get("status") in OPEN_SPEECH_STATUSES
        ]
        speeches.sort(key=lambda speech: (speech.get("sequenceNumber", 10_000), speech.get("speechId", 10_000)))

        if not speeches:
            continue

        committee_name = session.get("committeeName", "Unbekanntes Gremium")
        lines.append(f"{committee_name}")

        for speech in speeches:
            seq = speech.get("sequenceNumber", "-")
            first_name = speech.get("firstName", "")
            last_name = speech.get("lastName", "")
            faction = speech.get("faction") or "-"
            status = STATUS_LABELS.get(speech.get("status", ""), speech.get("status", "?"))
            lines.append(f"  {seq}. {last_name}, {first_name} ({faction}) [{status}]")

        lines.append("")

    if not lines:
        return ["Aktuelle Rednerliste", "Keine offenen Redebeitraege."]

    if lines[-1] == "":
        lines.pop()

    return ["Aktuelle Rednerliste"] + lines


class Overlay(QtWidgets.QWidget):
    text_update_signal = QtCore.pyqtSignal(str)

    def __init__(self, screen: QtGui.QScreen):
        super().__init__()
        self.stop_event = threading.Event()

        self.setWindowFlags(
            QtCore.Qt.FramelessWindowHint |
            QtCore.Qt.WindowStaysOnTopHint |
            QtCore.Qt.Tool
        )
        self.setAttribute(QtCore.Qt.WA_TranslucentBackground)

        geometry = screen.geometry()
        self.setGeometry(geometry)
        self.label_margin = 24

        self.label = QtWidgets.QLabel("Aktuelle Rednerliste\nLade...", self)
        self.label.setStyleSheet(
            """
            color: #1f2a35;
            font-size: 20px;
            font-weight: 700;
            background: rgba(255, 255, 255, 0.75);
            border: 1px solid rgba(31, 42, 53, 0.2);
            border-radius: 14px;
            padding: 14px;
            """
        )
        self.label.setWordWrap(True)
        self.label.setAlignment(QtCore.Qt.AlignLeft | QtCore.Qt.AlignTop)
        label_width = min(900, max(420, geometry.width() - 2 * self.label_margin))
        label_height = min(420, max(220, geometry.height() - 2 * self.label_margin))
        self.label.resize(label_width, label_height)
        self.position_label_bottom_right()

        self.text_update_signal.connect(self.label.setText)
        self.make_click_through()
        self.start_api_polling()

    def closeEvent(self, event):  # noqa: N802
        self.stop_event.set()
        super().closeEvent(event)

    def resizeEvent(self, event):  # noqa: N802
        super().resizeEvent(event)
        self.position_label_bottom_right()

    def position_label_bottom_right(self):
        x = max(self.label_margin, self.width() - self.label.width() - self.label_margin)
        y = max(self.label_margin, self.height() - self.label.height() - self.label_margin)
        self.label.move(x, y)

    def make_click_through(self):
        hwnd = int(self.winId())
        styles = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        styles |= WS_EX_LAYERED | WS_EX_TRANSPARENT
        ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, styles)

    def start_api_polling(self):
        base_url = os.getenv("RATLIVE_API_BASE_URL", API_BASE_URL).strip() or "http://localhost:3000"

        def worker():
            while not self.stop_event.is_set():
                token = get_configured_token()
                state, error = fetch_dashboard_state(base_url, token)
                if error:
                    text = f"Aktuelle Rednerliste\n{error}"
                else:
                    text = "\n".join(render_speaker_lines(state or {}))

                self.text_update_signal.emit(text)
                self.stop_event.wait(2.5)

        threading.Thread(target=worker, daemon=True).start()

    def paintEvent(self, event):  # noqa: N802
        painter = QtGui.QPainter(self)
        painter.setCompositionMode(QtGui.QPainter.CompositionMode_Source)
        painter.fillRect(self.rect(), QtCore.Qt.transparent)


def hotkey_listener(app):
    keyboard.wait("ctrl+shift+q")
    app.quit()


if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    preferred_screen_index = get_preferred_screen_index(sys.argv[1:])
    selected_screen = choose_screen(app, preferred_screen_index)
    overlay = Overlay(selected_screen)
    overlay.show()

    threading.Thread(target=hotkey_listener, args=(app,), daemon=True).start()
    sys.exit(app.exec_())