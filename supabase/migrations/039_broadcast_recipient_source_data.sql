ALTER TABLE public.broadcast_recipients
ADD COLUMN IF NOT EXISTS source_data jsonb NOT NULL DEFAULT '{}'::jsonb;