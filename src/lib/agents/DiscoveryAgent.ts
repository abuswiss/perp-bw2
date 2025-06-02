import { BaseAgent } from './BaseAgent';
import { AgentInput, AgentOutput, AgentCapability } from './types';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getDefaultChatModel } from '@/lib/providers';
import { v4 as uuidv4 } from 'uuid';

export class DiscoveryAgent extends BaseAgent {
  id = 'discovery-agent';
  type = 'review' as const;
  name = 'Discovery Review Agent';
  description = 'Automated document review, privilege identification, and discovery management';
  
  capabilities: AgentCapability[] = [
    {
      name: 'Document Review',
      description: 'Automated review of documents for responsiveness and privilege',
      inputTypes: ['documents', 'review_criteria', 'privilege_rules'],
      outputTypes: ['review_results', 'privilege_log', 'responsive_docs'],
      estimatedDuration: 180
    },
    {
      name: 'Privilege Identification',
      description: 'Identify attorney-client privileged communications',
      inputTypes: ['documents', 'attorney_list', 'client_list'],
      outputTypes: ['privilege_log', 'privileged_docs', 'waiver_analysis'],
      estimatedDuration: 120
    },
    {
      name: 'Responsive Document Classification',
      description: 'Classify documents by responsiveness to discovery requests',
      inputTypes: ['documents', 'discovery_requests', 'classification_rules'],
      outputTypes: ['classified_docs', 'production_set', 'review_report'],
      estimatedDuration: 150
    },
    {
      name: 'Hot Document Identification',
      description: 'Identify potentially problematic or key documents',
      inputTypes: ['documents', 'risk_keywords', 'matter_context'],
      outputTypes: ['hot_docs', 'risk_analysis', 'priority_review'],
      estimatedDuration: 90
    }
  ];

  requiredContext = ['matter_info', 'discovery_requests'];
  
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
        (this.llm as any).temperature = 0.1; // Very low temperature for consistent legal analysis
      }
    } catch (error) {
      console.error('Failed to initialize LLM for DiscoveryAgent:', error);
    }
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    
    try {
      if (!this.validateInput(input)) {
        return {
          success: false,
          result: null,
          error: 'Invalid input parameters - matter info and discovery requests required'
        };
      }

      const taskId = input.context?.task_id || uuidv4();
      const executionId = await this.createExecution(taskId, input);
      
      // Step 1: Load and analyze documents
      await this.logExecution(taskId, 'Loading and analyzing documents', 10);
      const documents = await this.loadDocuments(input);
      const analysisConfig = await this.setupAnalysis(input);

      // Step 2: Perform AI-powered privilege review
      await this.logExecution(taskId, 'Conducting AI-powered privilege review', 30);
      const privilegeResults = await this.conductPrivilegeReview(documents, analysisConfig);

      // Step 3: Analyze responsiveness with AI
      await this.logExecution(taskId, 'Analyzing document responsiveness with AI', 50);
      const responsivenessResults = await this.analyzeResponsiveness(documents, analysisConfig);

      // Step 4: Identify hot documents using AI
      await this.logExecution(taskId, 'AI-powered identification of hot documents and key evidence', 70);
      const hotDocResults = await this.identifyHotDocuments(documents, analysisConfig);

      // Step 5: Generate privilege log and production set
      await this.logExecution(taskId, 'Generating privilege log and production recommendations', 85);
      const privilegeLog = await this.generatePrivilegeLog(privilegeResults);
      const productionSet = await this.generateProductionSet(responsivenessResults, privilegeResults);

      // Step 6: Create comprehensive review report
      await this.logExecution(taskId, 'Generating discovery review report', 95);
      const reviewReport = await this.generateReviewReport(
        documents, privilegeResults, responsivenessResults, hotDocResults, input.matterId
      );

      const output: AgentOutput = {
        success: true,
        result: {
          totalDocuments: documents.length,
          privilegeResults,
          responsivenessResults,
          hotDocResults,
          privilegeLog,
          productionSet,
          reviewReport,
          statistics: this.calculateStatistics(documents, privilegeResults, responsivenessResults)
        },
        citations: [],
        metadata: {
          executionId,
          reviewType: analysisConfig.reviewType,
          privilegedCount: privilegeResults.privilegedDocuments.length,
          responsiveCount: responsivenessResults.responsiveDocuments.length,
          hotDocCount: hotDocResults.hotDocuments.length
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

  private async loadDocuments(input: AgentInput): Promise<any[]> {
    let documents = [];

    if (input.documents && input.documents.length > 0) {
      // Load specific documents by ID
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .in('id', input.documents);
      
      if (error) throw new Error(`Failed to load documents: ${error.message}`);
      documents = data || [];
    } else {
      // Load all documents for the matter
      documents = await this.getMatterDocuments(input.matterId);
    }

    return documents;
  }

  private async setupAnalysis(input: AgentInput): Promise<any> {
    const matter = await this.getMatterInfo(input.matterId);
    
    return {
      matterId: input.matterId,
      matterName: matter.name,
      clientName: matter.client_name,
      reviewType: input.parameters?.reviewType || 'comprehensive',
      discoveryRequests: input.parameters?.discoveryRequests || [],
      privilegeKeywords: this.getPrivilegeKeywords(),
      hotDocKeywords: this.getHotDocKeywords(matter),
      attorneys: input.parameters?.attorneys || [],
      timeRange: input.parameters?.timeRange,
      responsivenessCriteria: input.parameters?.responsivenessCriteria || {}
    };
  }

  private getPrivilegeKeywords(): string[] {
    return [
      'attorney-client', 'privileged', 'confidential', 'legal advice',
      'counsel', 'attorney', 'lawyer', 'law firm', 'legal opinion',
      'attorney work product', 'prepared for litigation', 'in anticipation of litigation',
      'legal strategy', 'settlement discussions', 'mediation'
    ];
  }

  private getHotDocKeywords(matter: any): string[] {
    const baseKeywords = [
      'terminate', 'fire', 'lawsuit', 'sue', 'litigation', 'breach',
      'violation', 'illegal', 'fraud', 'cover up', 'hide', 'destroy',
      'delete', 'smoking gun', 'problem', 'issue', 'concern', 'worried',
      'liability', 'damages', 'settlement', 'deny', 'refuse'
    ];

    // Add matter-specific keywords based on matter type
    const matterSpecific = [];
    const matterName = matter.name?.toLowerCase() || '';
    
    if (matterName.includes('employment')) {
      matterSpecific.push('discriminat', 'harass', 'retaliat', 'wrongful termination');
    } else if (matterName.includes('contract')) {
      matterSpecific.push('breach', 'default', 'terminate contract', 'force majeure');
    } else if (matterName.includes('ip') || matterName.includes('patent')) {
      matterSpecific.push('infring', 'steal', 'copy', 'trade secret');
    }

    return [...baseKeywords, ...matterSpecific];
  }

  private async conductPrivilegeReview(documents: any[], config: any): Promise<any> {
    const privilegedDocuments = [];
    const nonPrivilegedDocuments = [];
    const potentialWaivers = [];

    for (const doc of documents) {
      const analysis = await this.analyzePrivilege(doc, config);
      
      if (analysis.isPrivileged) {
        privilegedDocuments.push({
          ...doc,
          privilegeType: analysis.privilegeType,
          privilegeBasis: analysis.basis,
          confidence: analysis.confidence
        });
      } else {
        nonPrivilegedDocuments.push(doc);
      }

      if (analysis.potentialWaiver) {
        potentialWaivers.push({
          document: doc,
          waiverRisk: analysis.waiverRisk,
          reason: analysis.waiverReason
        });
      }
    }

    return {
      privilegedDocuments,
      nonPrivilegedDocuments,
      potentialWaivers,
      privilegeStatistics: {
        total: documents.length,
        privileged: privilegedDocuments.length,
        nonPrivileged: nonPrivilegedDocuments.length,
        potentialWaivers: potentialWaivers.length
      }
    };
  }

  private async analyzePrivilege(document: any, config: any): Promise<any> {
    if (!this.llm) {
      // Fallback to rule-based analysis if LLM not available
      return this.analyzePrivilegeRuleBased(document, config);
    }

    try {
      const privilegePrompt = new PromptTemplate({
        template: `Analyze the following document for attorney-client privilege and work product protection.

DOCUMENT INFORMATION:
Filename: {filename}
Matter: {matterName}
Client: {clientName}

DOCUMENT TEXT:
{documentText}

ANALYSIS INSTRUCTIONS:
1. Determine if this document is protected by attorney-client privilege
2. Determine if this document qualifies as attorney work product
3. Identify any potential privilege waivers or risks
4. Provide confidence level (0-100) for your assessment

Consider these factors:
- Communications between attorney and client
- Legal advice being sought or provided
- Documents prepared in anticipation of litigation
- Presence of third parties that might waive privilege
- Attorney work product doctrine protections

RESPONSE FORMAT (JSON):
{{
  "isPrivileged": boolean,
  "privilegeType": "attorney-client" | "work-product" | "none",
  "confidence": number (0-100),
  "privilegeBasis": ["reason1", "reason2"],
  "potentialWaiver": boolean,
  "waiverRisk": "low" | "medium" | "high",
  "waiverReason": "explanation if waiver risk exists",
  "analysis": "detailed explanation of privilege determination",
  "recommendations": ["action1", "action2"]
}}`,
        inputVariables: ['filename', 'matterName', 'clientName', 'documentText']
      });

      const chain = privilegePrompt.pipe(this.llm).pipe(this.strParser);
      
      const response = await chain.invoke({
        filename: document.filename || 'Unknown',
        matterName: config.matterName || 'Unknown Matter',
        clientName: config.clientName || 'Unknown Client',
        documentText: (document.extracted_text || '').substring(0, 4000) // Limit for token efficiency
      });

      // Parse LLM response
      const analysis = JSON.parse(response);
      
      return {
        isPrivileged: analysis.isPrivileged,
        privilegeType: analysis.privilegeType,
        basis: analysis.privilegeBasis,
        confidence: analysis.confidence,
        potentialWaiver: analysis.potentialWaiver,
        waiverRisk: analysis.waiverRisk,
        waiverReason: analysis.waiverReason,
        aiAnalysis: analysis.analysis,
        recommendations: analysis.recommendations
      };

    } catch (error) {
      console.error('LLM privilege analysis failed, falling back to rule-based:', error);
      return this.analyzePrivilegeRuleBased(document, config);
    }
  }

  private async analyzePrivilegeRuleBased(document: any, config: any): Promise<any> {
    const text = document.extracted_text?.toLowerCase() || '';
    const filename = document.filename?.toLowerCase() || '';
    
    let privilegeScore = 0;
    let privilegeType = '';
    let basis = [];
    let confidence = 0;

    // Check for attorney-client privilege indicators
    for (const keyword of config.privilegeKeywords) {
      if (text.includes(keyword.toLowerCase()) || filename.includes(keyword.toLowerCase())) {
        privilegeScore += 1;
        basis.push(keyword);
      }
    }

    // Check for attorney communications
    const attorneyIndicators = ['@lawfirm.com', 'esq', 'attorney', 'counsel'];
    const hasAttorneyParticipant = attorneyIndicators.some(indicator => 
      text.includes(indicator) || filename.includes(indicator)
    );

    if (hasAttorneyParticipant) {
      privilegeScore += 2;
      privilegeType = 'attorney-client';
      basis.push('attorney participant');
    }

    // Check for work product
    const workProductIndicators = ['draft', 'strategy', 'litigation', 'prepared for', 'analysis'];
    const hasWorkProduct = workProductIndicators.some(indicator => text.includes(indicator));

    if (hasWorkProduct && hasAttorneyParticipant) {
      privilegeScore += 1;
      privilegeType = privilegeType || 'work product';
      basis.push('work product');
    }

    // Calculate confidence
    confidence = Math.min(privilegeScore / 5, 1) * 100;

    // Check for potential waiver
    const waiverIndicators = ['forwarded', 'cc:', 'third party', 'external'];
    const potentialWaiver = waiverIndicators.some(indicator => text.includes(indicator));

    return {
      isPrivileged: privilegeScore >= 2,
      privilegeType,
      basis,
      confidence,
      potentialWaiver,
      waiverRisk: potentialWaiver ? 'medium' : 'low',
      waiverReason: potentialWaiver ? 'Third party disclosure detected' : null,
      analysisMethod: 'rule-based'
    };
  }

  private async analyzeResponsiveness(documents: any[], config: any): Promise<any> {
    const responsiveDocuments = [] as any[];
    const nonResponsiveDocuments = [] as any[];

    for (const doc of documents) {
      const responsiveness = await this.analyzeDocumentResponsiveness(doc, config);
      
      if (responsiveness.isResponsive) {
        responsiveDocuments.push({
          ...doc,
          responsiveToRequests: responsiveness.responsiveToRequests,
          relevanceScore: responsiveness.relevanceScore,
          keyTermsFound: responsiveness.keyTermsFound
        });
      } else {
        nonResponsiveDocuments.push(doc);
      }
    }

    return {
      responsiveDocuments,
      nonResponsiveDocuments,
      responsivenessStatistics: {
        total: documents.length,
        responsive: responsiveDocuments.length,
        nonResponsive: nonResponsiveDocuments.length,
        responsivenessRate: responsiveDocuments.length / documents.length
      }
    };
  }

  private async analyzeDocumentResponsiveness(document: any, config: any): Promise<any> {
    const text = document.extracted_text?.toLowerCase() || '';
    const filename = document.filename?.toLowerCase() || '';
    
    let relevanceScore = 0;
    const responsiveToRequests = [];
    const keyTermsFound = [];

    // Check against discovery requests
    for (const request of config.discoveryRequests) {
      const requestKeywords = this.extractKeywords(request.text || request);
      let requestScore = 0;

      for (const keyword of requestKeywords) {
        if (text.includes(keyword.toLowerCase()) || filename.includes(keyword.toLowerCase())) {
          requestScore += 1;
          keyTermsFound.push(keyword);
        }
      }

      if (requestScore > 0) {
        responsiveToRequests.push({
          requestId: request.id || responsiveToRequests.length + 1,
          requestText: request.text || request,
          matchScore: requestScore,
          matchedTerms: keyTermsFound
        });
        relevanceScore += requestScore;
      }
    }

    return {
      isResponsive: relevanceScore > 0,
      responsiveToRequests,
      relevanceScore,
      keyTermsFound: [...new Set(keyTermsFound)]
    };
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been'].includes(word));
    
    return [...new Set(words)];
  }

  private async identifyHotDocuments(documents: any[], config: any): Promise<any> {
    const hotDocuments = [];

    for (const doc of documents) {
      const analysis = await this.analyzeHotDoc(doc, config);
      
      if (analysis.isHot) {
        hotDocuments.push({
          ...doc,
          hotScore: analysis.hotScore,
          riskFactors: analysis.riskFactors,
          riskLevel: analysis.riskLevel,
          flaggedTerms: analysis.flaggedTerms
        });
      }
    }

    // Sort by hot score descending
    hotDocuments.sort((a, b) => b.hotScore - a.hotScore);

    return {
      hotDocuments,
      totalHotDocs: hotDocuments.length,
      highRiskDocs: hotDocuments.filter(doc => doc.riskLevel === 'high').length,
      mediumRiskDocs: hotDocuments.filter(doc => doc.riskLevel === 'medium').length
    };
  }

  private async analyzeHotDoc(document: any, config: any): Promise<any> {
    if (!this.llm) {
      // Fallback to rule-based analysis if LLM not available
      return this.analyzeHotDocRuleBased(document, config);
    }

    try {
      const hotDocPrompt = new PromptTemplate({
        template: `Analyze the following document to identify potential risks, issues, or "hot" content that could be problematic in litigation.

DOCUMENT INFORMATION:
Filename: {filename}
Matter Type: {matterName}
Date Context: {dateContext}

DOCUMENT TEXT:
{documentText}

ANALYSIS INSTRUCTIONS:
Identify content that could be:
1. Damaging admissions or statements
2. Evidence of wrongdoing or liability
3. Contradictory statements or inconsistencies
4. Communications about destruction of evidence
5. Statements showing knowledge of problems
6. Inflammatory or emotional language that could hurt case
7. Financial irregularities or problems
8. Regulatory violations or compliance issues

Consider the context of litigation risk and potential damage to the case.

RESPONSE FORMAT (JSON):
{{
  "isHot": boolean,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": number (0-100),
  "riskCategories": ["category1", "category2"],
  "keyFindings": ["finding1", "finding2"],
  "damagingContent": ["quote1", "quote2"],
  "legalImplications": "explanation of legal risks",
  "urgencyLevel": "low" | "medium" | "high",
  "recommendedActions": ["action1", "action2"],
  "analysisReasoning": "detailed explanation of risk assessment"
}}`,
        inputVariables: ['filename', 'matterName', 'dateContext', 'documentText']
      });

      const chain = hotDocPrompt.pipe(this.llm).pipe(this.strParser);
      
      const response = await chain.invoke({
        filename: document.filename || 'Unknown',
        matterName: config.matterName || 'Unknown Matter',
        dateContext: document.created_at || 'Unknown date',
        documentText: (document.extracted_text || '').substring(0, 4000) // Limit for token efficiency
      });

      // Parse LLM response
      const analysis = JSON.parse(response);
      
      return {
        isHot: analysis.isHot,
        hotScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        riskFactors: analysis.keyFindings,
        flaggedTerms: analysis.damagingContent,
        legalImplications: analysis.legalImplications,
        urgencyLevel: analysis.urgencyLevel,
        recommendedActions: analysis.recommendedActions,
        aiAnalysis: analysis.analysisReasoning,
        riskCategories: analysis.riskCategories
      };

    } catch (error) {
      console.error('LLM hot doc analysis failed, falling back to rule-based:', error);
      return this.analyzeHotDocRuleBased(document, config);
    }
  }

  private async analyzeHotDocRuleBased(document: any, config: any): Promise<any> {
    const text = document.extracted_text?.toLowerCase() || '';
    const filename = document.filename?.toLowerCase() || '';
    
    let hotScore = 0;
    const flaggedTerms = [];
    const riskFactors = [];

    // Check for hot keywords
    for (const keyword of config.hotDocKeywords) {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      const matches = text.match(regex) || filename.match(regex);
      
      if (matches) {
        hotScore += matches.length;
        flaggedTerms.push(...matches);
        riskFactors.push(`Contains "${keyword}" keyword`);
      }
    }

    // Check for email characteristics that increase risk
    if (text.includes('@') && text.includes('subject:')) {
      // Email document - check for risk patterns
      if (text.includes('urgent') || text.includes('asap') || text.includes('emergency')) {
        hotScore += 2;
        riskFactors.push('Urgent communication');
      }
      
      if (text.includes('delete') || text.includes('remove') || text.includes('destroy')) {
        hotScore += 3;
        riskFactors.push('Document destruction reference');
      }
    }

    // Determine risk level
    let riskLevel = 'low';
    if (hotScore >= 5) {
      riskLevel = 'high';
    } else if (hotScore >= 2) {
      riskLevel = 'medium';
    }

    return {
      isHot: hotScore > 0,
      hotScore,
      riskFactors,
      riskLevel,
      flaggedTerms: [...new Set(flaggedTerms)],
      analysisMethod: 'rule-based'
    };
  }

  private async generatePrivilegeLog(privilegeResults: any): Promise<any[]> {
    return privilegeResults.privilegedDocuments.map((doc: any, index: number) => ({
      logNumber: index + 1,
      documentId: doc.id,
      filename: doc.filename,
      date: doc.created_at,
      author: 'TBD', // Would need to extract from document
      recipient: 'TBD', // Would need to extract from document
      privilegeType: doc.privilegeType,
      privilegeBasis: doc.privilegeBasis.join(', '),
      description: `${doc.file_type} document containing ${doc.privilegeType} communications`,
      confidenceScore: doc.confidence
    }));
  }

  private async generateProductionSet(responsivenessResults: any, privilegeResults: any): Promise<any> {
    const productionDocuments = responsivenessResults.responsiveDocuments.filter((doc: any) => 
      !privilegeResults.privilegedDocuments.some((privDoc: any) => privDoc.id === doc.id)
    );

    return {
      documents: productionDocuments.map((doc: any) => ({
        documentId: doc.id,
        filename: doc.filename,
        responsiveToRequests: doc.responsiveToRequests.map((req: any) => req.requestId),
        relevanceScore: doc.relevanceScore,
        recommendedForProduction: true
      })),
      totalCount: productionDocuments.length,
      privilegedWithheld: privilegeResults.privilegedDocuments.length,
      nonResponsiveExcluded: responsivenessResults.nonResponsiveDocuments.length
    };
  }

  private async generateReviewReport(
    documents: any[],
    privilegeResults: any,
    responsivenessResults: any,
    hotDocResults: any,
    matterId: string | null
  ): Promise<string> {
    const matter = await this.getMatterInfo(matterId);
    const stats = this.calculateStatistics(documents, privilegeResults, responsivenessResults);

    return `# Discovery Review Report

## Matter: ${matter.name}
**Date:** ${new Date().toLocaleDateString()}
**Review Scope:** ${documents.length} documents

## Executive Summary
This report summarizes the automated discovery review conducted for ${matter.name}. 
A total of ${documents.length} documents were analyzed for privilege, responsiveness, and potential risks.

## Review Statistics
- **Total Documents Reviewed:** ${stats.totalDocuments}
- **Privileged Documents:** ${stats.privilegedDocuments} (${stats.privilegeRate}%)
- **Responsive Documents:** ${stats.responsiveDocuments} (${stats.responsivenessRate}%)
- **Hot Documents Identified:** ${hotDocResults.totalHotDocs}
- **Documents for Production:** ${stats.productionDocuments}

## Privilege Review Results
${privilegeResults.privilegeStatistics.privileged} documents identified as privileged:
- Attorney-Client Privilege: ${privilegeResults.privilegedDocuments.filter((d: any) => d.privilegeType === 'attorney-client').length}
- Work Product: ${privilegeResults.privilegedDocuments.filter((d: any) => d.privilegeType === 'work product').length}
- Potential Privilege Waivers: ${privilegeResults.potentialWaivers.length}

## Responsiveness Analysis
${responsivenessResults.responsiveDocuments.length} documents identified as responsive to discovery requests.

## Hot Document Summary
${hotDocResults.totalHotDocs} hot documents identified requiring priority review:
- High Risk: ${hotDocResults.highRiskDocs}
- Medium Risk: ${hotDocResults.mediumRiskDocs}

## Recommendations
1. **Priority Review:** Focus on ${hotDocResults.highRiskDocs} high-risk documents immediately
2. **Privilege Verification:** Manual review recommended for ${privilegeResults.potentialWaivers.length} documents with potential waiver issues
3. **Production Preparation:** ${stats.productionDocuments} documents ready for production after final review
4. **Additional Review:** Consider expanded keyword searches based on hot document findings

## Next Steps
1. Manual review of flagged high-risk documents
2. Privilege log finalization
3. Production set preparation
4. Quality control sampling

---
*Generated by BenchWise Discovery Agent*
*Timestamp: ${new Date().toISOString()}*`;
  }

  private calculateStatistics(documents: any[], privilegeResults: any, responsivenessResults: any): any {
    const totalDocuments = documents.length;
    const privilegedDocuments = privilegeResults.privilegedDocuments.length;
    const responsiveDocuments = responsivenessResults.responsiveDocuments.length;
    const productionDocuments = responsiveDocuments - privilegedDocuments;

    return {
      totalDocuments,
      privilegedDocuments,
      responsiveDocuments,
      productionDocuments,
      privilegeRate: totalDocuments > 0 ? Math.round((privilegedDocuments / totalDocuments) * 100) : 0,
      responsivenessRate: totalDocuments > 0 ? Math.round((responsiveDocuments / totalDocuments) * 100) : 0
    };
  }

  estimateDuration(input: AgentInput): number {
    const documentCount = input.documents?.length || 10; // Default assumption
    const baseTimePerDoc = 2; // 2 seconds per document
    const complexityFactor = input.parameters?.reviewType === 'comprehensive' ? 1.5 : 1.0;
    
    return Math.round(documentCount * baseTimePerDoc * complexityFactor);
  }
}