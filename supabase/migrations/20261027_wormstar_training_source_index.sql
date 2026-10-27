-- P1: additive index for owner-scoped training event lookups; preserves existing rows and RLS.
CREATE INDEX IF NOT EXISTS idx_wormstar_training_events_source_item ON public.wormstar_training_events (source_item_id);
