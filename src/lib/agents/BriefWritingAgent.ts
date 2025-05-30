import { BaseAgent } from './BaseAgent';
import { AgentInput, AgentOutput, AgentCapability } from './types';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getDefaultChatModel } from '@/lib/providers';
import { v4 as uuidv4 } from 'uuid';

export class BriefWritingAgent extends BaseAgent {
  id = 'brief-writing-agent';
  type = 'writing' as const;
  name = 'Legal Brief Writing Agent';
  description = 'Generate legal documents including memoranda, briefs, and other legal writing';
  
  capabilities: AgentCapability[] = [
    {
      name: 'Legal Memorandum',
      description: 'Generate comprehensive legal memoranda with proper citations',
      inputTypes: ['legal_issue', 'research_data', 'template_type'],
      outputTypes: ['formatted_memo', 'citations', 'outline'],
      estimatedDuration: 120
    },
    {
      name: 'Motion Drafting',
      description: 'Draft motions for various legal proceedings',
      inputTypes: ['motion_type', 'facts', 'legal_authority'],
      outputTypes: ['motion_document', 'supporting_brief', 'citations'],
      estimatedDuration: 150
    },
    {
      name: 'Contract Analysis Report',
      description: 'Generate analysis reports for contract review',
      inputTypes: ['contract_text', 'analysis_type', 'risk_factors'],
      outputTypes: ['analysis_report', 'risk_assessment', 'recommendations'],
      estimatedDuration: 90
    },
    {
      name: 'Discovery Response',
      description: 'Draft responses to discovery requests',
      inputTypes: ['discovery_requests', 'document_list', 'objection_basis'],
      outputTypes: ['response_document', 'privilege_log', 'objections'],
      estimatedDuration: 180
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
        (this.llm as any).temperature = 0.3; // Balanced creativity and consistency for legal writing
      }
    } catch (error) {
      console.error('Failed to initialize LLM for BriefWritingAgent:', error);
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
      
      // Check for recent research results that could inform the brief
      await this.logExecution(taskId, 'Checking for relevant research and cached materials', 5);
      const relevantResearch = await this.getCachedResults(input.matterId, {
        resultTypes: ['legal_research', 'case_research', 'contract_analysis'],
        maxAgeHours: 48, // Research from last 2 days is relevant
        limit: 10
      });
      
      let researchContext = null;
      if (relevantResearch.length > 0) {
        const relevantResults = this.assessCacheRelevance(relevantResearch, input.query);
        const highRelevanceResults = relevantResults.filter(r => r.relevanceScore > 0.3);
        
        if (highRelevanceResults.length > 0) {
          console.log(`💡 Using ${highRelevanceResults.length} relevant research results for brief writing`);
          researchContext = {
            hasResearch: true,
            researchCount: highRelevanceResults.length,
            researchSummary: highRelevanceResults.map(r => ({
              title: r.title,
              summary: r.summary,
              relevanceScore: r.relevanceScore,
              caseCount: r.metadata?.sourceCount || 0
            }))
          };
        }
      }
      
      // Step 1: Analyze document type and requirements using AI
      await this.logExecution(taskId, 'Analyzing document requirements', 10);
      const documentType = await this.determineDocumentTypeWithAI(input.query, input.parameters);
      const template = await this.selectTemplate(documentType, input.parameters);

      // Step 2: Gather and organize source material
      await this.logExecution(taskId, 'Gathering source materials', 25);
      const sourceMaterial = await this.gatherSourceMaterial(input);

      // Step 3: Create document outline using AI
      await this.logExecution(taskId, 'Creating document outline', 40);
      const outline = await this.createOutlineWithAI(documentType, sourceMaterial, input.query);

      // Step 4: Generate document content using AI
      await this.logExecution(taskId, 'Generating document content', 70);
      const content = await this.generateContentWithAI(outline, sourceMaterial, template);

      // Step 5: Format and review
      await this.logExecution(taskId, 'Formatting and reviewing document', 90);
      const formattedDocument = await this.formatDocument(content, documentType);
      const citations = await this.extractCitations(formattedDocument);

      const output: AgentOutput = {
        success: true,
        result: {
          documentType,
          outline,
          content: formattedDocument,
          sourceMaterial,
          metadata: {
            wordCount: this.countWords(formattedDocument),
            pageCount: Math.ceil(this.countWords(formattedDocument) / 250),
            citationCount: citations.length,
            template: template.name
          }
        },
        citations,
        metadata: {
          executionId,
          documentType,
          templateUsed: template.name
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

  private async determineDocumentTypeWithAI(query: string, parameters?: Record<string, any>): Promise<string> {
    if (parameters?.documentType) {
      return parameters.documentType;
    }

    if (!this.llm) {
      return this.determineDocumentTypeBasic(query);
    }

    const docTypePrompt = PromptTemplate.fromTemplate(`
Analyze this legal writing request and determine the most appropriate document type.

Request: {query}

Choose from these document types:
- legal_memorandum: Internal analysis memos
- motion: Court motions and filings
- legal_brief: Appellate or trial briefs
- contract_analysis: Contract review reports
- discovery_response: Discovery responses and objections
- opinion_letter: Legal opinion letters to clients

Return only the document type identifier.`);

    try {
      const chain = docTypePrompt.pipe(this.llm).pipe(this.strParser);
      const result = await chain.invoke({ query });
      const docType = result.trim();
      
      // Validate the result
      const validTypes = ['legal_memorandum', 'motion', 'legal_brief', 'contract_analysis', 'discovery_response', 'opinion_letter'];
      return validTypes.includes(docType) ? docType : 'legal_memorandum';
    } catch (error) {
      console.error('AI document type determination failed:', error);
      return this.determineDocumentTypeBasic(query);
    }
  }

  private determineDocumentTypeBasic(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('memorandum') || lowerQuery.includes('memo')) {
      return 'legal_memorandum';
    } else if (lowerQuery.includes('motion')) {
      return 'motion';
    } else if (lowerQuery.includes('brief')) {
      return 'legal_brief';
    } else if (lowerQuery.includes('contract') && lowerQuery.includes('analysis')) {
      return 'contract_analysis';
    } else if (lowerQuery.includes('discovery')) {
      return 'discovery_response';
    } else if (lowerQuery.includes('opinion') || lowerQuery.includes('letter')) {
      return 'opinion_letter';
    } else {
      return 'legal_memorandum'; // Default
    }
  }

  private async selectTemplate(documentType: string, parameters?: Record<string, any>): Promise<any> {
    const templates = {
      legal_memorandum: {
        name: 'Legal Memorandum',
        sections: [
          'Header',
          'Question Presented',
          'Brief Answer',
          'Statement of Facts',
          'Discussion',
          'Conclusion'
        ],
        style: 'formal_legal'
      },
      motion: {
        name: 'Motion Template',
        sections: [
          'Caption',
          'Introduction',
          'Statement of Facts',
          'Argument',
          'Conclusion',
          'Certificate of Service'
        ],
        style: 'court_filing'
      },
      legal_brief: {
        name: 'Legal Brief',
        sections: [
          'Table of Contents',
          'Table of Authorities',
          'Statement of Issues',
          'Statement of Facts',
          'Argument',
          'Conclusion'
        ],
        style: 'appellate_brief'
      },
      contract_analysis: {
        name: 'Contract Analysis Report',
        sections: [
          'Executive Summary',
          'Contract Overview',
          'Key Terms Analysis',
          'Risk Assessment',
          'Recommendations',
          'Appendices'
        ],
        style: 'business_report'
      },
      discovery_response: {
        name: 'Discovery Response',
        sections: [
          'Preliminary Statement',
          'General Objections',
          'Responses to Requests',
          'Privilege Log',
          'Certificate of Service'
        ],
        style: 'litigation_document'
      },
      opinion_letter: {
        name: 'Opinion Letter',
        sections: [
          'Introduction',
          'Executive Summary',
          'Legal Analysis',
          'Conclusion and Recommendations',
          'Limitations and Assumptions'
        ],
        style: 'professional_opinion'
      }
    };

    return templates[documentType as keyof typeof templates] || templates.legal_memorandum;
  }

  private async gatherSourceMaterial(input: AgentInput): Promise<any> {
    const sources = {
      matterDocuments: [] as any[],
      researchResults: [] as any[],
      caseNotes: [] as any[],
      statutes: [] as any[]
    };

    try {
      // Gather matter documents
      const documents = await this.getMatterDocuments(input.matterId);
      sources.matterDocuments = documents;

      // Extract any research data from input
      if (input.parameters?.researchData) {
        sources.researchResults = input.parameters.researchData;
      }

      // Get case citations from matter research history
      const { data: citations } = await this.supabase
        .from('case_citations')
        .select('*')
        .limit(20);
      
      sources.caseNotes = citations || [];

      return sources;
    } catch (error) {
      console.error('Failed to gather source material:', error);
      return sources;
    }
  }

  private async createOutlineWithAI(
    documentType: string,
    sourceMaterial: any,
    query: string
  ): Promise<any> {
    if (!this.llm) {
      return this.createOutlineBasic(documentType, sourceMaterial, query);
    }

    const outlinePrompt = PromptTemplate.fromTemplate(`
Create a detailed outline for a {documentType} based on the following request and available source material.

Request: {query}
Document Type: {documentType}
Available Sources: {sourceSummary}

Generate a JSON outline with:
{{
  "title": "Professional document title",
  "sections": [
    {{
      "title": "Section name",
      "description": "What this section should cover",
      "keyPoints": ["list of key points to address"],
      "wordTarget": estimated_word_count
    }}
  ],
  "totalWordTarget": total_estimated_words,
  "approach": "Brief description of the writing approach"
}}

Make this appropriate for professional legal writing with proper structure and organization.`);

    try {
      const sourceSummary = this.summarizeSourceMaterial(sourceMaterial);
      const chain = outlinePrompt.pipe(this.llm).pipe(this.strParser);
      const result = await chain.invoke({ 
        query, 
        documentType, 
        sourceSummary 
      });
      
      const cleanResult = result.replace(/```json\n?|```/g, '').trim();
      const aiOutline = JSON.parse(cleanResult);
      
      return {
        documentType,
        title: aiOutline.title,
        sections: aiOutline.sections,
        totalWordTarget: aiOutline.totalWordTarget,
        approach: aiOutline.approach,
        style: this.getDocumentStyle(documentType)
      };
    } catch (error) {
      console.error('AI outline creation failed:', error);
      return this.createOutlineBasic(documentType, sourceMaterial, query);
    }
  }

  private createOutlineBasic(
    documentType: string,
    sourceMaterial: any,
    query: string
  ): any {
    const template = this.selectTemplateSync(documentType);
    
    return {
      documentType,
      title: this.generateTitle(query, documentType),
      sections: template.sections.map((section: string) => ({
        title: section,
        description: `Content for ${section}`,
        keyPoints: [],
        wordTarget: this.getSectionWordCount(section, documentType)
      })),
      totalWordTarget: template.sections.length * 200,
      style: template.style
    };
  }

  private summarizeSourceMaterial(sourceMaterial: any): string {
    const summary = [];
    
    if (sourceMaterial.matterDocuments?.length > 0) {
      summary.push(`${sourceMaterial.matterDocuments.length} matter documents`);
    }
    
    if (sourceMaterial.researchResults?.length > 0) {
      summary.push(`${sourceMaterial.researchResults.length} research results`);
    }
    
    if (sourceMaterial.caseNotes?.length > 0) {
      summary.push(`${sourceMaterial.caseNotes.length} case citations`);
    }
    
    return summary.length > 0 ? summary.join(', ') : 'No source material available';
  }

  private getDocumentStyle(documentType: string): string {
    const styles = {
      'legal_memorandum': 'formal_legal',
      'motion': 'court_filing',
      'legal_brief': 'appellate_brief',
      'contract_analysis': 'business_report',
      'discovery_response': 'litigation_document',
      'opinion_letter': 'professional_opinion'
    };
    
    return styles[documentType as keyof typeof styles] || 'formal_legal';
  }

  private selectTemplateSync(documentType: string): any {
    const templates = {
      legal_memorandum: {
        name: 'Legal Memorandum',
        sections: ['Header', 'Question Presented', 'Brief Answer', 'Statement of Facts', 'Discussion', 'Conclusion'],
        style: 'formal_legal'
      },
      motion: {
        name: 'Motion Template',
        sections: ['Caption', 'Introduction', 'Statement of Facts', 'Argument', 'Conclusion', 'Certificate of Service'],
        style: 'court_filing'
      }
      // Add other templates as needed
    };
    
    return templates[documentType as keyof typeof templates] || templates.legal_memorandum;
  }

  private generateTitle(query: string, documentType: string): string {
    const matter = query.includes('matter') ? query.split('matter')[0].trim() : 'Legal Matter';
    
    switch (documentType) {
      case 'legal_memorandum':
        return `Legal Memorandum: ${query}`;
      case 'motion':
        return `Motion ${query}`;
      case 'legal_brief':
        return `Brief in Support of ${query}`;
      case 'contract_analysis':
        return `Contract Analysis: ${query}`;
      case 'discovery_response':
        return `Response to Discovery Requests: ${matter}`;
      case 'opinion_letter':
        return `Legal Opinion: ${query}`;
      default:
        return `Legal Document: ${query}`;
    }
  }

  private generateSectionPlaceholder(
    section: string,
    sourceMaterial: any,
    query: string
  ): string {
    const placeholders = {
      'Header': `TO: [Client Name]\nFROM: [Attorney Name]\nDATE: ${new Date().toLocaleDateString()}\nRE: ${query}`,
      'Question Presented': `The question presented is: ${query}`,
      'Brief Answer': `Brief answer to be developed based on research findings.`,
      'Statement of Facts': `[Statement of relevant facts based on matter documents]`,
      'Discussion': `[Legal analysis incorporating case law and statutory authority]`,
      'Conclusion': `[Conclusion and recommendations based on analysis]`,
      'Introduction': `This document addresses: ${query}`,
      'Executive Summary': `This analysis examines: ${query}`,
      'Argument': `[Legal argument supporting position]`,
      'Key Terms Analysis': `[Analysis of contract terms and provisions]`,
      'Risk Assessment': `[Identification and evaluation of legal risks]`,
      'Recommendations': `[Specific recommendations for action]`
    };

    return placeholders[section as keyof typeof placeholders] || `[${section} content to be developed]`;
  }

  private getSectionWordCount(section: string, documentType: string): number {
    const wordCounts = {
      'Header': 50,
      'Question Presented': 100,
      'Brief Answer': 150,
      'Statement of Facts': 300,
      'Discussion': 800,
      'Conclusion': 200,
      'Introduction': 200,
      'Executive Summary': 250,
      'Argument': 600,
      'Legal Analysis': 700,
      'Risk Assessment': 400,
      'Recommendations': 300
    };

    return wordCounts[section as keyof typeof wordCounts] || 250;
  }

  private async generateContentWithAI(
    outline: any,
    sourceMaterial: any,
    template: any
  ): Promise<string> {
    if (!this.llm) {
      return this.generateContentBasic(outline, sourceMaterial, template);
    }

    let content = `# ${outline.title}\n\n`;
    
    for (const section of outline.sections) {
      content += `## ${section.title}\n\n`;
      
      const sectionContent = await this.generateSectionContentWithAI(
        section, 
        sourceMaterial, 
        outline.documentType,
        outline.title
      );
      
      content += sectionContent;
      content += '\n\n';
    }

    return content;
  }

  private async generateSectionContentWithAI(
    section: any,
    sourceMaterial: any,
    documentType: string,
    documentTitle: string
  ): Promise<string> {
    if (!this.llm) {
      return this.generateSectionContentBasic(section, sourceMaterial, documentType);
    }

    const sectionPrompt = PromptTemplate.fromTemplate(`
You are a skilled legal writer. Generate professional content for this section of a {documentType}.

Document Title: {documentTitle}
Section: {sectionTitle}
Section Description: {sectionDescription}
Key Points to Address: {keyPoints}
Target Word Count: {wordTarget}

Available Source Material:
{sourceMaterial}

Write professional, well-structured content for this section. Use proper legal writing style with:
- Clear, concise language
- Logical organization
- Appropriate citations where relevant
- Professional tone

Do not include section headers in your response - just the content.`);

    try {
      const chain = sectionPrompt.pipe(this.llm).pipe(this.strParser);
      const result = await chain.invoke({
        documentType,
        documentTitle,
        sectionTitle: section.title,
        sectionDescription: section.description || 'General content for this section',
        keyPoints: section.keyPoints?.join(', ') || 'Standard legal analysis',
        wordTarget: section.wordTarget || 200,
        sourceMaterial: this.formatSourceMaterialForPrompt(sourceMaterial)
      });
      
      return result.trim();
    } catch (error) {
      console.error('AI section content generation failed:', error);
      return this.generateSectionContentBasic(section, sourceMaterial, documentType);
    }
  }

  private formatSourceMaterialForPrompt(sourceMaterial: any): string {
    const formatted = [];
    
    if (sourceMaterial.matterDocuments?.length > 0) {
      formatted.push('Matter Documents:');
      sourceMaterial.matterDocuments.slice(0, 3).forEach((doc: any, i: number) => {
        formatted.push(`${i + 1}. ${doc.filename}: ${doc.extracted_text?.substring(0, 200) || 'No content available'}...`);
      });
    }
    
    if (sourceMaterial.caseNotes?.length > 0) {
      formatted.push('\nRelevant Cases:');
      sourceMaterial.caseNotes.slice(0, 5).forEach((citation: any, i: number) => {
        formatted.push(`${i + 1}. ${citation.case_name}, ${citation.citation}`);
      });
    }
    
    if (sourceMaterial.researchResults?.length > 0) {
      formatted.push('\nResearch Results:');
      formatted.push(JSON.stringify(sourceMaterial.researchResults).substring(0, 500) + '...');
    }
    
    return formatted.length > 0 ? formatted.join('\n') : 'No specific source material available.';
  }

  private generateContentBasic(
    outline: any,
    sourceMaterial: any,
    template: any
  ): string {
    let content = `# ${outline.title}\n\n`;
    
    for (const section of outline.sections) {
      content += `## ${section.title}\n\n`;
      content += this.generateSectionContentBasic(section, sourceMaterial, outline.documentType);
      content += '\n\n';
    }

    return content;
  }

  private generateSectionContentBasic(
    section: any,
    sourceMaterial: any,
    documentType: string
  ): string {
    let content = section.description || `Content for ${section.title}`;

    // Enhance content based on available source material
    if (section.title === 'Statement of Facts' && sourceMaterial.matterDocuments?.length > 0) {
      content += `\n\nBased on the matter documents, the following facts are relevant:`;
      sourceMaterial.matterDocuments.slice(0, 3).forEach((doc: any, index: number) => {
        content += `\n${index + 1}. Document: ${doc.filename}`;
      });
    }

    if (section.title === 'Discussion' && sourceMaterial.caseNotes?.length > 0) {
      content += `\n\nRelevant case law includes:`;
      sourceMaterial.caseNotes.slice(0, 5).forEach((citation: any) => {
        content += `\n- ${citation.case_name}, ${citation.citation} (${citation.court})`;
      });
    }

    return content;
  }

  private async formatDocument(content: string, documentType: string): Promise<string> {
    // Add proper legal formatting
    let formatted = content;

    // Add page numbers and headers for court documents
    if (documentType === 'motion' || documentType === 'legal_brief') {
      formatted = this.addCourtFormatting(formatted);
    }

    // Add professional letterhead for opinions and memos
    if (documentType === 'opinion_letter' || documentType === 'legal_memorandum') {
      formatted = this.addProfessionalFormatting(formatted);
    }

    return formatted;
  }

  private addCourtFormatting(content: string): string {
    const header = `
[CAPTION]
[COURT NAME]
[CASE NUMBER]

`;
    return header + content + `

Respectfully submitted,

[Attorney Name]
[Attorney Title]
[Law Firm]
[Contact Information]
`;
  }

  private addProfessionalFormatting(content: string): string {
    return `[LAW FIRM LETTERHEAD]

${content}

---
This document is prepared for informational purposes and does not constitute legal advice.
`;
  }

  private async extractCitations(document: string): Promise<any[]> {
    const citations = [];
    const citationPattern = /([A-Z][^,]+),\s*(\d+\s+[A-Z][^,]+\s+\d+)/g;
    let match;

    while ((match = citationPattern.exec(document)) !== null) {
      citations.push({
        id: `cite-${citations.length}`,
        type: 'case',
        title: match[1].trim(),
        citation: match[2].trim()
      });
    }

    return citations;
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  estimateDuration(input: AgentInput): number {
    const documentType = this.determineDocumentTypeBasic(input.query);
    const baseTime = {
      'legal_memorandum': 120,
      'motion': 150,
      'legal_brief': 180,
      'contract_analysis': 90,
      'discovery_response': 180,
      'opinion_letter': 100
    };

    const complexityFactor = input.query.length > 200 ? 1.5 : 1.0;
    const documentFactor = (input.documents?.length || 0) * 0.1;
    
    return Math.round((baseTime[documentType as keyof typeof baseTime] || 120) * complexityFactor * (1 + documentFactor));
  }
}