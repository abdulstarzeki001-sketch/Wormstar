-- Wormstar NEO single-owner Supabase memory identity binding.
-- Stores ONLY verified Supabase Auth user ID and optional account email, never JWTs or passwords.
-- The row must be claimed through the authenticated Cloudflare Worker route after
-- validating the Supabase access token with Supabase Auth.
CREATE TABLE IF NOT EXISTS supabase_owner_binding (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  owner_id TEXT NOT NULL CHECK(length(owner_id) = 36),
  email TEXT NOT NULL DEFAULT '',
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wormstar_supabase_owner_id ON supabase_owner_binding(owner_id);
