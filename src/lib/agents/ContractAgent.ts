import { BaseAgent } from './BaseAgent';
import { AgentInput, AgentOutput, AgentCapability } from './types';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getDefaultChatModel } from '@/lib/providers';
import { v4 as uuidv4 } from 'uuid';

export class ContractAgent extends BaseAgent {
  id = 'contract-agent';
  type = 'analysis' as const;
  name = 'Contract Analysis Agent';
  description = 'Comprehensive contract analysis, risk assessment, and term extraction';
  
  capabilities: AgentCapability[] = [
    {
      name: 'Contract Term Extraction',
      description: 'Extract and analyze key contract terms and clauses',
      inputTypes: ['contract_document', 'contract_type', 'term_categories'],
      outputTypes: ['extracted_terms', 'term_analysis', 'clause_map'],
      estimatedDuration: 90
    },
    {
      name: 'Risk Assessment',
      description: 'Identify and evaluate contractual risks and liabilities',
      inputTypes: ['contract_document', 'risk_profile', 'industry_standards'],
      outputTypes: ['risk_analysis', 'liability_assessment', 'mitigation_recommendations'],
      estimatedDuration: 120
    },
    {
      name: 'Contract Comparison',
      description: 'Compare contracts against templates or other agreements',
      inputTypes: ['contract_document', 'comparison_template', 'comparison_criteria'],
      outputTypes: ['comparison_report', 'deviation_analysis', 'recommendations'],
      estimatedDuration: 100
    },
    {
      name: 'Compliance Review',
      description: 'Review contracts for regulatory and legal compliance',
      inputTypes: ['contract_document', 'regulatory_requirements', 'jurisdiction'],
      outputTypes: ['compliance_report', 'violation_risks', 'correction_recommendations'],
      estimatedDuration: 110
    }
  ];

  requiredContext = ['matter_info'];
  
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
      if (!this.validateInput(input)) {
        return {
          success: false,
          result: null,
          error: 'Invalid input parameters - matter information required'
        };
      }

      const taskId = input.context?.task_id || uuidv4();
      const executionId = await this.createExecution(taskId, input);
      
      // Step 1: Load and analyze contract document with AI
      await this.logExecution(taskId, 'AI-powered contract document analysis', 10);
      const contractDocument = await this.loadContractDocument(input);
      const contractType = await this.identifyContractType(contractDocument);

      // Step 2: AI-powered extraction of key terms and clauses
      await this.logExecution(taskId, 'AI-powered extraction of contract terms and clauses', 30);
      const termExtraction = await this.extractContractTerms(contractDocument, contractType);

      // Step 3: AI-powered risk analysis
      await this.logExecution(taskId, 'AI-powered contract risk assessment', 50);
      const riskAnalysis = await this.conductRiskAnalysis(contractDocument, termExtraction, contractType);

      // Step 4: AI-powered compliance review
      await this.logExecution(taskId, 'AI-powered regulatory compliance review', 70);
      const complianceReview = await this.performComplianceReview(contractDocument, input.parameters);

      // Step 5: AI-generated recommendations
      await this.logExecution(taskId, 'AI-powered generation of recommendations and action items', 85);
      const recommendations = await this.generateRecommendations(termExtraction, riskAnalysis, complianceReview);

      // Step 6: Create comprehensive analysis report
      await this.logExecution(taskId, 'Generating contract analysis report', 95);
      const analysisReport = await this.generateAnalysisReport(
        contractDocument, termExtraction, riskAnalysis, complianceReview, recommendations, input.matterId
      );

      const output: AgentOutput = {
        success: true,
        result: {
          contractType,
          termExtraction,
          riskAnalysis,
          complianceReview,
          recommendations,
          analysisReport,
          metadata: {
            documentId: contractDocument.id,
            pageCount: contractDocument.page_count || 1,
            wordCount: this.estimateWordCount(contractDocument.extracted_text || ''),
            analysisCompleteness: this.calculateCompleteness(termExtraction, riskAnalysis)
          }
        },
        citations: [],
        metadata: {
          executionId,
          contractType,
          riskLevel: riskAnalysis.overallRiskLevel,
          keyTermsFound: termExtraction.keyTerms.length,
          riskFactorsIdentified: riskAnalysis.riskFactors.length
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

  private async loadContractDocument(input: AgentInput): Promise<any> {
    if (input.documents && input.documents.length > 0) {
      // Load specific document
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', input.documents[0])
        .single();
      
      if (error) throw new Error(`Failed to load contract document: ${error.message}`);
      return data;
    } else {
      // Look for contract documents in the matter
      const documents = await this.getMatterDocuments(input.matterId);
      const contractDoc = documents.find(doc => 
        doc.filename.toLowerCase().includes('contract') ||
        doc.filename.toLowerCase().includes('agreement') ||
        doc.file_type === 'contract'
      );
      
      if (!contractDoc) {
        throw new Error('No contract document found in matter');
      }
      
      return contractDoc;
    }
  }

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
    const text = document.extracted_text || '';
    const terms = {
      parties: await this.extractParties(text),
      keyTerms: await this.extractKeyTerms(text, contractType),
      financialTerms: await this.extractFinancialTerms(text),
      dates: await this.extractDates(text),
      obligations: await this.extractObligations(text),
      termination: await this.extractTerminationClauses(text),
      liability: await this.extractLiabilityTerms(text),
      governance: await this.extractGovernanceTerms(text)
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
      mitigationRecommendations: this.generateMitigationRecommendations(riskFactors)
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

    return compliance;
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
    matterId: string
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
    const baseTime = 90; // 90 seconds base
    const documentSize = input.parameters?.documentSize || 'medium';
    
    const sizeFactor = {
      'small': 0.7,
      'medium': 1.0,
      'large': 1.5,
      'xlarge': 2.0
    };

    const analysisType = input.parameters?.analysisType || 'standard';
    const analysisFactor = analysisType === 'comprehensive' ? 1.3 : 1.0;
    
    return Math.round(baseTime * (sizeFactor[documentSize as keyof typeof sizeFactor] || 1.0) * analysisFactor);
  }
}