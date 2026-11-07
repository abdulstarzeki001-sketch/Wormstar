-- Dedicated GitHub repository knowledge, isolated from owner-personal memory.
-- Apply to D1 database wormstar_ai_memory. Contents are fetched from a pinned
-- public GitHub commit and filtered; no private files, auth tokens or QR captures.
CREATE TABLE IF NOT EXISTS repo_file_index(
 path TEXT PRIMARY KEY, blob_sha TEXT NOT NULL, revision TEXT NOT NULL,
 byte_size INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL
 CHECK(kind IN ('text','metadata')), content TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS repo_file_index_revision ON repo_file_index(revision);
CREATE TABLE IF NOT EXISTS repo_fragments(
 vector_id TEXT PRIMARY KEY, path TEXT NOT NULL, ordinal INTEGER NOT NULL,
 line_start INTEGER NOT NULL, line_end INTEGER NOT NULL, content TEXT NOT NULL,
 FOREIGN KEY(path) REFERENCES repo_file_index(path) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS repo_fragments_path ON repo_fragments(path);
CREATE TABLE IF NOT EXISTS repo_sync_state(
 id INTEGER PRIMARY KEY CHECK(id=1), head_sha TEXT NOT NULL DEFAULT '',
 cursor TEXT NOT NULL DEFAULT '', total INTEGER NOT NULL DEFAULT 0,
 visited INTEGER NOT NULL DEFAULT 0, complete INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO repo_sync_state(id) VALUES(1);
