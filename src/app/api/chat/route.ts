import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { searchHandlers } from '@/lib/search';
import { supabaseAdmin } from '@/lib/supabase/client';
import { LegalOrchestrator } from '@/lib/orchestrator/LegalOrchestrator';
import { AgentInput } from '@/lib/agents/types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatAgentResponse(agentType: string, data: any): { response: string; sources: any[]; taskId?: string } {
  let response = '';
  const sources: any[] = [];
  
  console.log('🎨 Formatting agent response for type:', agentType);
  console.log('📋 Data keys:', Object.keys(data || {}));

  switch (agentType) {
    case 'legalResearch':
      // Handle new simplified format with direct response
      if (data?.response && typeof data.response === 'string') {
        response = data.response;
        
        // Add sources from the simplified format
        console.log('📊 Total sources found:', data.sources?.length || 0);
        if (data.sources && Array.isArray(data.sources)) {
          console.log('📄 First few sources:', data.sources.slice(0, 3).map((s: any) => ({ 
            title: s.metadata?.title || s.title, 
            type: s.metadata?.type || 'unknown',
            url: s.metadata?.url || s.url 
          })));
          
          data.sources.forEach((source: any) => {
            const sourceData = {
              title: source.metadata?.title || source.title || 'Unknown Source',
              url: source.metadata?.url || source.url || '',
              citation: source.metadata?.citation || source.citation || '',
              court: source.metadata?.court || source.court || '',
              date: source.metadata?.date || source.date || '',
              type: source.metadata?.type || 'web',
              case_name: source.metadata?.title || source.title, // For legal case compatibility
              precedential_status: source.metadata?.precedentialStatus
            };
            sources.push(sourceData);
          });
        }
      }
      // Fallback: Handle old complex format from AI synthesis
      else if (data?.synthesis && typeof data.synthesis === 'object') {
        const synthesis = data.synthesis;
        
        // Executive Summary
        if (synthesis.executiveSummary) {
          response += `## Executive Summary\n\n${synthesis.executiveSummary}\n\n`;
        }
        
        // Primary Authorities
        if (synthesis.primaryAuthorities && synthesis.primaryAuthorities.length > 0) {
          response += `## Primary Legal Authorities\n\n`;
          synthesis.primaryAuthorities.forEach((auth: any) => {
            response += `### ${auth.title}\n`;
            response += `**Citation:** ${auth.citation}\n`;
            response += `**Type:** ${auth.type}\n`;
            response += `**Key Holding:** ${auth.keyHolding}\n`;
            response += `**Significance:** ${auth.significance}\n\n`;
            
            sources.push({
              title: auth.title,
              url: auth.url || '',
              citation: auth.citation,
              type: auth.type
            });
          });
        }
        
        // Key Distinctions
        if (synthesis.distinctions) {
          response += `## Key Legal Distinctions\n\n${synthesis.distinctions}\n\n`;
        }
        
        // Legal Analysis
        if (synthesis.legalAnalysis) {
          response += `## Detailed Legal Analysis\n\n${synthesis.legalAnalysis}\n\n`;
        }
        
        // Practical Guidance
        if (synthesis.practicalGuidance) {
          response += `## Practical Guidance for Practitioners\n\n${synthesis.practicalGuidance}\n\n`;
        }
        
        // Jurisdictional Notes
        if (synthesis.jurisdictionalNotes) {
          response += `## Jurisdictional Considerations\n\n${synthesis.jurisdictionalNotes}\n\n`;
        }
        
        // Research Gaps & Recommendations
        if (synthesis.gaps && synthesis.gaps.length > 0) {
          response += `## Areas for Further Research\n\n`;
          synthesis.gaps.forEach((gap: string) => {
            response += `- ${gap}\n`;
          });
          response += '\n';
        }
        
        if (synthesis.recommendations && Array.isArray(synthesis.recommendations) && synthesis.recommendations.length > 0) {
          response += `## Recommendations\n\n`;
          synthesis.recommendations.forEach((rec: string) => {
            response += `- ${rec}\n`;
          });
          response += '\n';
        }
        
        // Add case results to sources only (not response body)
        if (data.caseResults && data.caseResults.cases && data.caseResults.cases.length > 0) {
          data.caseResults.cases.forEach((caseItem: any) => {
            // Ensure URL always points to CourtListener website
            let url = caseItem.absolute_url || caseItem.url || '';
            if (url && !url.startsWith('http')) {
              url = `https://www.courtlistener.com${url}`;
            } else if (!url) {
              url = ''; // Don't construct URL if we don't have absolute_url
            }
            
            sources.push({
              title: caseItem.case_name || caseItem.title,
              url: url,
              citation: caseItem.citation || '',
              type: 'case'
            });
          });
        }
        
        // Add statute results to sources only (not response body)
        if (data.statuteResults && data.statuteResults.statutes && data.statuteResults.statutes.length > 0) {
          data.statuteResults.statutes.forEach((statute: any) => {
            sources.push({
              title: statute.title,
              url: statute.url || '',
              type: 'statute'
            });
          });
        }
        
      } else {
        // Fallback to old format handling
        if (data?.caseResults && data.caseResults.length > 0) {
          response += '## Case Law Results\n\n';
          data.caseResults.forEach((caseItem: any) => {
            response += `### ${caseItem.case_name || caseItem.title}\n`;
            response += `**Citation:** ${caseItem.citation}\n`;
            response += `**Court:** ${caseItem.court}\n`;
            if (caseItem.date) {
              response += `**Date:** ${new Date(caseItem.date).toLocaleDateString()}\n`;
            }
            response += `\n${caseItem.summary || 'No summary available.'}\n\n`;
            
            // Ensure URL always points to CourtListener website
            let url = caseItem.url || '';
            if (url && !url.startsWith('http')) {
              url = `https://www.courtlistener.com${url}`;
            } else if (!url) {
              url = ''; // Don't construct URL if we don't have absolute_url
            }
            
            sources.push({
              title: caseItem.case_name || caseItem.title,
              url: url,
              citation: caseItem.citation,
            });
          });
        }
      }
      
      // Handle synthesis as string
      if (!response && data?.synthesis && typeof data.synthesis === 'string') {
        response += '\n## Legal Analysis\n\n' + data.synthesis;
      }
      
      // If no specific data, provide summary from report
      if (!response && data?.report) {
        response += '## Research Summary\n\n' + data.report;
      }
      
      // Fallback to showing available data
      if (!response) {
        response += '## Research Completed\n\n';
        response += `Completed legal research on: "${data?.query || 'your question'}"\n\n`;
        if (data?.legalConcepts && data.legalConcepts.length > 0) {
          response += `**Key Legal Concepts:** ${data.legalConcepts.join(', ')}\n\n`;
        }
        response += 'The research has been completed successfully. ';
        response += 'Results may include case law analysis, statutory research, and legal synthesis based on your query.';
      }
      break;

    case 'briefWriting':
      // Only show the generated document content, not the outline details
      if (data?.content) {
        response = data.content; // Use assignment instead of += to avoid duplication
      } else if (data?.outline && data?.outline.content) {
        response = data.outline.content;
      } else {
        response = 'Document generated successfully. Please check the document content above.';
      }
      break;

    case 'discovery':
      if (data?.reviewedDocuments) {
        response += '## Document Review Results\n\n';
        data.reviewedDocuments.forEach((doc: any) => {
          response += `### ${doc.title}\n`;
          response += `- **Relevance:** ${doc.relevance}\n`;
          response += `- **Privilege:** ${doc.privilegeStatus}\n`;
          if (doc.keyFindings?.length > 0) {
            response += `- **Key Findings:** ${doc.keyFindings.join(', ')}\n`;
          }
          response += '\n';
        });
      }
      if (data?.summary) {
        response += '\n## Summary\n\n' + data.summary;
      }
      break;

    case 'contractAnalysis':
      if (data?.analysis) {
        response = data.analysis;
      } else if (data?.result?.analysis) {
        response = data.result.analysis;
      } else {
        response = JSON.stringify(data, null, 2);
      }
      
      if (data?.documentInfo || data?.result?.documentInfo) {
        const docInfo = data?.documentInfo || data?.result?.documentInfo;
        response += `\n\n---\n_Document: ${docInfo.filename} (${docInfo.wordCount} words)_`;
      }
      break;

    case 'legalTimeline':
      if (data?.timeline) {
        const timeline = data.timeline;
        
        // Create a more visually appealing timeline response
        // Executive Summary in a card format
        response += `## 📊 Executive Summary\n\n`;
        response += `| Aspect | Details |\n`;
        response += `|--------|----------|\n`;
        response += `| **Case Type** | ${timeline.summary.caseType} |\n`;
        response += `| **Duration** | ${timeline.summary.estimatedDuration} |\n`;
        response += `| **Cost Range** | ${timeline.summary.totalCostRange} |\n`;
        response += `| **Assessment** | ${timeline.summary.strengthAssessment} |\n`;
        response += `| **Recommendation** | ${timeline.summary.primaryRecommendation} |\n\n`;
        
        // Timeline Phases with visual indicators
        response += `## ⏱️ Litigation Timeline\n\n`;
        timeline.phases.forEach((phase: any, index: number) => {
          const progressBar = '▓'.repeat(Math.min(10, Math.round(phase.settlementProbability * 10)));
          const emptyBar = '░'.repeat(10 - progressBar.length);
          
          response += `### ${index + 1}. ${phase.name}\n\n`;
          response += `**⏰ Duration:** ${phase.duration.typical} ${phase.duration.unit}  \n`;
          response += `**💰 Cost:** $${phase.costRange.min.toLocaleString()} - $${phase.costRange.max.toLocaleString()}  \n`;
          response += `**🤝 Settlement Probability:** ${Math.round(phase.settlementProbability * 100)}% ${progressBar}${emptyBar}\n\n`;
          response += `${phase.description}\n\n`;
          
          if (phase.keyActions.length > 0) {
            response += `**🎯 Key Actions:**\n`;
            phase.keyActions.forEach((action: any) => {
              response += `- ✅ **${action.title}:** ${action.description}\n`;
            });
            response += '\n';
          }
          
          response += '---\n\n';
        });
        
        // Next Steps with priority indicators
        if (timeline.nextSteps?.immediate.length > 0) {
          response += `## 🚀 Immediate Next Steps\n\n`;
          timeline.nextSteps.immediate.forEach((action: any, index: number) => {
            const priorityIcon = action.priority === 'immediate' ? '🔴' : 
                               action.priority === 'short_term' ? '🟡' : '🟢';
            response += `${index + 1}. ${priorityIcon} **${action.title}**  \n`;
            response += `   ${action.description}\n\n`;
          });
        }
        
        // Alternative Options with icons
        if (timeline.alternativeDisputes?.length > 0) {
          response += `## ⚖️ Alternative Resolution Options\n\n`;
          timeline.alternativeDisputes.forEach((option: any) => {
            const typeIcon = option.type === 'mediation' ? '🤝' : 
                           option.type === 'arbitration' ? '⚖️' : '💬';
            response += `### ${typeIcon} ${option.type.charAt(0).toUpperCase() + option.type.slice(1)}\n`;
            response += `- **Description:** ${option.description}\n`;
            response += `- **Cost:** ${option.estimatedCost}\n`;
            response += `- **Duration:** ${option.estimatedDuration}\n`;
            response += `- **Success Rate:** ${Math.round(option.successRate * 100)}%\n\n`;
          });
        }
        
        // Critical Deadlines with warning styling
        if (timeline.criticalDeadlines?.length > 0) {
          response += `## ⚠️ Critical Deadlines\n\n`;
          response += `> **⏰ Time-sensitive actions requiring immediate attention:**\n\n`;
          timeline.criticalDeadlines.forEach((deadline: any) => {
            if (deadline.isCritical) {
              const urgency = deadline.daysFromNow <= 30 ? '🔴 URGENT' : 
                            deadline.daysFromNow <= 90 ? '🟡 IMPORTANT' : '🟢 UPCOMING';
              response += `- ${urgency} **${deadline.description}:** ${deadline.daysFromNow} days remaining\n`;
            }
          });
          response += '\n';
        }
        
        response += `---\n\n`;
        response += `*💡 This timeline is customized based on your case type, complexity, and jurisdiction. Actual timelines may vary depending on court schedules, case developments, and settlement opportunities.*`;
        
      } else {
        response = '⚖️ **Timeline Analysis Complete** - A comprehensive litigation timeline has been generated based on your case description.';
      }
      break;

    case 'documentAnalysis':
      // Handle document analysis agent response
      if (typeof data === 'string') {
        // Check if it's the special interactive format
        if (data.includes('||DOC_DATA_START||')) {
          response = data; // Pass through the special format
        } else {
          response = data;
        }
      } else if (data?.analysis) {
        response = data.analysis;
        
        // Add document info if available
        if (data.documentInfo) {
          response += `\n\n---\n**Document:** ${data.documentInfo.filename}\n`;
          response += `**Type:** ${data.documentInfo.type || 'Legal Document'}\n`;
          response += `**Word Count:** ${data.documentInfo.wordCount?.toLocaleString() || 'Unknown'}\n`;
        }
        
        // Add highlights info if available
        if (data.highlights && data.highlights.length > 0) {
          response += `\n**Highlights:** ${data.highlights.length} reference${data.highlights.length !== 1 ? 's' : ''} identified\n`;
        }
      } else {
        response = '📄 **Document Analysis Complete** - The document has been analyzed successfully.';
      }
      break;


    default:
      response = JSON.stringify(data, null, 2);
  }

  return { response, sources };
}

function formatOutline(outline: any, level = 0): string {
  let result = '';
  const indent = '  '.repeat(level);
  
  if (Array.isArray(outline)) {
    outline.forEach((item, index) => {
      result += `${indent}${index + 1}. ${item}\n`;
    });
  } else if (typeof outline === 'object') {
    Object.entries(outline).forEach(([key, value]) => {
      result += `${indent}**${key}**\n`;
      result += formatOutline(value, level + 1);
    });
  } else {
    result += `${indent}${outline}\n`;
  }
  
  return result;
}

type Message = {
  messageId: string;
  chatId: string;
  content: string;
};

type Body = {
  message: Message;
  optimizationMode: 'speed' | 'balanced' | 'quality';
  focusMode: string;
  history: Array<[string, string]>;
  files: Array<string>;
  chatModel: any;
  embeddingModel: any;
  systemInstructions: string;
  matterId?: string;
};

export async function POST(req: NextRequest) {
  console.log('🔥 Chat API called');
  try {
    const body: Body = await req.json();
    console.log('📊 Request body:', JSON.stringify(body, null, 2));
    const {
      message,
      optimizationMode,
      focusMode,
      history,
      files,
      chatModel,
      embeddingModel,
      systemInstructions,
      matterId
    } = body;

    // Check if chat exists in Supabase
    const { data: existingChat } = await supabaseAdmin
      .from('legal_chats')
      .select('id')
      .eq('id', message.chatId)
      .single();

    if (!existingChat) {
      // Create new chat in Supabase
      await supabaseAdmin
        .from('legal_chats')
        .insert({
          id: message.chatId,
          title: message.content.slice(0, 50) || 'New Legal Research Session',
          focus_mode: focusMode,
          matter_id: matterId,
          context_documents: files,
          created_at: new Date().toISOString(),
        });
    }

    // Store user message in Supabase
    await supabaseAdmin.from('legal_messages').insert({
      chat_id: message.chatId,
      message_id: message.messageId,
      role: 'user',
      content: message.content,
      metadata: {
        createdAt: new Date(),
        focusMode,
        matterId,
      },
    });

    let result: { response: string; sources: any[]; taskId?: string; legalTask?: any; orchestrator?: any; emitter?: any };
    
    // Check if this is a legal focus mode (uses LegalOrchestrator)
    const legalModes = ['legalResearch', 'briefWriting', 'discovery', 'contractAnalysis', 'legalTimeline', 'documentAnalysis'];
    console.log('🤖 Focus mode:', focusMode, 'Is legal?', legalModes.includes(focusMode));
    
    if (legalModes.includes(focusMode)) {
      console.log('⚖️ Using LegalOrchestrator');
      // Use LegalOrchestrator for legal agents
      const orchestrator = new LegalOrchestrator(chatModel);
      console.log('✅ LegalOrchestrator created');
      
      // Load matter documents if matterId is provided
      let matterDocuments: any[] = [];
      if (matterId) {
        const { data: docs } = await supabaseAdmin
          .from('documents')
          .select('id, filename, content, document_type, metadata')
          .eq('matter_id', matterId);
        
        matterDocuments = docs || [];
      }
      
      // Prepare agent input
      const agentInput: AgentInput = {
        matterId: matterId || null,
        query: message.content,
        context: {
          history: history.map(([role, content]) => ({ role, content })),
          attachments: files || [],
          fileIds: files || [],
          matterDocuments: matterDocuments.map(doc => ({
            id: doc.id,
            name: doc.filename,
            type: doc.document_type,
            content: doc.content,
          })),
        },
        documents: matterDocuments,
        parameters: {
          fileIds: files || [],
          matterId: matterId || null,
        }
      };
      
      // Map focus mode to agent type
      const agentTypeMap: Record<string, string> = {
        'legalResearch': 'research',
        'briefWriting': 'brief-writing',
        'discovery': 'discovery',
        'contractAnalysis': 'contract',
        'legalTimeline': 'timeline',
        'documentAnalysis': 'document-analysis'
      };
      
      const agentType = agentTypeMap[focusMode];
      if (!agentType) {
        throw new Error(`Invalid focus mode: ${focusMode}`);
      }
      
      // Create task for legal agent execution
      console.log('🚀 Creating task for agent:', agentType, 'for focus mode:', focusMode);
      const task = await orchestrator.createSimpleTask(
        matterId || null, 
        agentType, 
        message.content,
        agentInput.parameters
      );
      console.log('📋 Task created:', task.id);
      
      // Set up streaming for legal agents
      result = {
        response: '',
        sources: [],
        taskId: task.id,
        legalTask: task,
        orchestrator: orchestrator
      };
    } else {
      // Handle non-legal focus modes
      console.log('🔍 Using general search for mode:', focusMode);
      console.log('📋 Available search handlers:', Object.keys(searchHandlers));
      
      const handler = searchHandlers[focusMode];
      if (!handler) {
        console.error('❌ No handler found for focus mode:', focusMode);
        throw new Error(`Invalid focus mode: ${focusMode}. Available modes: ${Object.keys(searchHandlers).join(', ')}`);
      }
      
      console.log('✅ Found handler for focus mode:', focusMode);
      
      try {
        // Convert chat model config to actual LLM instance
        const { getDefaultChatModel, getDeepResearchChatModel } = await import('@/lib/providers');
        const { OpenAIEmbeddings } = await import('@langchain/openai');
        
        // Use specific model for deep legal research
        const llm = focusMode === 'deepLegalResearch' 
          ? await getDeepResearchChatModel()
          : await getDefaultChatModel();
        if (!llm) {
          throw new Error('Failed to initialize chat model');
        }
        
        // Use the configured embedding model from the request
        const { getAvailableEmbeddingModelProviders } = await import('@/lib/providers');
        const { createStandardizedEmbeddings } = await import('@/lib/embeddings/standardizedEmbeddings');
        
        const embeddingProvider = embeddingModel?.provider || 'openai';
        const embeddingModelName = embeddingModel?.name || 'text-embedding-3-small';
        
        // Get embeddings with proper API key configuration
        let embeddings;
        try {
          // Get available providers to check API keys
          const availableProviders = await getAvailableEmbeddingModelProviders();
          
          if (embeddingProvider === 'openai' && availableProviders.openai) {
            const { OpenAIEmbeddings } = await import('@langchain/openai');
            embeddings = new OpenAIEmbeddings({
              modelName: embeddingModelName,
            });
          } else if (embeddingProvider === 'transformers') {
            const { HuggingFaceTransformersEmbeddings } = await import('@langchain/community/embeddings/hf_transformers');
            embeddings = new HuggingFaceTransformersEmbeddings({
              modelName: embeddingModelName,
            });
          } else {
            // Default to OpenAI embeddings
            const { OpenAIEmbeddings } = await import('@langchain/openai');
            embeddings = new OpenAIEmbeddings();
          }
        } catch (error) {
          console.error('Failed to create embeddings:', error);
          throw new Error('Failed to initialize embeddings model');
        }
        
        // Get emitter directly (not awaited)
        const emitter = handler.searchAndAnswer(
          message.content,
          history.map(([role, content]) => 
            role === 'human' 
              ? new HumanMessage({ content })
              : new AIMessage({ content })
          ),
          llm,
          embeddings as any,
          optimizationMode,
          files,
          systemInstructions || ''
        );
        
        result = { 
          response: '', 
          sources: [], 
          emitter: emitter
        };
        
        console.log('✅ General search emitter created successfully');
      } catch (searchError) {
        console.error('❌ Error creating search emitter:', searchError);
        throw new Error(`Failed to create search emitter for ${focusMode}: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
      }
    }

    // Generate AI message ID
    const aiMessageId = randomBytes(7).toString('hex');

    // Store AI response in Supabase
    await supabaseAdmin.from('legal_messages').insert({
      chat_id: message.chatId,
      message_id: aiMessageId,
      role: 'assistant',
      content: result.response,
      sources: result.sources || [],
      metadata: {
        createdAt: new Date(),
        focusMode,
        matterId,
      },
    });

    // Stream the response in the format the frontend expects
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let sources: any[] = [];
        
        // Send task ID first if available for progress tracking
        if (result.taskId) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ 
                type: 'taskId', 
                data: result.taskId,
                messageId: aiMessageId 
              }) + '\n'
            )
          );
          
          // Give frontend time to set up progress tracking
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Handle legal task streaming with progress polling
        if (result.legalTask && result.orchestrator) {
          const task = result.legalTask;
          const orchestrator = result.orchestrator;
          
          // Start the task execution in background
          const executionPromise = orchestrator.executeTask(task.id);
          
          // Poll for progress updates
          let pollingActive = true;
          const pollProgress = async () => {
            while (pollingActive) {
              try {
                const taskStatus = await orchestrator.taskQueue.getTask(task.id);
                if (!taskStatus || !pollingActive) break;
                
                // Send progress updates only if controller is still open
                if (taskStatus.progress > 0 && pollingActive) {
                  try {
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({ 
                          type: 'progress', 
                          data: taskStatus.current_step || `Progress: ${taskStatus.progress}%`,
                          messageId: aiMessageId 
                        }) + '\n'
                      )
                    );
                  } catch (controllerError) {
                    // Controller is closed, stop polling
                    pollingActive = false;
                    break;
                  }
                }
                
                // Check if task is complete
                if (taskStatus.status === 'completed' || taskStatus.status === 'failed') {
                  pollingActive = false;
                  break;
                }
                
                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, 500));
              } catch (error) {
                console.error('Error polling progress:', error);
                pollingActive = false;
                break;
              }
            }
          };
          
          // Start polling
          pollProgress();
          
          // Wait for execution to complete
          const agentResult = await executionPromise;
          
          // Stop polling once task is complete
          pollingActive = false;
          
          if (!agentResult.success) {
            controller.error(new Error(agentResult.error || 'Agent execution failed'));
            return;
          }
          
          // Format and send the final response
          const formattedResult = formatAgentResponse(focusMode, agentResult.result);
          
          // Send sources if available
          if (formattedResult.sources && formattedResult.sources.length > 0) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ 
                  type: 'sources', 
                  data: formattedResult.sources,
                  messageId: aiMessageId 
                }) + '\n'
              )
            );
          }
          
          // Stream the response word by word
          const words = formattedResult.response.split(' ');
          for (let i = 0; i < words.length; i++) {
            const chunk = (i === 0 ? '' : ' ') + words[i];
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ 
                  type: 'message', 
                  data: chunk,
                  messageId: aiMessageId 
                }) + '\n'
              )
            );
            // Small delay between words for smooth streaming effect
            await new Promise(resolve => setTimeout(resolve, 8));
          }
          
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ 
                type: 'messageEnd', 
                messageId: aiMessageId 
              }) + '\n'
            )
          );
          controller.close();
          
        } else if (result.emitter) {
          const emitter = result.emitter;
          
          // Add timeout for emitter operations
          const emitterTimeout = setTimeout(() => {
            console.error('⏰ Emitter timeout - search took too long');
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ 
                  type: 'error', 
                  data: 'Search timeout - please try again',
                  messageId: aiMessageId 
                }) + '\n'
              )
            );
            controller.close();
          }, 60000); // 1 minute timeout
          
          // Send initial progress
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ 
                type: 'progress', 
                data: 'Searching the web...',
                messageId: aiMessageId 
              }) + '\n'
            )
          );
          
          emitter.on('data', (data: string) => {
            try {
              const parsedData = JSON.parse(data);
              
              if (parsedData.type === 'sources') {
                sources = parsedData.data;
                
                // Update progress
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ 
                      type: 'progress', 
                      data: `Found ${sources.length} sources, generating response...`,
                      messageId: aiMessageId 
                    }) + '\n'
                  )
                );
                
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ 
                      type: 'sources', 
                      data: sources,
                      messageId: aiMessageId 
                    }) + '\n'
                  )
                );
              } else if (parsedData.type === 'response') {
                // Stream response chunks word by word
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ 
                      type: 'message', 
                      data: parsedData.data,
                      messageId: aiMessageId 
                    }) + '\n'
                  )
                );
              }
            } catch (error) {
              console.error('Error parsing emitter data:', error);
            }
          });
          
          emitter.on('end', () => {
            clearTimeout(emitterTimeout);
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ 
                  type: 'messageEnd', 
                  messageId: aiMessageId 
                }) + '\n'
              )
            );
            controller.close();
          });
          
          emitter.on('error', (error: any) => {
            clearTimeout(emitterTimeout);
            console.error('Emitter error:', error);
            controller.error(error);
          });
        } else {
          // Fallback for non-streaming responses (legal modes)
          if (result.sources && result.sources.length > 0) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ 
                  type: 'sources', 
                  data: result.sources,
                  messageId: aiMessageId 
                }) + '\n'
              )
            );
          }

          // Send the message content
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ 
                type: 'message', 
                data: result.response,
                messageId: aiMessageId 
              }) + '\n'
            )
          );

          // Send end message
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ 
                type: 'messageEnd', 
                messageId: aiMessageId 
              }) + '\n'
            )
          );

          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('💥 Error in chat API:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}