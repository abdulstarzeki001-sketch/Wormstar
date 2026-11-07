-- Owner-only throttling/audit locks. Text prompts, credentials and scanner response bodies are never stored here.
CREATE TABLE IF NOT EXISTS security_job_locks (
  bucket TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('scan','agent')),
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_job_locks_created ON security_job_locks(created_at);
