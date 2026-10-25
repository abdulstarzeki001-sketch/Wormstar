-- Wormstar independent memory, training feedback and revision history.
-- Migration applied to existing Supabase project on 2026-10-25.
-- Original business-app tables are unchanged.
CREATE TABLE IF NOT EXISTS public.wormstar_ai_profiles (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Wormstar' CHECK (char_length(name) <= 90),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 11000),
  constraints text NOT NULL DEFAULT '' CHECK (char_length(constraints) <= 6000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wormstar_memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('file','note','correction','research','code')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 130),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 60000),
  source_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision int NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wormstar_memory_owner_recent ON public.wormstar_memory_items(owner_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS wormstar_memory_search ON public.wormstar_memory_items USING gin (to_tsvector('simple',title || ' ' || content));
CREATE TABLE IF NOT EXISTS public.wormstar_memory_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.wormstar_memory_items(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revision int NOT NULL,
  title text NOT NULL,
  kind text NOT NULL,
  content text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id,revision)
);
CREATE INDEX IF NOT EXISTS wormstar_memory_versions_owner ON public.wormstar_memory_versions(owner_id,item_id,revision DESC);
CREATE TABLE IF NOT EXISTS public.wormstar_training_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('correction','lesson','feedback')),
  subject text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 130),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 60000),
  created_at timestamptz NOT NULL DEFAULT now(),
  source_item_id uuid REFERENCES public.wormstar_memory_items(id) ON DELETE CASCADE,
  UNIQUE(owner_id,source_item_id)
);
CREATE INDEX IF NOT EXISTS wormstar_training_events_owner ON public.wormstar_training_events(owner_id,created_at DESC);
CREATE SCHEMA IF NOT EXISTS wormstar_internal;
CREATE OR REPLACE FUNCTION wormstar_internal.archive_previous_memory_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
BEGIN
  IF NEW.owner_id <> OLD.owner_id OR NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Owner and ID cannot be changed';
  END IF;
  INSERT INTO public.wormstar_memory_versions(item_id,owner_id,revision,title,kind,content)
  VALUES(OLD.id,OLD.owner_id,OLD.revision,OLD.title,OLD.kind,OLD.content);
  NEW.revision := OLD.revision + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION wormstar_internal.archive_previous_memory_revision() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS wormstar_store_previous_revision ON public.wormstar_memory_items;
CREATE TRIGGER wormstar_store_previous_revision BEFORE UPDATE ON public.wormstar_memory_items
FOR EACH ROW EXECUTE FUNCTION wormstar_internal.archive_previous_memory_revision();
ALTER TABLE public.wormstar_ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wormstar_memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wormstar_memory_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wormstar_training_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY wormstar_profile_select ON public.wormstar_ai_profiles FOR SELECT TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_profile_insert ON public.wormstar_ai_profiles FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_profile_update ON public.wormstar_ai_profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid())=owner_id) WITH CHECK ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_profile_delete ON public.wormstar_ai_profiles FOR DELETE TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_memory_select ON public.wormstar_memory_items FOR SELECT TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_memory_insert ON public.wormstar_memory_items FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_memory_update ON public.wormstar_memory_items FOR UPDATE TO authenticated USING ((SELECT auth.uid())=owner_id) WITH CHECK ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_memory_delete ON public.wormstar_memory_items FOR DELETE TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_versions_select ON public.wormstar_memory_versions FOR SELECT TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_events_select ON public.wormstar_training_events FOR SELECT TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_events_insert ON public.wormstar_training_events FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=owner_id);
CREATE POLICY wormstar_events_delete ON public.wormstar_training_events FOR DELETE TO authenticated USING ((SELECT auth.uid())=owner_id);
REVOKE ALL ON public.wormstar_ai_profiles,public.wormstar_memory_items,public.wormstar_memory_versions,public.wormstar_training_events FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.wormstar_ai_profiles,public.wormstar_memory_items,public.wormstar_training_events TO authenticated;
GRANT SELECT ON public.wormstar_memory_versions TO authenticated;
GRANT USAGE ON SEQUENCE public.wormstar_memory_versions_id_seq TO authenticated;
