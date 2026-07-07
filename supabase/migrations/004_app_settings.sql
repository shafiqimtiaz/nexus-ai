-- Key/value app settings, e.g. the owner's custom AI agent rules that get
-- appended to the base system prompt.
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  key TEXT NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, key)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and guests can read app_settings" ON app_settings;
DROP POLICY IF EXISTS "Users can upsert their own app_settings" ON app_settings;
DROP POLICY IF EXISTS "Users can update their own app_settings" ON app_settings;

CREATE POLICY "Users and guests can read app_settings" ON app_settings
  FOR SELECT USING (user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "Users can upsert their own app_settings" ON app_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own app_settings" ON app_settings
  FOR UPDATE USING (user_id = auth.uid());
