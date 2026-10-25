-- Wormstar owner-scoped append-only cloud synchronization audit.
-- No modifications to unrelated application tables.
CREATE TABLE IF NOT EXISTS public.wormstar_sync_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 action text NOT NULL CHECK (action IN ('backup','restore_memory','restore_policy')),
 outcome text NOT NULL CHECK (outcome IN ('success','partial','failure')),
 item_count integer NOT NULL DEFAULT 0 CHECK (item_count BETWEEN 0 AND 100000),
 details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object' AND char_length(details::text)<=2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wormstar_sync_events_owner_recent
 ON public.wormstar_sync_events (owner_id,created_at DESC);
ALTER TABLE public.wormstar_sync_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY wormstar_sync_events_owner_read ON public.wormstar_sync_events FOR SELECT TO authenticated
 USING ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_sync_events_owner_insert ON public.wormstar_sync_events FOR INSERT TO authenticated
 WITH CHECK ((SELECT auth.uid())=owner_id);
REVOKE ALL ON public.wormstar_sync_events FROM anon;
GRANT SELECT, INSERT ON public.wormstar_sync_events TO authenticated;
