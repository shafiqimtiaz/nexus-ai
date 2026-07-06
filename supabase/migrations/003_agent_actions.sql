-- Create the agent actions log table for autonomous operations tracking
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('calendar', 'resource', 'sync', 'chat')),
  source_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row-Level Security
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

-- Recreate RLS Policies
DROP POLICY IF EXISTS "Users and guests can read agent_actions" ON agent_actions;
DROP POLICY IF EXISTS "Users can insert their own agent_actions" ON agent_actions;
DROP POLICY IF EXISTS "Users can delete their own agent_actions" ON agent_actions;

CREATE POLICY "Users and guests can read agent_actions" ON agent_actions 
  FOR SELECT USING (user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "Users can insert their own agent_actions" ON agent_actions 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own agent_actions" ON agent_actions 
  FOR DELETE USING (user_id = auth.uid());
