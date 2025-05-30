-- Add progress column to agent_tasks table
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- Add current_step column to agent_tasks table  
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS current_step TEXT;