-- Backup of owner-editable Cloudflare D1 policy. The Worker remains authoritative.
CREATE TABLE IF NOT EXISTS public.wormstar_owner_policies (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_json jsonb NOT NULL CHECK (jsonb_typeof(policy_json) = 'object' AND char_length(policy_json::text) <= 14000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wormstar_owner_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY wormstar_owner_policy_read ON public.wormstar_owner_policies FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY wormstar_owner_policy_create ON public.wormstar_owner_policies FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY wormstar_owner_policy_edit ON public.wormstar_owner_policies FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = owner_id) WITH CHECK ((SELECT auth.uid()) = owner_id);
GRANT SELECT, INSERT, UPDATE ON public.wormstar_owner_policies TO authenticated;
