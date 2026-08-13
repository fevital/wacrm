ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false;