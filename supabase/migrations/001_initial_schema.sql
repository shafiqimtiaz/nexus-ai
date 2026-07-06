-- Nexus — Initial Database Schema

-- Platform connections (google_classroom uses OAuth tokens; discord stores bot token in access_token)
CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE CHECK (type IN ('google_classroom', 'discord')),
  name TEXT NOT NULL,
  external_id TEXT,                -- Classroom course id / Discord channel id
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('exam', 'quiz', 'assignment', 'study_block', 'other')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  source_platform UUID REFERENCES platforms(id),
  source_external_id TEXT,         -- for dedup of auto-detected events
  is_auto_detected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source_platform, source_external_id)
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  is_pinned BOOLEAN DEFAULT false,
  source_platform UUID REFERENCES platforms(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT
);

CREATE TABLE resource_labels (
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, label_id)
);

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id),
  external_id TEXT NOT NULL,       -- platform message/announcement id for dedup
  title TEXT,
  content TEXT NOT NULL,
  author TEXT,
  source_url TEXT,
  is_read BOOLEAN DEFAULT false,
  announced_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (platform_id, external_id)
);

-- RLS: deny everything to anon/authenticated; app uses service role server-side only.
-- Enabling RLS with NO policies = deny-all except the service_role key (which bypasses RLS).
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
