import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with elevated privileges
// In client-side context, this will use anon key as fallback
export const supabaseAdmin = typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase // Use regular client on client-side

// Helper function to create Supabase client (for backwards compatibility)
export const createSupabaseClient = () => supabaseAdmin;

// Types for our database tables
export interface Organization {
  id: string
  name: string
  subscription_tier: string
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name?: string
  organization_id?: string
  role: 'admin' | 'member' | 'viewer'
  preferences: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Matter {
  id: string
  organization_id?: string
  name: string
  description?: string
  matter_number?: string
  client_name?: string
  practice_area?: string
  status: 'active' | 'archived' | 'closed'
  tags?: string[]
  metadata: Record<string, any>
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  matter_id?: string
  filename: string
  file_type?: string
  file_size?: number
  storage_path?: string
  extracted_text?: string
  summary?: string
  document_type?: 'contract' | 'brief' | 'discovery' | 'correspondence' | 'pleading'
  metadata: Record<string, any>
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_by?: string
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  embedding?: number[]
  start_page?: number
  end_page?: number
  metadata: Record<string, any>
  created_at: string
}

export interface CaseCitation {
  id: string
  case_name: string
  citation: string
  court?: string
  jurisdiction?: string
  decision_date?: string
  courtlistener_id?: string
  docket_number?: string
  full_text?: string
  summary?: string
  key_points?: string[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface LegalChat {
  id: string
  matter_id?: string
  user_id?: string
  title?: string
  focus_mode?: string
  context_documents?: string[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface LegalMessage {
  id: string
  chat_id: string
  message_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: any
  tokens_used?: number
  created_at: string
}