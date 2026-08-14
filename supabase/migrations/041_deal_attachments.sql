-- Files related to quotes/proposals stored against an opportunity.
CREATE TABLE IF NOT EXISTS deal_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_attachments_deal
  ON deal_attachments(deal_id, created_at DESC);

ALTER TABLE deal_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_attachments_select ON deal_attachments;
CREATE POLICY deal_attachments_select ON deal_attachments FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS deal_attachments_insert ON deal_attachments;
CREATE POLICY deal_attachments_insert ON deal_attachments FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS deal_attachments_delete ON deal_attachments;
CREATE POLICY deal_attachments_delete ON deal_attachments FOR DELETE
  USING (is_account_member(account_id, 'agent'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deal-attachments',
  'deal-attachments',
  FALSE,
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/webp', 'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Members can read deal attachments" ON storage.objects;
CREATE POLICY "Members can read deal attachments" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'deal-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can upload deal attachments" ON storage.objects;
CREATE POLICY "Members can upload deal attachments" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'deal-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete deal attachments" ON storage.objects;
CREATE POLICY "Members can delete deal attachments" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'deal-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );
