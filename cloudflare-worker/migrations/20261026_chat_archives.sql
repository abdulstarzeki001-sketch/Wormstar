-- Protected Wormstar NEO chat archives: one opt-in transcript per analysis mode.
-- Access is ONLY through authenticated Cloudflare Worker API; never public.
CREATE TABLE IF NOT EXISTS chat_archives (
 mode TEXT PRIMARY KEY CHECK(mode IN ('assistant','code','logs','ioc','ctf','report')),
 transcript TEXT NOT NULL CHECK(length(transcript) <= 80000),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
