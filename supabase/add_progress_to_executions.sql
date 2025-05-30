-- Add progress and current_step columns to agent_executions table
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS current_step TEXT;