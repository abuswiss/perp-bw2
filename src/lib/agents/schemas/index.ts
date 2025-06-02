// Zod schemas for agent input/output validation
import { z } from 'zod';

// ===== BASE SCHEMAS =====

// Base schema for all agent inputs
export const BaseAgentInputSchema = z.object({
  matterId: z.string().uuid().nullable(),
  query: z.string().min(1, "Query cannot be empty"),
  parameters: z.record(z.any()).optional(),
  documents: z.array(z.string()).optional(),
  context: z.object({
    task_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    matter_info: z.any().optional(),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string()
    })).optional(),
    attachments: z.array(z.any()).optional(),
    fileIds: z.array(z.string()).optional(),
    matterDocuments: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string().optional(),
      content: z.string().optional()
    })).optional()
  }).optional()
});

// Base schema for all agent outputs
export const BaseAgentOutputSchema = z.object({
  success: z.boolean(),
  result: z.any().nullable(),
  error: z.string().optional(),
  citations: z.array(z.object({
    id: z.string(),
    type: z.enum(['case', 'statute', 'regulation', 'web', 'document']),
    title: z.string().optional(), // Make title optional to handle undefined titles
    citation: z.string().optional(),
    url: z.string().optional(),
    court: z.string().optional(),
    date: z.string().optional(),
    relevance: z.number().optional()
  })).optional(),
  metadata: z.record(z.any()).optional(),
  executionTime: z.number().optional()
});

// ===== RESEARCH AGENT SCHEMAS =====

export const ResearchAgentInputSchema = BaseAgentInputSchema.extend({
  parameters: z.object({
    jurisdiction: z.string().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional(),
    court: z.string().optional(),
    includeStatutes: z.boolean().optional(),
    includeRegulations: z.boolean().optional(),
    maxResults: z.number().min(1).max(100).optional()
  }).optional()
});

export const ResearchAgentOutputSchema = BaseAgentOutputSchema.extend({
  result: z.object({
    response: z.string(),
    sources: z.array(z.any()),
    query: z.string(),
    summary: z.string().optional()
  }).nullable()
});

// ===== DOCUMENT DRAFTING AGENT SCHEMAS =====

export const DocumentDraftingAgentInputSchema = BaseAgentInputSchema.extend({
  parameters: z.object({
    documentType: z.enum([
      'legal_memorandum',
      'motion',
      'legal_brief',
      'contract_analysis',
      'discovery_response',
      'opinion_letter'
    ]).optional(),
    template: z.string().optional(),
    style: z.enum(['formal', 'concise', 'detailed']).optional(),
    maxPages: z.number().min(1).max(100).optional(),
    includeTableOfContents: z.boolean().optional(),
    includeTableOfAuthorities: z.boolean().optional(),
    researchData: z.any().optional()
  }).optional()
});

export const DocumentDraftingAgentOutputSchema = BaseAgentOutputSchema.extend({
  result: z.object({
    documentType: z.string(),
    outline: z.object({
      documentType: z.string(),
      title: z.string(),
      sections: z.array(z.object({
        title: z.string(),
        description: z.string(),
        keyPoints: z.array(z.string()).optional(),
        wordTarget: z.number()
      })),
      totalWordTarget: z.number(),
      approach: z.string().optional(),
      style: z.string()
    }),
    content: z.string(),
    sourceMaterial: z.any(),
    documentId: z.string().uuid().nullable().optional(),
    metadata: z.object({
      wordCount: z.number(),
      pageCount: z.number(),
      citationCount: z.number(),
      template: z.string(),
      usedCachedResearch: z.boolean().optional(),
      cachedResearchCount: z.number().optional(),
      savedToDatabase: z.boolean().optional()
    })
  }).nullable()
});

// ===== DISCOVERY AGENT SCHEMAS =====

export const DiscoveryAgentInputSchema = BaseAgentInputSchema.extend({
  parameters: z.object({
    discoveryType: z.enum([
      'interrogatories',
      'document_requests',
      'admissions',
      'depositions'
    ]).optional(),
    responseDeadline: z.string().optional(),
    objectionBasis: z.array(z.string()).optional(),
    privilegeLog: z.boolean().optional()
  }).optional()
});

export const DiscoveryAgentOutputSchema = BaseAgentOutputSchema.extend({
  result: z.object({
    discoveryType: z.string(),
    responses: z.array(z.object({
      requestNumber: z.number(),
      request: z.string(),
      response: z.string(),
      objections: z.array(z.string()).optional(),
      privilegeClaimed: z.boolean().optional()
    })),
    generalObjections: z.array(z.string()).optional(),
    privilegeLog: z.array(z.any()).optional(),
    documentId: z.string().uuid().nullable().optional()
  }).nullable()
});

// ===== DEEP RESEARCH AGENT SCHEMAS =====

export const DeepResearchAgentInputSchema = BaseAgentInputSchema.extend({
  parameters: z.object({
    urls: z.array(z.string().url()).optional(),
    searchFirst: z.boolean().optional(),
    maxSources: z.number().min(1).max(50).optional(),
    includeContradictions: z.boolean().optional(),
    includeRecommendations: z.boolean().optional(),
    focusAreas: z.array(z.string()).optional()
  }).optional()
});

export const DeepResearchAgentOutputSchema = BaseAgentOutputSchema.extend({
  result: z.object({
    response: z.string(),
    analysis: z.object({
      synthesis: z.string(),
      keyFindings: z.array(z.object({
        finding: z.string(),
        confidence: z.number().min(0).max(1),
        sources: z.array(z.string())
      })),
      themes: z.array(z.object({
        theme: z.string(),
        description: z.string(),
        relevance: z.number().min(0).max(1)
      })),
      contradictions: z.array(z.object({
        point: z.string(),
        sources: z.array(z.object({
          url: z.string(),
          position: z.string()
        }))
      })).optional(),
      gaps: z.array(z.string()).optional(),
      recommendations: z.array(z.string()).optional()
    }),
    sources: z.array(z.object({
      url: z.string(),
      title: z.string(),
      extracted: z.boolean(),
      contentSummary: z.string().optional(),
      relevanceScore: z.number().optional()
    }))
  }).nullable()
});

// ===== DEEP LEGAL RESEARCH AGENT SCHEMAS =====

export const DeepLegalResearchAgentInputSchema = BaseAgentInputSchema.extend({
  parameters: z.object({
    jurisdiction: z.string().optional(),
    dateRange: z.object({
      start: z.string().optional(), // Expects YYYY-MM-DD
      end: z.string().optional()    // Expects YYYY-MM-DD
    }).optional(),
    legalConcepts: z.array(z.string()).optional(),
    caseLawPreferences: z.object({
      includeUnpublished: z.boolean().default(false),
      orderBy: z.enum(['relevance', 'date']).default('relevance'),
      maxCases: z.number().min(1).max(50).default(10)
    }).optional(),
    statutePreferences: z.object({
      maxStatutes: z.number().min(1).max(30).default(5)
    }).optional(),
    academicPreferences: z.object({
      maxArticles: z.number().min(1).max(30).default(5),
      searchDepth: z.enum(['titles_abstracts', 'full_text']).default('titles_abstracts')
    }).optional(),
    maxTotalSources: z.number().min(5).max(100).default(20)
    // Add any other specific parameters needed for deep legal research
  }).optional()
});

export const DeepLegalResearchAgentOutputSchema = BaseAgentOutputSchema.extend({
  result: z.object({
    response: z.string(), // The main synthesized textual response
    summary: z.string().optional(),
    keyLegalFindings: z.array(z.object({
      finding: z.string(),
      supportingSources: z.array(z.number()), // Array of numbers referencing the main sources list
      legalCertainty: z.enum(['high', 'medium', 'low', 'unclear']).optional(),
      jurisdictionalApplicability: z.array(z.string()).optional() // e.g. ['Federal', 'Texas State']
    })).optional(),
    sourceAnalysis: z.object({
      caseLaw: z.array(z.object({
        sourceNumber: z.number(),
        keyHoldings: z.array(z.string()).optional(),
        relevanceToQuery: z.string().optional()
      })).optional(),
      statutes: z.array(z.object({
        sourceNumber: z.number(),
        relevantSections: z.array(z.string()).optional(),
        summaryOfProvisions: z.string().optional()
      })).optional(),
      academicSources: z.array(z.object({
        sourceNumber: z.number(),
        keyArguments: z.array(z.string()).optional(),
        methodology: z.string().optional()
      })).optional(),
      webSources: z.array(z.object({
        sourceNumber: z.number(),
        mainPoints: z.array(z.string()).optional(),
        assessedCredibility: z.string().optional()
      })).optional()
    }).optional(),
    researchPathways: z.array(z.string()).optional(), // Suggestions for further research
    sources: z.array(z.any()) // Keeping sources generic as BaseAgentOutputSchema, but they will be richer
  }).nullable()
});

// ===== DOCUMENT ANALYSIS AGENT SCHEMAS =====

export const DocumentAnalysisAgentInputSchema = BaseAgentInputSchema.extend({
  parameters: z.object({
    documentType: z.string().optional(),
    analysisType: z.enum([
      'interactive_analysis',
      'document_qa',
      'section_review',
      'type_detection'
    ]).optional(),
    sections: z.array(z.string()).optional(),
    focusAreas: z.array(z.string()).optional(),
    fileIds: z.array(z.string()).optional()
  }).optional()
});

export const DocumentAnalysisAgentOutputSchema = BaseAgentOutputSchema.extend({
  result: z.object({
    analysis: z.string(),
    highlights: z.array(z.object({
      id: z.string(),
      startPos: z.number(),
      endPos: z.number(),
      text: z.string(),
      type: z.enum(['reference', 'selection', 'search', 'active']),
      color: z.string(),
      metadata: z.object({
        messageId: z.string().optional(),
        referenceIndex: z.number().optional(),
        searchTerm: z.string().optional()
      }).optional()
    })).optional(),
    documentType: z.string(),
    documentContent: z.string().optional(),
    documentInfo: z.object({
      filename: z.string(),
      documentId: z.string(),
      wordCount: z.number(),
      preview: z.string(),
      type: z.string().optional()
    }),
    interactiveMode: z.boolean().optional()
  }).nullable()
});

// ===== ORCHESTRATOR SCHEMAS =====

export const LegalOrchestratorInputSchema = z.object({
  query: z.string().min(1),
  matterId: z.string().uuid().nullable(),
  userId: z.string().uuid().optional(),
  agents: z.array(z.enum([
    'research',
    'brief-writing',
    'discovery',
    'document-analysis',
    'deep-legal-research'
  ])),
  context: z.record(z.any()).optional()
});

export const LegalOrchestratorOutputSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  results: z.array(z.object({
    agentId: z.string(),
    agentType: z.string(),
    success: z.boolean(),
    output: z.any(),
    executionTime: z.number().optional()
  })),
  combinedOutput: z.any().optional(),
  error: z.string().optional()
});

// ===== HELPER FUNCTIONS =====

/**
 * Validate agent input against schema
 */
export function validateAgentInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(input);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  };
}

/**
 * Get schema for a specific agent type
 */
export function getAgentSchemas(agentType: string): {
  input: z.ZodSchema<any>;
  output: z.ZodSchema<any>;
} {
  switch (agentType) {
    case 'research':
      return {
        input: ResearchAgentInputSchema,
        output: ResearchAgentOutputSchema
      };
    case 'brief-writing':
    case 'document-drafting':
      return {
        input: DocumentDraftingAgentInputSchema,
        output: DocumentDraftingAgentOutputSchema
      };
    case 'discovery':
      return {
        input: DiscoveryAgentInputSchema,
        output: DiscoveryAgentOutputSchema
      };
    case 'document-analysis':
      return {
        input: DocumentAnalysisAgentInputSchema,
        output: DocumentAnalysisAgentOutputSchema
      };
    case 'deep-legal-research':
      return {
        input: DeepLegalResearchAgentInputSchema,
        output: DeepLegalResearchAgentOutputSchema
      };
    default:
      return {
        input: BaseAgentInputSchema,
        output: BaseAgentOutputSchema
      };
  }
}