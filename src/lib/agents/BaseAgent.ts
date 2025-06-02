import { LegalAgent, AgentInput, AgentOutput, AgentCapability } from './types';
import { MatterCacheEntry, CacheableResult, CacheSearchOptions } from './types/cache';
import { supabaseAdmin } from '@/lib/supabase/client';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { BaseAgentInputSchema, BaseAgentOutputSchema, validateAgentInput } from './schemas';

export abstract class BaseAgent implements LegalAgent {
  abstract id: string;
  abstract type: 'research' | 'writing' | 'analysis' | 'review' | 'discovery' | 'deepResearch';
  abstract name: string;
  abstract description: string;
  abstract capabilities: AgentCapability[];
  abstract requiredContext: string[];

  protected supabase = supabaseAdmin;

  abstract execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * Get input schema for validation - can be overridden by specific agents
   */
  protected getInputSchema(): z.ZodSchema<any> {
    return BaseAgentInputSchema;
  }

  /**
   * Get output schema for validation - can be overridden by specific agents
   */
  protected getOutputSchema(): z.ZodSchema<any> {
    return BaseAgentOutputSchema;
  }

  /**
   * Validate input with Zod schema
   */
  protected validateInputWithSchema(input: unknown): AgentInput {
    const schema = this.getInputSchema();
    const result = validateAgentInput(schema, input);
    
    if (!result.success) {
      throw new Error(`Invalid input for ${this.name}: ${result.error}`);
    }
    
    return result.data as AgentInput;
  }

  /**
   * Validate output with Zod schema
   */
  protected validateOutputWithSchema(output: unknown): AgentOutput {
    const schema = this.getOutputSchema();
    const result = schema.safeParse(output);
    
    if (!result.success) {
      console.error(`Invalid output from ${this.name}:`, result.error);
      // Don't throw - return error output instead
      return {
        success: false,
        result: null,
        error: `Invalid output format: ${result.error.message}`
      };
    }
    
    return result.data as AgentOutput;
  }

  validateInput(input: AgentInput): boolean {
    if (input.matterId === undefined || !input.query) {
      return false;
    }

    // Check if required context is available (skip for general research)
    if (input.matterId !== null) {
      for (const requirement of this.requiredContext) {
        if (!input.context?.[requirement]) {
          return false;
        }
      }
    }

    return true;
  }

  estimateDuration(input: AgentInput): number {
    // Base estimation - can be overridden by specific agents
    const queryComplexity = input.query.length > 200 ? 1.5 : 1.0;
    const documentCount = input.documents?.length || 0;
    const documentFactor = Math.min(documentCount * 0.1, 2.0);
    
    return Math.round(60 * queryComplexity * (1 + documentFactor)); // seconds
  }

  getRequiredPermissions(): string[] {
    return ['read:documents', 'write:research'];
  }

  protected async logExecution(
    taskId: string,
    step: string,
    progress: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Update both execution progress AND main task progress
      await Promise.all([
        // Update execution progress
        this.supabase
          .from('agent_executions')
          .update({
            progress,
            current_step: step,
            output_data: metadata ? { metadata } : undefined
          })
          .eq('task_id', taskId),
        
        // Update main task progress
        this.supabase
          .from('agent_tasks')
          .update({
            progress,
            current_step: step
          })
          .eq('id', taskId)
      ]);
    } catch (error) {
      console.error('Failed to log agent execution:', error);
    }
  }

  protected async createExecution(
    taskId: string,
    input: AgentInput
  ): Promise<string> {
    // Validate input before creating execution
    try {
      this.validateInputWithSchema(input);
    } catch (error) {
      console.error('Input validation failed:', error);
      throw error;
    }
    try {
      const { data, error } = await this.supabase
        .from('agent_executions')
        .insert({
          task_id: taskId,
          agent_type: this.type,
          status: 'running',
          input_data: input,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create agent execution:', error);
        // Return a temporary ID if database insert fails
        return `temp-${Date.now()}`;
      }

      return data.id;
    } catch (error) {
      console.error('Error creating execution:', error);
      return `temp-${Date.now()}`;
    }
  }

  protected async completeExecution(
    executionId: string,
    output: AgentOutput
  ): Promise<void> {
    // Validate output before saving
    const validatedOutput = this.validateOutputWithSchema(output);
    await this.supabase
      .from('agent_executions')
      .update({
        status: validatedOutput.success ? 'completed' : 'failed',
        output_data: validatedOutput,
        completed_at: new Date().toISOString(),
        progress: 100,
        current_step: validatedOutput.success ? 'Completed' : 'Failed',
        error_message: validatedOutput.error || null
      })
      .eq('id', executionId);
  }

  protected async getMatterDocuments(matterId: string | null): Promise<any[]> {
    // Handle the case where no matter is selected
    if (!matterId) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('matter_id', matterId);

    if (error) {
      throw new Error(`Failed to fetch matter documents: ${error.message}`);
    }

    return data || [];
  }

  protected async getMatterInfo(matterId: string | null): Promise<any> {
    // Handle the case where no matter is selected
    if (!matterId) {
      return {
        id: null,
        name: 'General Research',
        description: 'General legal research without a specific matter context',
        client_name: null,
        matter_number: null,
        practice_area: null,
        status: 'active',
        tags: [],
        metadata: {}
      };
    }

    const { data, error } = await this.supabase
      .from('matters')
      .select('*')
      .eq('id', matterId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch matter info: ${error.message}`);
    }

    return data;
  }

  protected formatCitation(
    title: string,
    court?: string,
    date?: string,
    citation?: string
  ): string {
    let formatted = title;
    
    if (citation) {
      formatted += `, ${citation}`;
    }
    
    if (court) {
      formatted += ` (${court}`;
      if (date) {
        formatted += ` ${date}`;
      }
      formatted += ')';
    } else if (date) {
      formatted += ` (${date})`;
    }
    
    return formatted;
  }

  protected extractLegalConcepts(text: string): string[] {
    const legalTerms = [
      'summary judgment', 'due process', 'breach of contract', 'negligence',
      'proximate cause', 'strict liability', 'statute of limitations',
      'res judicata', 'collateral estoppel', 'standing', 'jurisdiction',
      'personal jurisdiction', 'subject matter jurisdiction', 'venue',
      'discovery', 'deposition', 'interrogatories', 'motion to dismiss',
      'motion for summary judgment', 'class action', 'damages',
      'injunctive relief', 'specific performance', 'punitive damages'
    ];

    const concepts: string[] = [];
    const lowerText = text.toLowerCase();

    for (const term of legalTerms) {
      if (lowerText.includes(term.toLowerCase())) {
        concepts.push(term);
      }
    }

    return [...new Set(concepts)];
  }

  // ===== MATTER CACHE METHODS =====

  /**
   * Generate a hash for a query to enable exact match detection
   */
  protected generateQueryHash(query: string, additionalParams?: Record<string, any>): string {
    const normalizedQuery = query.toLowerCase().trim();
    const hashInput = additionalParams 
      ? normalizedQuery + JSON.stringify(additionalParams)
      : normalizedQuery;
    
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }

  /**
   * Search for cached results that might be relevant to the current task
   */
  protected async getCachedResults(
    matterId: string | null, 
    options: CacheSearchOptions = {}
  ): Promise<MatterCacheEntry[]> {
    try {
      const {
        agentTypes = [],
        resultTypes = [],
        maxAgeHours = 24,
        limit = 10,
        excludeExpired = true
      } = options;

      let query = this.supabase
        .from('matter_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by matter ID (including NULL for general queries)
      if (matterId) {
        query = query.or(`matter_id.eq.${matterId},matter_id.is.null`);
      } else {
        query = query.is('matter_id', null);
      }

      // Filter by agent types if specified
      if (agentTypes.length > 0) {
        query = query.in('agent_type', agentTypes);
      }

      // Filter by result types if specified
      if (resultTypes.length > 0) {
        query = query.in('result_type', resultTypes);
      }

      // Filter by age
      if (maxAgeHours > 0) {
        const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
        query = query.gte('created_at', cutoffTime.toISOString());
      }

      // Exclude expired entries if requested
      if (excludeExpired) {
        query = query.gt('expires_at', new Date().toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching cached results:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCachedResults:', error);
      return [];
    }
  }

  /**
   * Check for an exact match of a previous query
   */
  protected async getExactCacheMatch(
    query: string, 
    matterId: string | null,
    additionalParams?: Record<string, any>
  ): Promise<MatterCacheEntry | null> {
    try {
      const queryHash = this.generateQueryHash(query, additionalParams);
      
      let dbQuery = this.supabase
        .from('matter_cache')
        .select('*')
        .eq('query_hash', queryHash)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      // Filter by matter ID
      if (matterId) {
        dbQuery = dbQuery.eq('matter_id', matterId);
      } else {
        dbQuery = dbQuery.is('matter_id', null);
      }

      const { data, error } = await dbQuery;

      if (error) {
        console.error('Error checking for exact cache match:', error);
        return null;
      }

      if (data && data.length > 0) {
        // Update usage statistics
        await this.updateCacheUsage(data[0].id);
        return data[0];
      }

      return null;
    } catch (error) {
      console.error('Error in getExactCacheMatch:', error);
      return null;
    }
  }

  /**
   * Store a result in the cache for other agents to use
   */
  protected async cacheResult(
    matterId: string | null,
    query: string,
    result: CacheableResult,
    additionalParams?: Record<string, any>
  ): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(query, additionalParams);
      const expirationHours = result.expirationHours || 24;
      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

      const cacheEntry = {
        matter_id: matterId,
        agent_type: this.id,
        result_type: result.type,
        title: result.title,
        summary: result.summary || null,
        query_hash: queryHash,
        result_data: result.data,
        metadata: {
          originalQuery: query,
          additionalParams: additionalParams || {},
          confidence: result.metadata?.confidence || 1.0,
          sourceCount: result.metadata?.sourceCount || 0,
          ...result.metadata
        },
        expires_at: expiresAt.toISOString(),
        usage_count: 0,
        last_used_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('matter_cache')
        .insert(cacheEntry);

      if (error) {
        console.error('Error caching result:', error);
        // Don't throw error - caching is optional and shouldn't break the main flow
      } else {
        console.log(`✅ Cached ${result.type} result for matter ${matterId || 'general'}`);
      }
    } catch (error) {
      console.error('Error in cacheResult:', error);
      // Don't throw error - caching is optional
    }
  }

  /**
   * Update usage statistics for a cache entry
   */
  private async updateCacheUsage(cacheId: string): Promise<void> {
    try {
      // First get current usage count
      const { data: current, error: fetchError } = await this.supabase
        .from('matter_cache')
        .select('usage_count')
        .eq('id', cacheId)
        .single();
      
      if (fetchError || !current) {
        console.error('Error fetching cache entry:', fetchError);
        return;
      }
      
      // Then update with incremented count
      await this.supabase
        .from('matter_cache')
        .update({
          usage_count: (current.usage_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', cacheId);
    } catch (error) {
      console.error('Error updating cache usage:', error);
      // Non-critical error, don't break the flow
    }
  }

  /**
   * Clean up expired cache entries for a specific matter
   */
  protected async cleanupExpiredCache(matterId?: string | null): Promise<void> {
    try {
      let query = this.supabase
        .from('matter_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (matterId !== undefined) {
        if (matterId === null) {
          query = query.is('matter_id', null);
        } else {
          query = query.eq('matter_id', matterId);
        }
      }

      const { error } = await query;

      if (error) {
        console.error('Error cleaning up expired cache:', error);
      }
    } catch (error) {
      console.error('Error in cleanupExpiredCache:', error);
    }
  }

  /**
   * Helper method to check if cached results are relevant to current query
   */
  protected assessCacheRelevance(
    cachedResults: MatterCacheEntry[], 
    currentQuery: string
  ): Array<MatterCacheEntry & { relevanceScore: number }> {
    const currentQueryLower = currentQuery.toLowerCase();
    
    return cachedResults.map(cache => {
      let score = 0;
      
      // Exact query match gets highest score
      if (cache.metadata?.originalQuery?.toLowerCase() === currentQueryLower) {
        score = 1.0;
      } else {
        // Simple keyword overlap scoring
        const cacheQueryWords = (cache.metadata?.originalQuery || '').toLowerCase().split(/\s+/);
        const currentQueryWords = currentQueryLower.split(/\s+/);
        const commonWords = cacheQueryWords.filter((word: string) => 
          currentQueryWords.includes(word) && word.length > 3
        );
        
        score = commonWords.length / Math.max(cacheQueryWords.length, currentQueryWords.length);
      }
      
      // Boost score based on cache metadata
      if (cache.metadata?.confidence) {
        score *= cache.metadata.confidence;
      }
      
      // Age penalty (newer results are more relevant)
      const ageHours = (Date.now() - new Date(cache.created_at).getTime()) / (1000 * 60 * 60);
      const agePenalty = Math.max(0.5, 1 - (ageHours / 168)); // Penalize results older than a week
      score *= agePenalty;
      
      return { ...cache, relevanceScore: score };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // ===== DOCUMENT STORAGE METHODS =====

  /**
   * Save generated document to the documents table
   */
  protected async saveGeneratedDocument(
    matterId: string | null,
    content: string,
    documentType: string,
    metadata: {
      title?: string;
      summary?: string;
      wordCount?: number;
      pageCount?: number;
      citations?: number;
      outline?: any;
      taskId?: string;
      [key: string]: any;
    }
  ): Promise<string> {
    try {
      const documentId = uuidv4();
      const timestamp = new Date().toISOString();
      const filename = metadata.title 
        ? `${metadata.title.replace(/[^a-zA-Z0-9-_ ]/g, '_')}.md`
        : `${documentType}_${timestamp.split('T')[0]}_${documentId.substring(0, 8)}.md`;

      const { data, error } = await this.supabase
        .from('documents')
        .insert({
          id: documentId,
          matter_id: matterId,
          filename: filename,
          file_type: 'text/markdown',
          file_size: Buffer.byteLength(content, 'utf8'),
          extracted_text: content,
          summary: metadata.summary || content.substring(0, 500) + '...',
          document_type: documentType,
          processing_status: 'completed',
          metadata: {
            generated_by: 'agent',
            agent_type: this.id,
            agent_name: this.name,
            task_id: metadata.taskId,
            generation_timestamp: timestamp,
            word_count: metadata.wordCount,
            page_count: metadata.pageCount,
            citation_count: metadata.citations,
            outline: metadata.outline,
            ...metadata
          }
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error saving generated document:', error);
        throw new Error(`Failed to save document: ${error.message}`);
      }

      console.log(`✅ Saved generated ${documentType} document: ${filename} (${documentId})`);
      return documentId;
    } catch (error) {
      console.error('Error in saveGeneratedDocument:', error);
      throw error;
    }
  }

  /**
   * Update an existing generated document
   */
  protected async updateGeneratedDocument(
    documentId: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = {
        extracted_text: content,
        file_size: Buffer.byteLength(content, 'utf8'),
        updated_at: new Date().toISOString()
      };

      if (metadata) {
        // Merge with existing metadata
        const { data: existing } = await this.supabase
          .from('documents')
          .select('metadata')
          .eq('id', documentId)
          .single();

        updateData.metadata = {
          ...existing?.metadata,
          ...metadata,
          last_updated_by: this.id,
          last_updated_at: new Date().toISOString()
        };
      }

      const { error } = await this.supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId);

      if (error) {
        throw new Error(`Failed to update document: ${error.message}`);
      }

      console.log(`✅ Updated document ${documentId}`);
    } catch (error) {
      console.error('Error in updateGeneratedDocument:', error);
      throw error;
    }
  }

  /**
   * Check if a similar document already exists
   */
  protected async findSimilarDocument(
    matterId: string | null,
    documentType: string,
    titlePattern?: string
  ): Promise<string | null> {
    try {
      let query = this.supabase
        .from('documents')
        .select('id, filename, metadata')
        .eq('document_type', documentType)
        .eq('metadata->>generated_by', 'agent')
        .eq('metadata->>agent_type', this.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (matterId) {
        query = query.eq('matter_id', matterId);
      }

      if (titlePattern) {
        query = query.ilike('filename', `%${titlePattern}%`);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        return null;
      }

      return data[0].id;
    } catch (error) {
      console.error('Error in findSimilarDocument:', error);
      return null;
    }
  }
}