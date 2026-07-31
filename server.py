#!/usr/bin/env python3
"""
SOE Reality Check — local SPA + session API server.

Usage:
  python3 server.py
  python3 server.py 8080

Participant: http://localhost:8080/benchmarking-event/TEST-001
Host:        http://localhost:8080/host/TEST-001
Host key:    soe-host-2026
"""

from __future__ import annotations

import json
import os
import re
import sys
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
SESSIONS_FILE = DATA_DIR / "sessions.json"
HOST = "0.0.0.0"
DEFAULT_PORT = 8080

_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load() -> dict:
    if not SESSIONS_FILE.exists():
        return {}
    try:
        return json.loads(SESSIONS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = SESSIONS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(SESSIONS_FILE)


def ensure_session(data: dict, sid: str) -> dict:
    sid = sid.strip().upper()
    if sid not in data:
        data[sid] = {"id": sid, "createdAt": _now(), "responses": []}
    return data[sid]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, code: int, obj) -> None:
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            return {}

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        path = unquote(self.path.split("?", 1)[0])

        if path == "/api/health":
            return self._json(200, {"ok": True, "service": "soe-reality-check"})

        m = re.match(r"^/api/session/([^/]+)/?$", path)
        if m:
            sid = unquote(m.group(1)).strip().upper()
            with _lock:
                data = _load()
                session = ensure_session(data, sid)
                _save(data)
            return self._json(200, session)

        # Static file if it exists
        rel = path.lstrip("/")
        if rel and (ROOT / rel).is_file():
            return super().do_GET()

        # SPA routes → index.html
        if (
            path == "/"
            or path.startswith("/benchmarking-event/")
            or path.startswith("/host/")
            or not Path(rel).suffix
        ):
            self.path = "/index.html"
            return super().do_GET()

        return super().do_GET()

    def do_POST(self) -> None:
        path = unquote(self.path.split("?", 1)[0])
        m = re.match(r"^/api/session/([^/]+)/response/?$", path)
        if not m:
            return self._json(404, {"error": "Not found"})

        sid = unquote(m.group(1)).strip().upper()
        payload = self._read_json()
        if not payload.get("role"):
            return self._json(400, {"error": "role required"})

        with _lock:
            data = _load()
            session = ensure_session(data, sid)
            response = {
                "id": payload.get("id") or f"r_{os.urandom(4).hex()}",
                "role": payload.get("role"),
                "seat": payload.get("seat"),
                "answers": payload.get("answers") or {},
                "byGear": payload.get("byGear") or {},
                "overall": payload.get("overall"),
                "completedAt": payload.get("completedAt") or _now(),
            }
            session["responses"].append(response)
            _save(data)

        return self._json(200, {"session": session, "response": response})

    def do_DELETE(self) -> None:
        path = unquote(self.path.split("?", 1)[0])
        m = re.match(r"^/api/session/([^/]+)/?$", path)
        if not m:
            return self._json(404, {"error": "Not found"})

        sid = unquote(m.group(1)).strip().upper()
        with _lock:
            data = _load()
            if sid in data:
                del data[sid]
                _save(data)
        return self._json(200, {"ok": True, "id": sid})


def main() -> None:
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port: {sys.argv[1]}", file=sys.stderr)
            sys.exit(1)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not SESSIONS_FILE.exists():
        _save({})

    httpd = ThreadingHTTPServer((HOST, port), Handler)
    print(f"SOE Reality Check → http://localhost:{port}")
    print(f"  Participant: http://localhost:{port}/benchmarking-event/TEST-001")
    print(f"  Host:        http://localhost:{port}/host/TEST-001")
    print(f"  Host key:    soe-host-2026")
    print("Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        httpd.server_close()


if __name__ == "__main__":
    main()
