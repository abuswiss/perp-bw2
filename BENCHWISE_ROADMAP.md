# BenchWise: Legal AI Transformation Roadmap

## Executive Summary

Transform Perplexica into BenchWise, a comprehensive legal AI platform that combines powerful research capabilities with agent orchestration to automate legal workflows. The vision is to give every lawyer a "Perplexity-style cockpit" where they can spin up specialized AI agents on demand—agents that read private matter files, scour live caselaw, sweep the open web, and deliver work-product with verifiable citations.

## Phase 1: Foundation & Legal Search (Weeks 1-3)

### 1.1 Database Architecture
**Objective**: Establish persistent storage for legal documents, matters, and agent workflows.

**Supabase Schema**:
```sql
-- Organizations & Users
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Matters & Documents
CREATE TABLE matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  matter_number TEXT,
  client_name TEXT,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES matters(id),
  filename TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  extracted_text TEXT,
  metadata JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  chunk_index INTEGER,
  content TEXT,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Legal Research
CREATE TABLE case_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_name TEXT NOT NULL,
  citation TEXT NOT NULL,
  court TEXT,
  decision_date DATE,
  courtlistener_id TEXT,
  full_text TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent Workflows
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES matters(id),
  task_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  input_config JSONB,
  output_data JSONB,
  created_by UUID REFERENCES users(id),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id),
  agent_type TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### 1.2 CourtListener Integration
**File**: `src/lib/integrations/courtlistener.ts`

Key Features:
- Search opinions by keyword, date, court
- Fetch full case text and metadata
- Parse citations and build citation graphs
- Cache frequently accessed cases
- Rate limiting and error handling

### 1.3 Transform Focus Modes to Legal Contexts
Replace existing focus modes with:

1. **Case Law Research** - Search federal/state cases via CourtListener
2. **Statutory Research** - Search codes, regulations, statutes
3. **Document Review** - Analyze uploaded documents with legal lens
4. **Brief Writing** - Generate legal documents with proper citations
5. **Discovery Analysis** - Process and summarize discovery documents
6. **Contract Analysis** - Review contracts, identify issues

## Phase 2: Enhanced Document RAG System (Weeks 3-5)

### 2.1 Persistent Document Management
**Enhance** `src/app/api/uploads/route.ts`:
- Store documents in Supabase storage
- Generate and store embeddings in pgvector
- Link documents to matters
- Version control for document updates
- OCR for scanned documents

### 2.2 Advanced RAG Pipeline
**New**: `src/lib/rag/legalRAG.ts`
- Hybrid search: keyword + semantic
- Legal-specific chunking (preserve citations, sections)
- Cross-document retrieval within matters
- Citation extraction and validation
- Relevance scoring with legal context

### 2.3 Matter-Aware Context
- Load all documents for a matter
- Build knowledge graph of related cases
- Track document relationships
- Maintain conversation context per matter

## Phase 3: Agent Orchestration System (Weeks 5-8)

### 3.1 Core Agent Framework
**New**: `src/lib/agents/`

Base Agent Types:
```typescript
interface LegalAgent {
  id: string;
  type: 'research' | 'writing' | 'analysis' | 'review';
  capabilities: string[];
  requiredContext: string[];
  execute(input: AgentInput): Promise<AgentOutput>;
}
```

### 3.2 Specialized Legal Agents

1. **ResearchAgent**
   - Query CourtListener for cases
   - Search statutes and regulations
   - Find similar cases using embeddings
   - Build citation trees

2. **BriefWritingAgent**
   - Generate legal memoranda
   - Format with proper citations
   - Follow jurisdiction-specific rules
   - Multiple drafting styles

3. **DiscoveryAgent**
   - Process document productions
   - Generate privilege logs
   - Create document summaries
   - Identify responsive documents

4. **ContractAgent**
   - Extract key terms
   - Compare to standard clauses
   - Identify missing provisions
   - Risk assessment

5. **DepositionPrepAgent**
   - Analyze witness documents
   - Generate question outlines
   - Create exhibit lists
   - Timeline construction

### 3.3 Agent Orchestration
**New**: `src/lib/orchestrator/legalOrchestrator.ts`

Features:
- Parse user intent to determine required agents
- Manage agent dependencies and sequencing
- Coordinate data flow between agents
- Handle long-running tasks with progress updates
- Error recovery and fallback strategies

## Phase 4: UI/UX Transformation (Weeks 7-9)

### 4.1 Navigation Restructure
- Replace "Discover" with "Matters" dashboard
- Transform "Library" to "Document Library"
- Add "Active Tasks" panel for agent workflows
- Legal-specific quick actions

### 4.2 Matter-Centric Interface
**New**: `src/components/MatterWorkspace.tsx`
- Matter selection dropdown
- Document panel with upload/management
- Research history for matter
- Active agent tasks
- Generated work products

### 4.3 Legal Research Interface
- Case law search with court filters
- Citation formatter and validator
- Shepardization status indicators
- Save research to matter

### 4.4 Agent Task Interface
- Natural language task input
- Agent selection/recommendation
- Progress tracking with substeps
- Result review and editing
- Export to Word/PDF with formatting

## Phase 5: Advanced Features (Weeks 9-12)

### 5.1 Collaborative Features
- Team matters with permissions
- Annotation and commenting
- Version control for documents
- Audit trail for compliance

### 5.2 Legal-Specific Embeddings
- Fine-tune embeddings on legal corpus
- Build legal concept graph
- Improve citation matching
- Jurisdiction-aware search

### 5.3 Workflow Automation
- Template library for common tasks
- Scheduled research updates
- Alert system for new relevant cases
- Deadline tracking integration

## Implementation Priority & Quick Wins

### Week 1-2: Core Infrastructure
1. Set up Supabase with schema
2. Add authentication/organization support
3. Migrate existing uploads to persistent storage
4. Implement matter management

### Week 3-4: Legal Search
1. Integrate CourtListener API
2. Transform search UI for legal context
3. Add citation formatting
4. Implement case law focus mode

### Week 5-6: Document RAG
1. Enhance document processing pipeline
2. Implement matter-aware retrieval
3. Add legal document templates
4. Build citation extraction

### Week 7-8: Basic Agents
1. Create agent framework
2. Implement ResearchAgent
3. Add BriefWritingAgent
4. Simple orchestration for single agents

### Week 9-10: Advanced Orchestration
1. Multi-agent coordination
2. Complex workflow support
3. Progress tracking UI
4. Error handling

### Week 11-12: Polish & Legal Features
1. Legal formatting tools
2. Export capabilities
3. Collaboration features
4. Performance optimization

## Technical Implementation Details

### API Route Changes
- `/api/matters` - CRUD for matters
- `/api/legal-search` - CourtListener integration
- `/api/agents` - Agent task management
- `/api/documents` - Enhanced document management

### Component Architecture
```
src/
  components/
    legal/
      MatterSelector.tsx
      CaseSearch.tsx
      CitationFormatter.tsx
      AgentTaskPanel.tsx
    agents/
      AgentSelector.tsx
      TaskProgress.tsx
      ResultReview.tsx
```

### State Management
- Add Zustand for matter context
- Agent task queue management
- Document cache optimization
- Research history tracking


## Success Metrics
- Query to result time < 5 seconds
- Document processing < 30 seconds
- Agent task completion < 2 minutes
- Citation accuracy > 95%
- User workflow time reduction > 70%