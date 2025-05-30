-- BenchWise Row Level Security Policies
-- For development/demo purposes, we'll create permissive policies
-- In production, these should be more restrictive based on user authentication

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_messages ENABLE ROW LEVEL SECURITY;

-- For development: Allow all operations (you'll want to restrict these in production)
-- Organizations
CREATE POLICY "Allow all operations on organizations" ON organizations FOR ALL USING (true) WITH CHECK (true);

-- Users  
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true) WITH CHECK (true);

-- Matters
CREATE POLICY "Allow all operations on matters" ON matters FOR ALL USING (true) WITH CHECK (true);

-- Documents
CREATE POLICY "Allow all operations on documents" ON documents FOR ALL USING (true) WITH CHECK (true);

-- Document chunks
CREATE POLICY "Allow all operations on document_chunks" ON document_chunks FOR ALL USING (true) WITH CHECK (true);

-- Case citations
CREATE POLICY "Allow all operations on case_citations" ON case_citations FOR ALL USING (true) WITH CHECK (true);

-- Agent tasks
CREATE POLICY "Allow all operations on agent_tasks" ON agent_tasks FOR ALL USING (true) WITH CHECK (true);

-- Agent executions
CREATE POLICY "Allow all operations on agent_executions" ON agent_executions FOR ALL USING (true) WITH CHECK (true);

-- Legal chats
CREATE POLICY "Allow all operations on legal_chats" ON legal_chats FOR ALL USING (true) WITH CHECK (true);

-- Legal messages
CREATE POLICY "Allow all operations on legal_messages" ON legal_messages FOR ALL USING (true) WITH CHECK (true);

-- Note: In production, you should replace these permissive policies with more specific ones like:
-- CREATE POLICY "Users can access their organization's matters" ON matters 
--   FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = id));