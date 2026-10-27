# Wormstar NEO P1 — memory, retrieval, models, Supabase

Implementation date: 2026-10-27. This file describes **code changes**; a GitHub merge is NOT a production Cloudflare deployment.

## 8. Long-term memory
- Preserve all existing D1 rows and all existing Supabase rows; no destructive or re-key migration.
- Maintain prior versions of edited D1 knowledge in `knowledge_revisions`, including a safe rollback path. The underlying D1 table is not replaced.
- Keep existing profile snapshots in `wormstar_config_history` when a persona changes; show owner-accessible revision history and restore controls.
- Permanent deletion of an item also deletes its D1 revisions. The independent Supabase copy is deleted through the original authorized client action; failed remote deletion is reported.
- **Required deploy prerequisite:** apply `cloudflare-worker/migrations/20261027_knowledge_revisions.sql` to the existing D1 database before deploying this code.

## 9. Knowledge library
- Expand the per-Worker knowledge limit from 120 to 500 text references.
- Allow selecting UTF-8 files up to 500 KB; segment up to 12 chunks of 45,000 characters. Keep each chunk as a separate D1 reference with a traceable filename and index.
- Exact title/content duplicate requests return the existing item id, without creating a new row.
- PDF, ZIP, binaries and arbitrary file execution are still unsupported and must not be advertised as supported.
- Supabase backup/listing and D1 JSON export are updated to the matching 500-item bound. Large exports remain manual, owner-initiated.

## 10. Retrieval-augmented answering
- Add `rag-engine.js` with Arabic normalization, multi-term scoring, matching excerpt selection and strict output size budget.
- Filter candidates across the whole D1 knowledge table instead of blindly reading only its 120 newest items. Candidate query is capped at 160, returned references at 4, and model context excerpt budget at 8,500 characters.
- Selected owner files take priority and retain source id. Retrieved source text is untrusted and never executes as instructions.
- This is better **lexical RAG**, not embeddings/vector semantic search. Adding optional multilingual embedding/vector search requires separate design, cost and privacy approval.

## 11. Persona
- Preserve persona fields, existing owner policy enforcement and Supabase owner-scoped profile backup.
- Add profile revision display and explicitly confirmed restore. A restore also archives the previous active version.

## 12. Model routing
- Preserve explicit requested engine, ordered fallback attempts and truthful `modelUsed` values.
- Report `modelsTried` for Workers AI and distinguish the health endpoint's **preferred** backend from the actually used chat backend; avoid exposing upstream exception text on total failure.
- Do not advertise a local 120B model: self-hosted GPU is a separate requirement.

## 13. Supabase
- Preserve the owner's RLS tables, metadata and Auth binding. No service role key, secret credential or unconditional cross-database copying.
- Manual backup compares timestamps; when the remote item has a newer modification, leave that remote item unchanged and display the count of conflicts for review.
- Existing explicit owner-authenticated backup and restore flows remain in place. This is not automatic bidirectional replication.

## Validation
- `npm test` (including `tests/p1-memory-rag.test.mjs`), GitHub Actions and after-deploy smoke tests.
- Check D1 knowledge, profile, revision and archive row counts before/after; check Supabase count and RLS without extracting private content.
- Check authorized dashboard, `/api/health`, favicon and protected API requests. Confirm Cloudflare bindings AI, DB, WORMSTAR_ACCESS_TOKEN and owner Access policy remain intact.
