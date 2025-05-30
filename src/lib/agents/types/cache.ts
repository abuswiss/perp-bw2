// Type definitions for matter cache system

export interface MatterCacheEntry {
  id: string;
  matter_id: string | null;
  agent_type: string;
  result_type: string;
  title: string;
  summary?: string;
  query_hash: string;
  result_data: any;
  metadata: Record<string, any>;
  created_at: Date;
  expires_at: Date;
  usage_count: number;
  last_used_at: Date;
}

export interface CacheableResult {
  type: string; // result_type
  title: string;
  summary?: string;
  data: any; // The actual result data
  metadata?: Record<string, any>;
  expirationHours?: number; // Override default 24 hours
}

export interface CacheSearchOptions {
  matterId?: string | null;
  agentTypes?: string[];
  resultTypes?: string[];
  maxAgeHours?: number;
  limit?: number;
  excludeExpired?: boolean;
}

export interface CacheStats {
  totalEntries: number;
  entriesByType: Record<string, number>;
  entriesByAgent: Record<string, number>;
  averageUsage: number;
  oldestEntry: Date;
  newestEntry: Date;
}