-- Private repository manifest for Wormstar. Contents are NOT copied into
-- Supabase; Cloudflare D1 + Vectorize hold the isolated source knowledge.
CREATE SCHEMA IF NOT EXISTS wormstar_repo;
CREATE TABLE IF NOT EXISTS wormstar_repo.file_catalog(
 path text PRIMARY KEY,
 blob_sha text NOT NULL,
 bytes bigint NOT NULL DEFAULT 0,
 revision text NOT NULL,
 classification text NOT NULL CHECK(classification IN ('source','metadata')),
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wormstar_file_catalog_revision
  ON wormstar_repo.file_catalog(revision);
ALTER TABLE wormstar_repo.file_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA wormstar_repo FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA wormstar_repo FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA wormstar_repo TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON wormstar_repo.file_catalog TO service_role;
