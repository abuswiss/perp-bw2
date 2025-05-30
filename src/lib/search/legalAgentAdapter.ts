import { LegalOrchestrator } from '@/lib/orchestrator/LegalOrchestrator';
import { AgentInput } from '@/lib/agents/types';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { Document } from '@langchain/core/documents';

interface StreamEvent {
  type: string;
  data: any;
}

type StreamCallback = (event: StreamEvent) => void;

export class LegalAgentAdapter {
  private orchestrator: LegalOrchestrator;
  private agentType: string;

  constructor(agentType: string) {
    this.agentType = agentType;
    this.orchestrator = new LegalOrchestrator();
  }

  async search(
    query: string,
    history: Array<[string, string]>,
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: string,
    matterId?: string,
    files?: string[],
    onStream?: StreamCallback
  ): Promise<{ response: string; sources: Document[] }> {
    try {
      // Create agent input
      const input: AgentInput = {
        matterId: matterId || 'general',
        query,
        context: {
          history: history.map(([role, content]) => ({ role, content })),
          attachments: files,
        },
        documents: []
      };

      // Stream progress updates
      if (onStream) {
        onStream({
          type: 'progress',
          data: { message: `Starting ${this.agentType} agent...` }
        });
      }

      // Execute agent directly based on type
      const result = await this.orchestrator.executeDirectly(this.agentType, input);

      if (!result.success) {
        throw new Error(result.error || 'Agent execution failed');
      }

      // Format response
      let response = '';
      const sources: Document[] = [];

      if (result.result) {
        // Build response based on agent type
        switch (this.agentType) {
          case 'legalResearch':
            if (result.result.cases) {
              response += '## Case Law Results\\n\\n';
              result.result.cases.forEach((caseItem: any) => {
                response += `### ${caseItem.case_name}\\n`;
                response += `**Citation:** ${caseItem.citation}\\n`;
                response += `**Court:** ${caseItem.court}\\n`;
                if (caseItem.decision_date) {
                  response += `**Date:** ${new Date(caseItem.decision_date).toLocaleDateString()}\\n`;
                }
                response += `\\n${caseItem.summary || 'No summary available.'}\\n\\n`;
                
                sources.push(new Document({
                  pageContent: caseItem.summary || '',
                  metadata: {
                    title: caseItem.case_name,
                    url: caseItem.court_listener_url || '',
                    citation: caseItem.citation,
                  }
                }));
              });
            }
            if (result.result.statutes) {
              response += '\\n## Statutory Law\\n\\n';
              result.result.statutes.forEach((statute: any) => {
                response += `- **${statute.title}**: ${statute.description}\\n`;
              });
            }
            if (result.result.synthesis) {
              response += '\\n## Analysis\\n\\n' + result.result.synthesis;
            }
            break;

          case 'briefWriting':
            if (result.result.outline) {
              response += '## Document Outline\\n\\n';
              response += this.formatOutline(result.result.outline);
              response += '\\n\\n';
            }
            if (result.result.content) {
              response += '## Generated Content\\n\\n';
              response += result.result.content;
            }
            break;

          case 'discovery':
            if (result.result.reviewedDocuments) {
              response += '## Document Review Results\\n\\n';
              result.result.reviewedDocuments.forEach((doc: any) => {
                response += `### ${doc.title}\\n`;
                response += `- **Relevance:** ${doc.relevance}\\n`;
                response += `- **Privilege:** ${doc.privilegeStatus}\\n`;
                if (doc.keyFindings?.length > 0) {
                  response += `- **Key Findings:** ${doc.keyFindings.join(', ')}\\n`;
                }
                response += '\\n';
              });
            }
            if (result.result.summary) {
              response += '\\n## Summary\\n\\n' + result.result.summary;
            }
            break;

          case 'contractAnalysis':
            if (result.result.keyTerms) {
              response += '## Key Terms\\n\\n';
              result.result.keyTerms.forEach((term: any) => {
                response += `- **${term.name}**: ${term.description}\\n`;
              });
            }
            if (result.result.risks) {
              response += '\\n## Identified Risks\\n\\n';
              result.result.risks.forEach((risk: any) => {
                response += `- **${risk.type}** (${risk.severity}): ${risk.description}\\n`;
              });
            }
            if (result.result.recommendations) {
              response += '\\n## Recommendations\\n\\n';
              result.result.recommendations.forEach((rec: string) => {
                response += `- ${rec}\\n`;
              });
            }
            break;

          default:
            response = JSON.stringify(result.result, null, 2);
        }
      }

      // Stream final response
      if (onStream) {
        onStream({
          type: 'response',
          data: { content: response }
        });
      }

      return { response, sources };
    } catch (error) {
      console.error('Legal agent error:', error);
      throw error;
    }
  }

  private formatOutline(outline: any, level = 0): string {
    let result = '';
    const indent = '  '.repeat(level);
    
    if (Array.isArray(outline)) {
      outline.forEach((item, index) => {
        result += `${indent}${index + 1}. ${item}\\n`;
      });
    } else if (typeof outline === 'object') {
      Object.entries(outline).forEach(([key, value]) => {
        result += `${indent}**${key}**\\n`;
        result += this.formatOutline(value, level + 1);
      });
    } else {
      result += `${indent}${outline}\\n`;
    }
    
    return result;
  }
}