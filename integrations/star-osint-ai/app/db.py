import sqlite3
from datetime import datetime, timezone
from .config import db_path

SCHEMA = '''
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS projects (
 id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL UNIQUE,
 label TEXT NOT NULL, authorized INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scans (
 id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id),
 status TEXT NOT NULL CHECK(status IN ('queued','running','done','failed')),
 started_at TEXT, finished_at TEXT, created_at TEXT NOT NULL,
 error TEXT NOT NULL DEFAULT '', options_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS findings (
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id),
 kind TEXT NOT NULL, value TEXT NOT NULL, source TEXT NOT NULL,
 confidence TEXT NOT NULL CHECK(confidence IN ('low','medium','high')),
 detail_json TEXT NOT NULL, collected_at TEXT NOT NULL,
 UNIQUE(scan_id,kind,value,source)
);
CREATE TABLE IF NOT EXISTS scan_sources (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 scan_id INTEGER NOT NULL REFERENCES scans(id),
 source TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','running','done','failed')),
 findings INTEGER NOT NULL DEFAULT 0,
 error TEXT NOT NULL DEFAULT '',
 started_at TEXT, finished_at TEXT,
 UNIQUE(scan_id,source)
);
CREATE INDEX IF NOT EXISTS idx_scan_sources_scan ON scan_sources(scan_id);
CREATE TABLE IF NOT EXISTS reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL UNIQUE REFERENCES scans(id),
 status TEXT NOT NULL DEFAULT 'queued', model TEXT NOT NULL DEFAULT '',
 summary_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 error TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, detail TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_scans_project ON scans(project_id);
'''

def utcnow():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')

def connect():
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA busy_timeout=10000')
    return conn

def init_db():
    with connect() as db:
        db.executescript(SCHEMA)
        # Mark interrupted in-memory tasks so they are not permanently stuck.
        db.execute("UPDATE scans SET status='failed', error='Interrupted by server restart', finished_at=? WHERE status IN ('queued','running')", (utcnow(),))
        db.execute("UPDATE reports SET status='failed', error='Interrupted by server restart', updated_at=? WHERE status IN ('queued','running')", (utcnow(),))
        db.execute("UPDATE scan_sources SET status='failed', error='Interrupted by server restart', finished_at=? WHERE status IN ('queued','running')", (utcnow(),))

def audit(action, detail):
    with connect() as db:
        db.execute('INSERT INTO audit(action,detail,created_at) VALUES (?,?,?)', (action, str(detail)[:500], utcnow()))
