-- P1: non-destructive D1 revision history for saved knowledge items.
-- Live content remains in knowledge; only prior versions of edited items are recorded.
-- On permanent delete, both the knowledge item and its revisions are deleted.
CREATE TABLE IF NOT EXISTS knowledge_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('file','note','correction')),
  content TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_knowledge_revisions_item ON knowledge_revisions(item_id,id DESC);
