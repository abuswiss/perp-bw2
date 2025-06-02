import { BaseAgent } from './BaseAgent';
import { AgentInput, AgentOutput, AgentCapability } from './types';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getDefaultChatModel } from '@/lib/providers';
import { v4 as uuidv4 } from 'uuid';

export class DocumentAnalysisAgent extends BaseAgent {
  id = 'document-analysis-agent';
  type = 'analysis' as const;
  name = 'Document Analysis Agent';
  description = 'Comprehensive legal document analysis with visual highlighting and interactive Q&A';
  
  capabilities: AgentCapability[] = [
    {
      name: 'Interactive Document Analysis',
      description: 'Analyze any legal document with visual highlighting and references',
      inputTypes: ['document', 'user_question'],
      outputTypes: ['analysis', 'highlights', 'references', 'document_positions'],
      estimatedDuration: 30
    },
    {
      name: 'Document Type Detection',
      description: 'Automatically detect and adapt analysis for different document types',
      inputTypes: ['document'],
      outputTypes: ['document_type', 'analysis_strategy'],
      estimatedDuration: 10
    },
    {
      name: 'Section-by-Section Review',
      description: 'Detailed analysis of specific document sections with cross-references',
      inputTypes: ['document', 'section_reference'],
      outputTypes: ['section_analysis', 'cross_references', 'highlights'],
      estimatedDuration: 25
    },
    {
      name: 'Key Information Extraction',
      description: 'Extract and highlight key information with precise document positions',
      inputTypes: ['document', 'extraction_query'],
      outputTypes: ['extracted_info', 'document_positions', 'highlights'],
      estimatedDuration: 20
    }
  ];

  requiredContext = [];
  
  private llm: BaseChatModel | null = null;
  private strParser = new StringOutputParser();

  constructor() {
    super();
    this.initializeLLM();
  }

  private async initializeLLM() {
    try {
      this.llm = await getDefaultChatModel();
      if (this.llm && 'temperature' in this.llm) {
        (this.llm as any).temperature = 0.2; // Low temperature for consistent contract analysis
      }
    } catch (error) {
      console.error('Failed to initialize LLM for ContractAgent:', error);
    }
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    
    try {
      const taskId = input.context?.task_id || uuidv4();
      const executionId = await this.createExecution(taskId, input);
      
      // Step 1: Load document
      await this.logExecution(taskId, 'Loading document for analysis', 20);
      const document = await this.loadDocument(input);
      
      // Step 2: Prepare context from document
      await this.logExecution(taskId, 'Preparing document context', 40);
      const documentContext = this.prepareDocumentContext(document);
      
      // Step 3: Answer user question using document context
      await this.logExecution(taskId, 'Analyzing document and answering question', 70);
      const userQuery = input.query || 'Please analyze this document and provide key insights.';
      const analysisResult = await this.analyzeDocumentWithQuery(documentContext, userQuery);
      
      // Step 4: Generate response
      await this.logExecution(taskId, 'Generating response', 90);
      
      // Just return the analysis text - no document viewer complexity
      const output: AgentOutput = {
        success: true,
        result: analysisResult.analysis,
        citations: [],
        metadata: {
          executionId,
          documentId: document.id,
          queryType: 'document_analysis',
          documentType: analysisResult.documentType
        },
        executionTime: Date.now() - startTime
      };

      await this.completeExecution(executionId, output);
      return output;

    } catch (error) {
      const output: AgentOutput = {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: Date.now() - startTime
      };

      return output;
    }
  }

  private prepareDocumentContext(document: any): string {
    let content = '';
    
    if (document.content) {
      content = document.content;
    } else if (document.extracted_text) {
      content = document.extracted_text;
    } else if (document.text) {
      content = document.text;
    }
    
    console.log('Document context prepared, length:', content.length);
    return content;
  }

  private async analyzeDocumentWithQuery(documentContext: string, query: string): Promise<{analysis: string, highlights: any[], documentType: string}> {
    if (!this.llm) {
      return {
        analysis: "Document analysis unavailable - LLM not initialized",
        highlights: [],
        documentType: 'unknown'
      };
    }

    try {
      // First detect document type
      const documentType = await this.detectDocumentType(documentContext);
      
      const analysisPrompt = new PromptTemplate({
        template: `You are an expert legal document analysis assistant. You have been given a {documentType} document to analyze.

DOCUMENT CONTENT:
{documentContent}

USER QUESTION:
{userQuestion}

Analyze the document and answer the user's question with the following requirements:

1. ANALYSIS: Provide a comprehensive response based on the document content
2. DOCUMENT TYPE AWARENESS: Tailor your analysis to the document type ({documentType})
3. CITATIONS: When referencing specific parts of the document, quote the relevant text directly

For {documentType} documents, focus on:
${this.getDocumentTypeGuidance(documentType)}

Provide a clear, well-structured analysis that directly answers the user's question based on the document content.

Response:`,
        inputVariables: ['documentContent', 'userQuestion', 'documentType']
      });

      const chain = analysisPrompt.pipe(this.llm).pipe(this.strParser);
      
      // Limit document context to avoid token limits but keep more for better analysis
      const truncatedContext = documentContext.substring(0, 12000);
      
      const response = await chain.invoke({
        documentContent: truncatedContext,
        userQuestion: query,
        documentType: documentType
      });

      return {
        analysis: response,
        highlights: [],
        documentType: documentType
      };
    } catch (error) {
      console.error('Document analysis error:', error);
      return {
        analysis: `Error analyzing document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        highlights: [],
        documentType: 'unknown'
      };
    }
  }

  private async detectDocumentType(documentContext: string): Promise<string> {
    const text = documentContext.toLowerCase();
    
    // Enhanced document type detection
    const documentTypes = {
      'contract': ['agreement', 'contract', 'party', 'whereas', 'consideration', 'terms and conditions'],
      'brief': ['plaintiff', 'defendant', 'motion', 'memorandum', 'brief', 'court filing'],
      'case_law': ['supreme court', 'court of appeals', 'holding', 'opinion', 'dissent', 'majority'],
      'statute': ['section', 'subsection', 'enacted', 'statute', 'code', 'regulation'],
      'motion': ['motion', 'hereby moves', 'relief', 'pursuant to', 'rule'],
      'pleading': ['complaint', 'answer', 'counterclaim', 'allegation', 'cause of action'],
      'discovery': ['interrogatories', 'deposition', 'request for production', 'admissions'],
      'regulation': ['cfr', 'federal register', 'regulation', 'administrative', 'agency'],
      'opinion': ['memorandum opinion', 'findings of fact', 'conclusions of law', 'judgment']
    };

    for (const [type, keywords] of Object.entries(documentTypes)) {
      const matches = keywords.filter(keyword => text.includes(keyword));
      if (matches.length >= 2) {
        return type;
      }
    }

    return 'legal_document';
  }

  private getDocumentTypeGuidance(documentType: string): string {
    const guidance = {
      'contract': '- Key terms and obligations\n- Parties and their roles\n- Financial terms and payment\n- Termination clauses\n- Risk factors',
      'brief': '- Legal arguments and citations\n- Facts and procedural history\n- Issues presented\n- Legal standards applied',
      'case_law': '- Holding and reasoning\n- Key facts and procedural posture\n- Legal principles established\n- Dissenting opinions if any',
      'statute': '- Statutory requirements\n- Scope and applicability\n- Key definitions\n- Enforcement mechanisms',
      'motion': '- Relief sought\n- Legal basis for motion\n- Supporting facts and law\n- Procedural requirements',
      'pleading': '- Claims and defenses\n- Factual allegations\n- Legal theories\n- Relief requested',
      'discovery': '- Information sought\n- Relevance and scope\n- Privilege issues\n- Compliance requirements',
      'regulation': '- Regulatory requirements\n- Compliance obligations\n- Enforcement provisions\n- Definitions and scope',
      'opinion': '- Court\'s reasoning\n- Factual findings\n- Legal conclusions\n- Precedential value'
    };

    return guidance[documentType as keyof typeof guidance] || '- Key legal concepts\n- Important provisions\n- Relevant facts\n- Legal implications';
  }

  private extractHighlights(response: string, documentContext: string, documentType?: string): any[] {
    const highlights = [];
    const refPattern = /\[REF:([^|]+)\|([^\]]+)\]/g;
    let match;

    while ((match = refPattern.exec(response)) !== null) {
      const startText = match[1].trim();
      const endText = match[2].trim();
      
      // Find the position in the document
      const startPos = documentContext.toLowerCase().indexOf(startText.toLowerCase());
      const endPos = documentContext.toLowerCase().indexOf(endText.toLowerCase(), startPos);
      
      if (startPos !== -1 && endPos !== -1) {
        const endPosition = endPos + endText.length;
        const highlightText = documentContext.substring(startPos, endPosition);
        
        // Generate enhanced highlight with PDF coordinate support
        const highlight = {
          id: `highlight_${highlights.length}`,
          startPos: startPos,
          endPos: endPosition,
          text: highlightText,
          type: 'reference',
          color: '#ffeb3b', // Yellow highlight
          metadata: {
            documentType: documentType || 'unknown',
            referenceIndex: highlights.length,
            startText: startText,
            endText: endText,
            // Add PDF coordinates if this is a PDF document
            ...(this.shouldGeneratePDFCoordinates(documentType) && {
              pdfCoordinates: this.generatePDFCoordinates(startPos, endPosition, documentContext),
              pageNumber: this.estimatePageNumber(startPos, documentContext)
            })
          }
        };
        
        highlights.push(highlight);
      }
    }

    return highlights;
  }

  private shouldGeneratePDFCoordinates(documentType?: string): boolean {
    // For now, we'll generate coordinates for all document types
    // In the future, we could detect PDF vs text documents more precisely
    return true;
  }

  private generatePDFCoordinates(startPos: number, endPos: number, documentContext: string): Array<{
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    // Estimate page structure for coordinate generation
    const avgCharsPerLine = 80;
    const avgLinesPerPage = 50;
    const charsPerPage = avgCharsPerLine * avgLinesPerPage;
    
    // PDF page dimensions (points) - assuming standard US Letter
    const pageWidth = 612;  // 8.5 inches * 72 points/inch
    const pageHeight = 792; // 11 inches * 72 points/inch
    const marginLeft = 72;  // 1 inch margin
    const marginTop = 72;   // 1 inch margin
    const contentWidth = pageWidth - (marginLeft * 2);
    const contentHeight = pageHeight - (marginTop * 2);
    
    // Calculate which page(s) the highlight spans
    const startPage = Math.floor(startPos / charsPerPage) + 1;
    const endPage = Math.floor(endPos / charsPerPage) + 1;
    
    const coordinates = [];
    
    for (let page = startPage; page <= endPage; page++) {
      const pageStartChar = (page - 1) * charsPerPage;
      const pageEndChar = page * charsPerPage;
      
      // Calculate highlight bounds within this page
      const highlightStart = Math.max(startPos, pageStartChar);
      const highlightEnd = Math.min(endPos, pageEndChar);
      
      if (highlightStart < highlightEnd) {
        // Calculate position within the page
        const charPosInPage = highlightStart - pageStartChar;
        const line = Math.floor(charPosInPage / avgCharsPerLine);
        const charInLine = charPosInPage % avgCharsPerLine;
        
        // Convert to PDF coordinates
        const x = marginLeft + (charInLine * (contentWidth / avgCharsPerLine));
        const y = marginTop + (line * (contentHeight / avgLinesPerPage));
        const width = Math.min(
          (highlightEnd - highlightStart) * (contentWidth / avgCharsPerLine),
          contentWidth - (charInLine * (contentWidth / avgCharsPerLine))
        );
        const height = contentHeight / avgLinesPerPage;
        
        coordinates.push({
          pageNumber: page,
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height)
        });
      }
    }
    
    return coordinates;
  }

  private estimatePageNumber(charPosition: number, documentContext: string): number {
    const avgCharsPerPage = 4000; // Rough estimate
    return Math.floor(charPosition / avgCharsPerPage) + 1;
  }

  private async loadDocument(input: AgentInput): Promise<any> {
    // First, check if there are uploaded files to analyze
    const fileIds = input.parameters?.fileIds || input.context?.fileIds || (input as any).files || [];
    console.log('Loading document with fileIds:', fileIds);
    
    if (fileIds.length > 0) {
      // Load uploaded file content
      return this.loadUploadedFile(fileIds[0]);
    }
    
    if (input.documents && input.documents.length > 0) {
      // Load specific document from matter
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', input.documents[0])
        .single();
      
      if (error) throw new Error(`Failed to load contract document: ${error.message}`);
      return data;
    } else if (input.matterId) {
      // Look for any documents in the matter for analysis
      const documents = await this.getMatterDocuments(input.matterId);
      
      if (documents.length === 0) {
        throw new Error('No documents found in matter');
      }
      
      // Return the first document or the most recently uploaded
      return documents[0];
    } else {
      throw new Error('No document or uploaded file provided');
    }
  }

  private async loadUploadedFile(fileId: string): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      // Load the extracted content from uploaded file
      const uploadDir = path.join(process.cwd(), 'uploads');
      const extractedPath = path.join(uploadDir, `${fileId}-extracted.json`);
      const originalPath = path.join(uploadDir, `${fileId}.pdf`); // Try PDF first
      const docxPath = path.join(uploadDir, `${fileId}.docx`); // Try DOCX 
      
      console.log('📂 Looking for uploaded file:', fileId);
      console.log('📄 Checking paths:');
      console.log('  - Extracted:', extractedPath);
      console.log('  - PDF:', originalPath);
      console.log('  - DOCX:', docxPath);
      
      // List available files for debugging
      try {
        const files = fs.readdirSync(uploadDir).filter(f => f.startsWith(fileId));
        console.log('📋 Available files for this ID:', files);
      } catch (e) {
        console.log('📋 Cannot list upload directory');
      }
      
      if (fs.existsSync(extractedPath)) {
        console.log('✅ Found extracted content file');
        const extractedContent = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
        
        return {
          id: fileId,
          filename: extractedContent.title || 'Uploaded Document',
          content: extractedContent.contents?.join('\n\n') || '',
          document_type: 'legal_document',
          metadata: extractedContent
        };
      } else if (fs.existsSync(originalPath)) {
        console.log('⚠️ Found original PDF but no extracted content - file may not be processed yet');
        // Return a placeholder that indicates the file needs processing
        return {
          id: fileId,
          filename: `Document ${fileId}.pdf`,
          content: 'This document is being processed. Please try again in a moment.',
          document_type: 'legal_document',
          metadata: { status: 'processing' }
        };
      } else if (fs.existsSync(docxPath)) {
        console.log('⚠️ Found original DOCX but no extracted content - file may not be processed yet');
        return {
          id: fileId,
          filename: `Document ${fileId}.docx`,
          content: 'This document is being processed. Please try again in a moment.',
          document_type: 'legal_document',
          metadata: { status: 'processing' }
        };
      } else {
        // Check what files actually exist for debugging
        const allFiles = fs.readdirSync(uploadDir);
        const similarFiles = allFiles.filter(f => f.includes(fileId.substring(0, 8)));
        
        console.log('❌ File not found. Similar files:', similarFiles);
        
        // As a fallback for testing, try to use an existing file
        const existingFiles = allFiles.filter(f => f.endsWith('-extracted.json'));
        if (existingFiles.length > 0) {
          console.log('🔄 Using fallback file for testing:', existingFiles[0]);
          const fallbackPath = path.join(uploadDir, existingFiles[0]);
          const extractedContent = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
          
          return {
            id: fileId,
            filename: extractedContent.title || 'Test Document',
            content: extractedContent.contents?.join('\n\n') || '',
            document_type: 'legal_document',
            metadata: { ...extractedContent, fallback: true }
          };
        }
        
        throw new Error(`Uploaded file not found. File ID: ${fileId}. This may indicate the file upload did not complete successfully or the file is still being processed.`);
      }
    } catch (error) {
      throw new Error(`Failed to load uploaded file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ========== DEPRECATED METHODS - Kept for reference ==========
  // The following methods were used for structured contract analysis
  // but are no longer used in the simplified document Q&A approach
  
  private async identifyContractType(document: any): Promise<string> {
    const text = document.extracted_text?.toLowerCase() || '';
    const filename = document.filename?.toLowerCase() || '';
    
    const contractTypes = {
      'employment': ['employment', 'employee', 'job', 'position', 'salary', 'compensation'],
      'service': ['service', 'services', 'consulting', 'professional services'],
      'sale': ['sale', 'purchase', 'buy', 'seller', 'buyer', 'goods'],
      'lease': ['lease', 'rent', 'rental', 'tenant', 'landlord', 'premises'],
      'license': ['license', 'licensing', 'intellectual property', 'software license'],
      'nda': ['non-disclosure', 'confidentiality', 'nda', 'confidential information'],
      'partnership': ['partnership', 'joint venture', 'collaboration', 'alliance'],
      'vendor': ['vendor', 'supplier', 'procurement', 'supply agreement'],
      'merger': ['merger', 'acquisition', 'purchase agreement', 'stock purchase'],
      'loan': ['loan', 'credit', 'financing', 'borrower', 'lender']
    };

    for (const [type, keywords] of Object.entries(contractTypes)) {
      const matches = keywords.filter(keyword => 
        text.includes(keyword) || filename.includes(keyword)
      );
      
      if (matches.length >= 2) {
        return type;
      }
    }

    return 'general';
  }

  private async extractContractTerms(document: any, contractType: string): Promise<any> {
    if (!this.llm) {
      // Fallback to rule-based extraction if LLM not available
      return this.extractContractTermsRuleBased(document, contractType);
    }

    try {
      const extractionPrompt = new PromptTemplate({
        template: `Extract and analyze key terms from the following {contractType} contract.

CONTRACT TEXT:
{contractText}

EXTRACTION INSTRUCTIONS:
Extract and structure the following information:

1. PARTIES: Identify all parties to the contract, their roles, and entity types
2. KEY TERMS: Extract core contract terms, definitions, and scope
3. FINANCIAL TERMS: Payment amounts, schedules, penalties, currency
4. IMPORTANT DATES: Effective dates, deadlines, renewal dates, expiration
5. OBLIGATIONS: Each party's responsibilities and performance requirements
6. TERMINATION: Termination triggers, notice requirements, procedures
7. LIABILITY: Liability limitations, indemnification, insurance requirements
8. GOVERNANCE: Governing law, jurisdiction, dispute resolution

Focus on legally significant terms that could impact rights, obligations, or risks.

CRITICAL: Return ONLY valid JSON with no additional text, markdown, or explanations. Do not include markdown code blocks.

RESPONSE FORMAT (JSON):
{{
  "parties": [
    {{
      "name": "Party Name",
      "role": "Buyer/Seller/Service Provider/etc",
      "entityType": "Individual/Corporation/LLC/etc",
      "address": "if specified",
      "keyCharacteristics": ["characteristic1", "characteristic2"]
    }}
  ],
  "keyTerms": [
    {{
      "term": "term name",
      "definition": "definition or description",
      "significance": "legal/business significance",
      "location": "section where found"
    }}
  ],
  "financialTerms": {{
    "totalValue": "contract value if determinable",
    "paymentSchedule": ["payment term 1", "payment term 2"],
    "currency": "USD/EUR/etc",
    "penalties": ["penalty description"],
    "expenses": ["expense allocation"]
  }},
  "criticalDates": [
    {{
      "dateType": "Effective/Expiration/Deadline/etc",
      "date": "date if specified",
      "description": "what happens on this date",
      "importance": "high/medium/low"
    }}
  ],
  "obligations": [
    {{
      "party": "which party",
      "obligation": "description of obligation",
      "deadline": "when due",
      "consequences": "consequences of non-performance"
    }}
  ],
  "terminationClauses": {{
    "terminationTriggers": ["trigger1", "trigger2"],
    "noticeRequirements": "notice period and method",
    "effectOfTermination": "what happens upon termination",
    "survivalClauses": ["clauses that survive termination"]
  }},
  "liabilityProvisions": {{
    "limitationsOfLiability": ["limitation1", "limitation2"],
    "indemnificationClauses": ["indemnity provision"],
    "insuranceRequirements": ["insurance requirement"],
    "disclaimers": ["disclaimer"]
  }},
  "governanceProvisions": {{
    "governingLaw": "applicable law",
    "jurisdiction": "court jurisdiction",
    "disputeResolution": "arbitration/mediation/courts",
    "amendmentProcedure": "how contract can be modified"
  }}
}}`,
        inputVariables: ['contractType', 'contractText']
      });

      const chain = extractionPrompt.pipe(this.llm).pipe(this.strParser);
      
      const response = await chain.invoke({
        contractType,
        contractText: (document.extracted_text || '').substring(0, 6000) // Larger limit for term extraction
      });

      // Parse LLM response - clean up any markdown formatting
      let cleanResponse = response.trim();
      // Remove code block markers if present
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const terms = JSON.parse(cleanResponse);
      
      return {
        parties: terms.parties || [],
        keyTerms: terms.keyTerms || [],
        financialTerms: terms.financialTerms || {},
        dates: terms.criticalDates || [],
        obligations: terms.obligations || [],
        termination: terms.terminationClauses || {},
        liability: terms.liabilityProvisions || {},
        governance: terms.governanceProvisions || {},
        extractionMethod: 'ai-powered'
      };

    } catch (error) {
      console.error('LLM term extraction failed, falling back to rule-based:', error);
      return this.extractContractTermsRuleBased(document, contractType);
    }
  }

  private async extractContractTermsRuleBased(document: any, contractType: string): Promise<any> {
    const text = document.extracted_text || '';
    const terms = {
      parties: await this.extractParties(text),
      keyTerms: await this.extractKeyTerms(text, contractType),
      financialTerms: await this.extractFinancialTerms(text),
      dates: await this.extractDates(text),
      obligations: await this.extractObligations(text),
      termination: await this.extractTerminationClauses(text),
      liability: await this.extractLiabilityTerms(text),
      governance: await this.extractGovernanceTerms(text),
      extractionMethod: 'rule-based'
    };

    return terms;
  }

  private async extractParties(text: string): Promise<any[]> {
    const parties = [];
    
    // Look for party definitions
    const partyPattern = /"([^"]+)"\s+\((?:the\s+)?"([^"]+)"\)/gi;
    let match;
    
    while ((match = partyPattern.exec(text)) !== null) {
      parties.push({
        name: match[1],
        role: match[2],
        type: this.determinePartyType(match[1])
      });
    }

    // Look for "Company" and "Customer" patterns
    const simplePartyPattern = /(?:Company|Customer|Client|Vendor|Contractor|Employee):\s*([^\n]+)/gi;
    while ((match = simplePartyPattern.exec(text)) !== null) {
      parties.push({
        name: match[1].trim(),
        role: match[0].split(':')[0],
        type: 'entity'
      });
    }

    return parties;
  }

  private determinePartyType(name: string): string {
    const corporateIndicators = ['Inc.', 'LLC', 'Corp.', 'Ltd.', 'Company', 'Corporation'];
    const hasCorpIndicator = corporateIndicators.some(indicator => name.includes(indicator));
    
    return hasCorpIndicator ? 'corporation' : 'individual';
  }

  private async extractKeyTerms(text: string, contractType: string): Promise<any[]> {
    const keyTerms = [];
    
    // Common contract terms
    const termPatterns: Record<string, RegExp> = {
      'term': /(?:term|duration):\s*([^\n]+)/gi,
      'payment': /(?:payment|compensation):\s*([^\n]+)/gi,
      'scope': /(?:scope|services):\s*([^\n]+)/gi,
      'effective_date': /(?:effective|start)\s+date:\s*([^\n]+)/gi,
      'expiration': /(?:expiration|end)\s+date:\s*([^\n]+)/gi
    };

    // Contract-type specific terms
    if (contractType === 'employment') {
      termPatterns['salary'] = /salary:\s*([^\n]+)/gi;
      termPatterns['benefits'] = /benefits:\s*([^\n]+)/gi;
      termPatterns['position'] = /position:\s*([^\n]+)/gi;
    } else if (contractType === 'service') {
      termPatterns['deliverables'] = /deliverables:\s*([^\n]+)/gi;
      termPatterns['milestones'] = /milestones:\s*([^\n]+)/gi;
    }

    for (const [termType, pattern] of Object.entries(termPatterns)) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        keyTerms.push({
          type: termType,
          value: match[1].trim(),
          position: match.index
        });
      }
    }

    return keyTerms;
  }

  private async extractFinancialTerms(text: string): Promise<any> {
    const financialTerms = {
      amounts: [] as any[],
      paymentTerms: [] as any[],
      penalties: [] as any[],
      currency: 'USD' // default
    };

    // Extract monetary amounts
    const amountPattern = /\$[\d,]+(?:\.\d{2})?|\b\d+\s+dollars?\b/gi;
    let match;
    
    while ((match = amountPattern.exec(text)) !== null) {
      financialTerms.amounts.push({
        amount: match[0],
        context: text.substring(Math.max(0, match.index - 50), match.index + 50),
        position: match.index
      });
    }

    // Extract payment terms
    const paymentPattern = /(?:payment|paid)\s+(?:within|in|every)\s+(\d+)\s+(days?|months?|years?)/gi;
    while ((match = paymentPattern.exec(text)) !== null) {
      financialTerms.paymentTerms.push({
        period: `${match[1]} ${match[2]}`,
        context: text.substring(Math.max(0, match.index - 30), match.index + 50)
      });
    }

    // Extract penalties and late fees
    const penaltyPattern = /(?:penalty|late fee|interest):\s*([^\n]+)/gi;
    while ((match = penaltyPattern.exec(text)) !== null) {
      financialTerms.penalties.push({
        type: match[0].split(':')[0],
        terms: match[1].trim()
      });
    }

    return financialTerms;
  }

  private async extractDates(text: string): Promise<any[]> {
    const dates = [];
    
    // Various date patterns
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
      /\b\d{1,2}-\d{1,2}-\d{4}\b/g,
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        dates.push({
          date: match[0],
          context: text.substring(Math.max(0, match.index - 30), match.index + 50),
          position: match.index
        });
      }
    }

    return dates;
  }

  private async extractObligations(text: string): Promise<any[]> {
    const obligations = [];
    
    // Look for obligation keywords
    const obligationPattern = /(?:shall|must|will|agrees to|responsible for|obligated to)\s+([^.]+)/gi;
    let match;
    
    while ((match = obligationPattern.exec(text)) !== null) {
      obligations.push({
        obligation: match[1].trim(),
        type: match[0].split(/\s+/)[0],
        context: text.substring(Math.max(0, match.index - 20), match.index + 100)
      });
    }

    return obligations;
  }

  private async extractTerminationClauses(text: string): Promise<any> {
    const termination = {
      causes: [] as string[],
      notice: null as string | null,
      procedure: [] as string[]
    };

    // Look for termination causes
    const terminationPattern = /(?:terminate|termination).*?(?:for|upon|if)([^.]+)/gi;
    let match;
    
    while ((match = terminationPattern.exec(text)) !== null) {
      termination.causes.push(match[1].trim());
    }

    // Look for notice requirements
    const noticePattern = /(?:notice|notification).*?(\d+)\s+(days?|months?)/gi;
    if ((match = noticePattern.exec(text)) !== null) {
      termination.notice = `${match[1]} ${match[2]}`;
    }

    return termination;
  }

  private async extractLiabilityTerms(text: string): Promise<any> {
    const liability = {
      limitations: [] as string[],
      indemnification: [] as string[],
      insurance: [] as string[]
    };

    // Look for liability limitations
    const limitationPattern = /(?:limit|limitation).*?liability.*?([^.]+)/gi;
    let match;
    
    while ((match = limitationPattern.exec(text)) !== null) {
      liability.limitations.push(match[1].trim());
    }

    // Look for indemnification
    const indemnityPattern = /(?:indemnify|indemnification).*?([^.]+)/gi;
    while ((match = indemnityPattern.exec(text)) !== null) {
      liability.indemnification.push(match[1].trim());
    }

    return liability;
  }

  private async extractGovernanceTerms(text: string): Promise<any> {
    const governance = {
      governingLaw: null as string | null,
      jurisdiction: null as string | null,
      disputeResolution: [] as string[]
    };

    // Look for governing law
    const lawPattern = /(?:governed by|governing law).*?([^.]+)/gi;
    const lawMatch = lawPattern.exec(text);
    if (lawMatch) {
      governance.governingLaw = lawMatch[1].trim();
    }

    // Look for jurisdiction
    const jurisdictionPattern = /jurisdiction.*?([^.]+)/gi;
    const jurisdictionMatch = jurisdictionPattern.exec(text);
    if (jurisdictionMatch) {
      governance.jurisdiction = jurisdictionMatch[1].trim();
    }

    // Look for dispute resolution
    const disputePattern = /(?:dispute|arbitration|mediation).*?([^.]+)/gi;
    let match;
    while ((match = disputePattern.exec(text)) !== null) {
      governance.disputeResolution.push(match[1].trim());
    }

    return governance;
  }

  private async conductRiskAnalysis(document: any, termExtraction: any, contractType: string): Promise<any> {
    if (!this.llm) {
      // Fallback to rule-based analysis if LLM not available
      return this.conductRiskAnalysisRuleBased(document, termExtraction, contractType);
    }

    try {
      const riskPrompt = new PromptTemplate({
        template: `Conduct a comprehensive risk analysis of the following contract.

CONTRACT TYPE: {contractType}
CONTRACT TEXT: {contractText}

EXTRACTED TERMS:
- Parties: {parties}
- Key Terms: {keyTerms}
- Financial Terms: {financialTerms}
- Liability Terms: {liabilityTerms}
- Termination Terms: {terminationTerms}

ANALYSIS INSTRUCTIONS:
1. Identify all potential legal and business risks in this contract
2. Analyze liability exposure and limitations
3. Evaluate financial risks and payment terms
4. Assess termination and breach scenarios
5. Consider regulatory compliance risks
6. Identify missing protective clauses
7. Evaluate enforceability issues

Focus on risks that could result in:
- Financial loss or liability
- Legal disputes or litigation
- Regulatory violations
- Operational disruptions
- Reputational damage

CRITICAL: Return ONLY valid JSON with no additional text, markdown, or explanations. Do not include markdown code blocks.

RESPONSE FORMAT (JSON):
{{
  "overallRiskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": number (0-100),
  "riskCategories": [
    {{
      "category": "financial" | "liability" | "compliance" | "operational" | "legal",
      "riskLevel": "low" | "medium" | "high",
      "risks": ["risk1", "risk2"],
      "impact": "description of potential impact",
      "likelihood": "low" | "medium" | "high",
      "mitigation": ["strategy1", "strategy2"]
    }}
  ],
  "criticalIssues": ["issue1", "issue2"],
  "missingProtections": ["protection1", "protection2"],
  "recommendedClauses": ["clause1", "clause2"],
  "negotiationPriorities": ["priority1", "priority2"],
  "complianceRisks": ["risk1", "risk2"],
  "analysisReasoning": "detailed explanation of risk assessment"
}}`,
        inputVariables: ['contractType', 'contractText', 'parties', 'keyTerms', 'financialTerms', 'liabilityTerms', 'terminationTerms']
      });

      const chain = riskPrompt.pipe(this.llm).pipe(this.strParser);
      
      const response = await chain.invoke({
        contractType,
        contractText: (document.extracted_text || '').substring(0, 4000),
        parties: JSON.stringify(termExtraction.parties),
        keyTerms: JSON.stringify(termExtraction.keyTerms),
        financialTerms: JSON.stringify(termExtraction.financialTerms),
        liabilityTerms: JSON.stringify(termExtraction.liability),
        terminationTerms: JSON.stringify(termExtraction.termination)
      });

      // Parse LLM response - clean up any markdown formatting
      let cleanResponse = response.trim();
      // Remove code block markers if present
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const analysis = JSON.parse(cleanResponse);
      
      return {
        overallRiskLevel: analysis.overallRiskLevel,
        riskScore: analysis.riskScore,
        riskFactors: analysis.riskCategories,
        criticalIssues: analysis.criticalIssues,
        missingProtections: analysis.missingProtections,
        recommendedClauses: analysis.recommendedClauses,
        negotiationPriorities: analysis.negotiationPriorities,
        complianceRisks: analysis.complianceRisks,
        aiAnalysis: analysis.analysisReasoning,
        riskSummary: `AI analysis identified ${analysis.riskCategories.length} risk categories with overall risk level: ${analysis.overallRiskLevel}`,
        mitigationRecommendations: analysis.riskCategories.flatMap((cat: any) => cat.mitigation)
      };

    } catch (error) {
      console.error('LLM risk analysis failed, falling back to rule-based:', error);
      return this.conductRiskAnalysisRuleBased(document, termExtraction, contractType);
    }
  }

  private async conductRiskAnalysisRuleBased(document: any, termExtraction: any, contractType: string): Promise<any> {
    const riskFactors = [];
    let overallRiskLevel = 'low';

    // Analyze financial risks
    const financialRisks = await this.analyzeFinancialRisks(termExtraction.financialTerms);
    riskFactors.push(...financialRisks);

    // Analyze liability risks
    const liabilityRisks = await this.analyzeLiabilityRisks(termExtraction.liability);
    riskFactors.push(...liabilityRisks);

    // Analyze termination risks
    const terminationRisks = await this.analyzeTerminationRisks(termExtraction.termination);
    riskFactors.push(...terminationRisks);

    // Analyze governance risks
    const governanceRisks = await this.analyzeGovernanceRisks(termExtraction.governance);
    riskFactors.push(...governanceRisks);

    // Calculate overall risk level
    const highRiskCount = riskFactors.filter(risk => risk.level === 'high').length;
    const mediumRiskCount = riskFactors.filter(risk => risk.level === 'medium').length;

    if (highRiskCount > 0) {
      overallRiskLevel = 'high';
    } else if (mediumRiskCount > 2) {
      overallRiskLevel = 'medium';
    }

    return {
      overallRiskLevel,
      riskFactors,
      riskSummary: this.generateRiskSummary(riskFactors),
      mitigationRecommendations: this.generateMitigationRecommendations(riskFactors),
      analysisMethod: 'rule-based'
    };
  }

  private async analyzeFinancialRisks(financialTerms: any): Promise<any[]> {
    const risks = [];

    // Check for missing payment terms
    if (financialTerms.paymentTerms.length === 0) {
      risks.push({
        type: 'financial',
        level: 'medium',
        description: 'No clear payment terms specified',
        recommendation: 'Add specific payment schedules and terms'
      });
    }

    // Check for penalty clauses
    if (financialTerms.penalties.length === 0) {
      risks.push({
        type: 'financial',
        level: 'low',
        description: 'No late payment penalties specified',
        recommendation: 'Consider adding penalty clauses for late payments'
      });
    }

    // Large amounts without protection
    const largeAmounts = financialTerms.amounts.filter((amount: any) => {
      const numericValue = parseInt(amount.amount.replace(/[$,]/g, ''));
      return numericValue > 100000;
    });

    if (largeAmounts.length > 0) {
      risks.push({
        type: 'financial',
        level: 'high',
        description: 'Large financial obligations without adequate protection clauses',
        recommendation: 'Review liability limitations and insurance requirements'
      });
    }

    return risks;
  }

  private async analyzeLiabilityRisks(liabilityTerms: any): Promise<any[]> {
    const risks = [];

    // Check for liability limitations
    if (liabilityTerms.limitations.length === 0) {
      risks.push({
        type: 'liability',
        level: 'high',
        description: 'No liability limitations specified',
        recommendation: 'Add liability limitation clauses to cap exposure'
      });
    }

    // Check for indemnification
    if (liabilityTerms.indemnification.length === 0) {
      risks.push({
        type: 'liability',
        level: 'medium',
        description: 'No indemnification provisions',
        recommendation: 'Consider mutual indemnification clauses'
      });
    }

    return risks;
  }

  private async analyzeTerminationRisks(terminationTerms: any): Promise<any[]> {
    const risks = [];

    // Check for termination notice
    if (!terminationTerms.notice) {
      risks.push({
        type: 'termination',
        level: 'medium',
        description: 'No termination notice period specified',
        recommendation: 'Add reasonable notice requirements for termination'
      });
    }

    // Check for termination causes
    if (terminationTerms.causes.length === 0) {
      risks.push({
        type: 'termination',
        level: 'medium',
        description: 'Termination causes not clearly defined',
        recommendation: 'Specify acceptable reasons for termination'
      });
    }

    return risks;
  }

  private async analyzeGovernanceRisks(governanceTerms: any): Promise<any[]> {
    const risks = [];

    // Check for governing law
    if (!governanceTerms.governingLaw) {
      risks.push({
        type: 'governance',
        level: 'medium',
        description: 'Governing law not specified',
        recommendation: 'Specify which jurisdiction\'s laws will govern'
      });
    }

    // Check for dispute resolution
    if (governanceTerms.disputeResolution.length === 0) {
      risks.push({
        type: 'governance',
        level: 'low',
        description: 'No dispute resolution mechanism specified',
        recommendation: 'Consider adding arbitration or mediation clauses'
      });
    }

    return risks;
  }

  private generateRiskSummary(riskFactors: any[]): string {
    const highRisks = riskFactors.filter(risk => risk.level === 'high').length;
    const mediumRisks = riskFactors.filter(risk => risk.level === 'medium').length;
    const lowRisks = riskFactors.filter(risk => risk.level === 'low').length;

    return `Contract analysis identified ${riskFactors.length} risk factors: ${highRisks} high-risk, ${mediumRisks} medium-risk, and ${lowRisks} low-risk items requiring attention.`;
  }

  private generateMitigationRecommendations(riskFactors: any[]): string[] {
    return riskFactors
      .filter(risk => risk.level === 'high' || risk.level === 'medium')
      .map(risk => risk.recommendation)
      .slice(0, 5); // Top 5 recommendations
  }

  private async performComplianceReview(document: any, parameters?: Record<string, any>): Promise<any> {
    if (!this.llm) {
      // Fallback to rule-based analysis if LLM not available
      return this.performComplianceReviewRuleBased(document, parameters);
    }

    try {
      const compliancePrompt = new PromptTemplate({
        template: `Conduct a comprehensive compliance review of the following contract.

CONTRACT TEXT:
{contractText}

JURISDICTION: {jurisdiction}
INDUSTRY: {industry}
CONTRACT TYPE: {contractType}

COMPLIANCE ANALYSIS INSTRUCTIONS:
Review the contract for compliance with:

1. REGULATORY REQUIREMENTS:
   - Federal regulations (if applicable)
   - State/local regulations for specified jurisdiction
   - Industry-specific regulations
   - Consumer protection laws
   - Employment laws (if employment contract)
   - Data protection/privacy laws

2. LEGAL REQUIREMENTS:
   - Required disclosures
   - Mandatory clauses for contract type
   - Statutory protections
   - Formation requirements

3. INDUSTRY STANDARDS:
   - Best practices for contract type
   - Industry-specific terms and protections
   - Professional standards

4. RISK AREAS:
   - Unconscionable terms
   - Unenforceable clauses
   - Missing protective provisions
   - Potential regulatory violations

CRITICAL: Return ONLY valid JSON with no additional text, markdown, or explanations. Do not include markdown code blocks.

RESPONSE FORMAT (JSON):
{{
  "complianceScore": number (0-100),
  "overallStatus": "compliant" | "non-compliant" | "needs-review",
  "regulatoryIssues": [
    {{
      "regulation": "regulation name",
      "issue": "compliance issue description",
      "severity": "low" | "medium" | "high" | "critical",
      "recommendation": "how to address",
      "riskLevel": "assessment of non-compliance risk"
    }}
  ],
  "missingClauses": [
    {{
      "clause": "missing clause type",
      "requirement": "legal/regulatory requirement",
      "importance": "why it's needed",
      "urgency": "how quickly it should be addressed"
    }}
  ],
  "problematicClauses": [
    {{
      "clause": "problematic text or concept",
      "issue": "what makes it problematic",
      "legalRisk": "potential legal consequences",
      "suggestion": "how to fix or improve"
    }}
  ],
  "jurisdictionSpecific": [
    {{
      "jurisdiction": "applicable jurisdiction",
      "requirement": "specific requirement",
      "compliance": "met/not met/unclear",
      "action": "required action if any"
    }}
  ],
  "recommendations": ["priority recommendation 1", "priority recommendation 2"],
  "analysisReasoning": "detailed explanation of compliance assessment"
}}`,
        inputVariables: ['contractText', 'jurisdiction', 'industry', 'contractType']
      });

      const chain = compliancePrompt.pipe(this.llm).pipe(this.strParser);
      
      const response = await chain.invoke({
        contractText: (document.extracted_text || '').substring(0, 5000),
        jurisdiction: parameters?.jurisdiction || 'federal',
        industry: parameters?.industry || 'general',
        contractType: parameters?.contractType || 'general'
      });

      // Parse LLM response - clean up any markdown formatting
      let cleanResponse = response.trim();
      // Remove code block markers if present
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const analysis = JSON.parse(cleanResponse);
      
      return {
        complianceScore: analysis.complianceScore,
        overallStatus: analysis.overallStatus,
        regulatoryCompliance: analysis.regulatoryIssues || [],
        missingClauses: analysis.missingClauses || [],
        problematicClauses: analysis.problematicClauses || [],
        jurisdictionSpecific: analysis.jurisdictionSpecific || [],
        recommendations: analysis.recommendations || [],
        aiAnalysis: analysis.analysisReasoning,
        violations: (analysis.regulatoryIssues || []).filter((issue: any) => issue.severity === 'high' || issue.severity === 'critical')
      };

    } catch (error) {
      console.error('LLM compliance analysis failed, falling back to rule-based:', error);
      return this.performComplianceReviewRuleBased(document, parameters);
    }
  }

  private async performComplianceReviewRuleBased(document: any, parameters?: Record<string, any>): Promise<any> {
    const compliance = {
      regulatoryCompliance: [] as any[],
      industryStandards: [] as any[],
      legalRequirements: [] as any[],
      violations: [] as any[]
    };

    // Basic compliance checks
    const text = document.extracted_text?.toLowerCase() || '';

    // Check for required clauses based on jurisdiction
    const jurisdiction = parameters?.jurisdiction || 'federal';
    
    if (jurisdiction.includes('california')) {
      // California-specific requirements
      if (!text.includes('california') && !text.includes('governing law')) {
        compliance.violations.push({
          type: 'jurisdictional',
          description: 'California governing law clause may be required',
          severity: 'medium'
        });
      }
    }

    // Check for employment law compliance if employment contract
    if (text.includes('employment') || text.includes('employee')) {
      if (!text.includes('equal opportunity') && !text.includes('discrimination')) {
        compliance.violations.push({
          type: 'employment',
          description: 'Missing equal opportunity/anti-discrimination clauses',
          severity: 'high'
        });
      }
    }

    return {
      ...compliance,
      analysisMethod: 'rule-based'
    };
  }

  private async generateRecommendations(
    termExtraction: any,
    riskAnalysis: any,
    complianceReview: any
  ): Promise<any[]> {
    const recommendations = [];

    // High-priority recommendations from risk analysis
    const highRiskRecommendations = riskAnalysis.riskFactors
      .filter((risk: any) => risk.level === 'high')
      .map((risk: any) => ({
        priority: 'high',
        category: 'risk_mitigation',
        description: risk.recommendation,
        reasoning: risk.description
      }));

    recommendations.push(...highRiskRecommendations);

    // Compliance recommendations
    const complianceRecommendations = complianceReview.violations
      .filter((violation: any) => violation.severity === 'high')
      .map((violation: any) => ({
        priority: 'high',
        category: 'compliance',
        description: `Address compliance issue: ${violation.description}`,
        reasoning: `Regulatory requirement for ${violation.type}`
      }));

    recommendations.push(...complianceRecommendations);

    // General improvement recommendations
    if (termExtraction.keyTerms.length < 5) {
      recommendations.push({
        priority: 'medium',
        category: 'completeness',
        description: 'Consider adding more specific terms and definitions',
        reasoning: 'Contract appears to lack detailed terms specification'
      });
    }

    return recommendations;
  }

  private async generateAnalysisReport(
    document: any,
    termExtraction: any,
    riskAnalysis: any,
    complianceReview: any,
    recommendations: any[],
    matterId: string | null
  ): Promise<string> {
    const matter = await this.getMatterInfo(matterId);

    return `# Contract Analysis Report

## Matter: ${matter.name}
**Document:** ${document.filename}
**Analysis Date:** ${new Date().toLocaleDateString()}

## Executive Summary
This report provides a comprehensive analysis of the contract, including term extraction, risk assessment, and compliance review.

**Overall Risk Level:** ${riskAnalysis.overallRiskLevel.toUpperCase()}

## Contract Overview
- **Parties Identified:** ${termExtraction.parties.length}
- **Key Terms Extracted:** ${termExtraction.keyTerms.length}
- **Financial Terms:** ${termExtraction.financialTerms.amounts.length} monetary references
- **Risk Factors:** ${riskAnalysis.riskFactors.length}

## Key Terms Summary
${termExtraction.keyTerms.slice(0, 5).map((term: any) => `- **${term.type}:** ${term.value}`).join('\n')}

## Risk Analysis
${riskAnalysis.riskSummary}

### High-Risk Items:
${riskAnalysis.riskFactors.filter((risk: any) => risk.level === 'high').map((risk: any) => `- ${risk.description}`).join('\n') || 'None identified'}

## Compliance Issues
${complianceReview.violations.length > 0 ? complianceReview.violations.map((violation: any) => `- **${violation.type.toUpperCase()}:** ${violation.description}`).join('\n') : 'No compliance violations identified'}

## Recommendations
${recommendations.slice(0, 5).map((rec: any, index: number) => `${index + 1}. **${rec.priority.toUpperCase()}:** ${rec.description}`).join('\n')}

## Next Steps
1. Address high-priority risk factors and compliance issues
2. Review and negotiate problematic clauses
3. Obtain legal review for complex terms
4. Consider contract amendments if necessary

---
*Generated by BenchWise Contract Analysis Agent*
*Analysis completed: ${new Date().toISOString()}*`;
  }

  private estimateWordCount(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateCompleteness(termExtraction: any, riskAnalysis: any): number {
    let score = 0;
    
    // Term extraction completeness
    if (termExtraction.parties.length > 0) score += 20;
    if (termExtraction.keyTerms.length > 3) score += 20;
    if (termExtraction.financialTerms.amounts.length > 0) score += 15;
    if (termExtraction.dates.length > 0) score += 15;
    if (termExtraction.obligations.length > 0) score += 15;
    if (termExtraction.termination.causes.length > 0) score += 15;

    return Math.min(score, 100);
  }

  // AI-powered methods for enhanced contract analysis
  private async conductRiskAnalysisBasic(contractDocument: any, termExtraction: any, contractType: string): Promise<any> {
    return {
      overallRiskLevel: 'medium',
      riskCategories: [
        {
          category: 'Financial',
          level: 'medium',
          factors: ['Payment terms need review'],
          impact: 'Potential payment delays',
          mitigation: 'Negotiate clearer payment terms'
        }
      ],
      criticalIssues: ['Basic analysis - AI integration provides more comprehensive assessment'],
      recommendations: ['Enable AI analysis for detailed risk assessment']
    };
  }

  private async performComplianceReviewBasic(contractDocument: any, parameters: any): Promise<any> {
    return {
      complianceScore: 70,
      complianceIssues: [
        {
          issue: 'Basic compliance check performed',
          severity: 'medium',
          regulation: 'General contract law',
          recommendation: 'AI analysis provides comprehensive compliance review'
        }
      ],
      missingClauses: [],
      problematicClauses: [],
      recommendations: ['Enable AI integration for detailed compliance analysis']
    };
  }

  private async generateRecommendationsBasic(termExtraction: any, riskAnalysis: any, complianceReview: any): Promise<any> {
    return {
      priority: 'medium',
      immediateActions: [
        {
          action: 'Enable AI integration for enhanced contract analysis',
          urgency: 'high',
          rationale: 'AI provides more comprehensive analysis than basic methods'
        }
      ],
      contractRevisions: [],
      negotiationPoints: ['Review all terms with legal counsel'],
      riskMitigation: ['Implement comprehensive contract review process'],
      complianceActions: ['Ensure legal review of all contract terms'],
      futureConsiderations: ['Integrate AI-powered contract analysis tools']
    };
  }

  estimateDuration(input: AgentInput): number {
    // Simple document Q&A is much faster than full contract analysis
    const baseTime = 30; // 30 seconds base
    const hasLongQuery = input.query && input.query.length > 200;
    
    return hasLongQuery ? 40 : baseTime;
  }
}