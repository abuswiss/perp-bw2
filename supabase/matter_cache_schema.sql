-- Matter Cache Table for Cross-Agent Result Sharing
-- This table stores recent agent results that can be shared between agents working on the same matter

CREATE TABLE IF NOT EXISTS matter_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NULL, -- NULL allows caching for general queries without specific matter
  agent_type TEXT NOT NULL, -- 'research', 'brief-writing', 'discovery', 'contract'
  result_type TEXT NOT NULL, -- 'case_research', 'legal_analysis', 'contract_analysis', 'brief_draft', 'discovery_summary'
  title TEXT NOT NULL, -- Human readable title for the cached result
  summary TEXT, -- Brief summary of the result content
  query_hash TEXT, -- Hash of the original query for exact match detection
  result_data JSONB NOT NULL, -- Full result data
  metadata JSONB DEFAULT '{}', -- Additional metadata (confidence, source count, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  usage_count INTEGER DEFAULT 0, -- Track how often this cache entry is used
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_matter_cache_matter_id ON matter_cache(matter_id);
CREATE INDEX IF NOT EXISTS idx_matter_cache_agent_type ON matter_cache(agent_type);
CREATE INDEX IF NOT EXISTS idx_matter_cache_result_type ON matter_cache(result_type);
CREATE INDEX IF NOT EXISTS idx_matter_cache_expires_at ON matter_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_matter_cache_query_hash ON matter_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_matter_cache_created_at ON matter_cache(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_matter_cache_lookup ON matter_cache(matter_id, result_type, expires_at);

-- Auto-cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_matter_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM matter_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-matter-cache', '0 2 * * *', 'SELECT cleanup_expired_matter_cache();');

-- Row Level Security (RLS) - Enable if needed
-- ALTER TABLE matter_cache ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE matter_cache IS 'Stores agent results for cross-agent sharing within matters';
COMMENT ON COLUMN matter_cache.matter_id IS 'Reference to matter - NULL for general queries';
COMMENT ON COLUMN matter_cache.agent_type IS 'Agent that created this result (research, brief-writing, etc.)';
COMMENT ON COLUMN matter_cache.result_type IS 'Type of result stored (case_research, legal_analysis, etc.)';
COMMENT ON COLUMN matter_cache.query_hash IS 'Hash of original query for exact match detection';
COMMENT ON COLUMN matter_cache.result_data IS 'Full agent result in JSON format';
COMMENT ON COLUMN matter_cache.expires_at IS 'When this cache entry expires (default 24 hours)';
COMMENT ON COLUMN matter_cache.usage_count IS 'Number of times this cache entry has been used';