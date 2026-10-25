-- Remove default anonymous privileges; RLS still restricts each authenticated owner.
REVOKE ALL ON public.wormstar_owner_policies FROM anon;
