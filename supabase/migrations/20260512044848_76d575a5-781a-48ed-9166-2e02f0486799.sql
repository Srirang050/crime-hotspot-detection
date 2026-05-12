ALTER TABLE public.datasets
  ADD COLUMN IF NOT EXISTS original_row_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_filename text,
  ADD COLUMN IF NOT EXISTS source_bytes bigint;

CREATE INDEX IF NOT EXISTS crimes_dataset_idx ON public.crimes(dataset_id);
CREATE INDEX IF NOT EXISTS crimes_user_idx ON public.crimes(user_id);