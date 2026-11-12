-- Dedicated owner-scoped remote OSINT job queue. No secrets or raw private data.
-- Apply manually to wormstar_ai_memory D1 before enabling the agent.
CREATE TABLE IF NOT EXISTS osint_jobs (
 id TEXT PRIMARY KEY,
 domain TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','running','done','failed')),
 collectors_json TEXT NOT NULL,
 analyze INTEGER NOT NULL DEFAULT 0 CHECK(analyze IN (0,1)),
 claim_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 started_at TEXT,
 finished_at TEXT,
 error TEXT NOT NULL DEFAULT '',
 result_json TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS osint_jobs_queue ON osint_jobs(status,created_at);
