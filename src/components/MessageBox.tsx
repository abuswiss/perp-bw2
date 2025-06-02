'use client';

/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject, useEffect, useState, useRef } from 'react';
import { Message } from './ChatWindow';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  Volume2,
  StopCircle,
  Layers3,
  Plus,
} from 'lucide-react';
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import MessageSources from './MessageSources';
import SearchImages from './SearchImages';
import { useSpeech } from 'react-text-to-speech';
import ThinkBox from './ThinkBox';
import TaskProgress from './agents/TaskProgress';
import DocumentActions from './DocumentActions';
import AgentResultActions from './agents/AgentResultActions';
import ResearchExporter from './search/ResearchExporter';
import { useDocumentAnalysis } from '@/contexts/DocumentAnalysisContext';
import { useMatter } from '@/contexts/MatterContext';

const ThinkTagProcessor = ({ children }: { children: React.ReactNode }) => {
  return <ThinkBox content={children as string} />;
};

const MessageBox = ({
  message,
  messageIndex,
  history,
  loading,
  dividerRef,
  isLast,
  rewrite,
  sendMessage,
}: {
  message: Message;
  messageIndex: number;
  history: Message[];
  loading: boolean;
  dividerRef?: MutableRefObject<HTMLDivElement | null>;
  isLast: boolean;
  rewrite: (messageId: string) => void;
  sendMessage: (message: string) => void;
}) => {
  const { currentMatter } = useMatter();
  // Document analysis context removed - using simple text response
  const [parsedMessage, setParsedMessage] = useState(message.content);
  const [speechMessage, setSpeechMessage] = useState(message.content);
  
  useEffect(() => {
    const citationRegex = /\[([^\]]+)\]/g;
    const regex = /\[(\d+)\]/g;
    let processedMessage = message.content || '';

    // Document analysis now just returns plain text - no special processing needed

    if (message.role === 'assistant' && processedMessage.includes('<think>')) {
      const openThinkTag = processedMessage.match(/<think>/g)?.length || 0;
      const closeThinkTag = processedMessage.match(/<\/think>/g)?.length || 0;

      if (openThinkTag > closeThinkTag) {
        processedMessage += '</think> <a> </a>'; // The extra <a> </a> is to prevent the the think component from looking bad
      }
    }

    if (
      message.role === 'assistant' &&
      message?.sources &&
      message.sources.length > 0
    ) {
      setParsedMessage(
        processedMessage.replace(
          citationRegex,
          (_, capturedContent: string) => {
            const numbers = capturedContent
              .split(',')
              .map((numStr) => numStr.trim());

            const linksHtml = numbers
              .map((numStr) => {
                const number = parseInt(numStr);

                if (isNaN(number) || number <= 0) {
                  return `[${numStr}]`;
                }

                const source = message.sources?.[number - 1];
                const url = source?.metadata?.url || (source as any)?.url;

                if (url) {
                  return `<a href="${url}" target="_blank" className="bg-light-secondary dark:bg-dark-secondary px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 relative">${numStr}</a>`;
                } else {
                  return `[${numStr}]`;
                }
              })
              .join('');

            return linksHtml;
          },
        ),
      );
      setSpeechMessage(processedMessage.replace(regex, ''));
      return;
    }

    setSpeechMessage(processedMessage.replace(regex, ''));
    setParsedMessage(processedMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.content, message.sources, message.role, message.focusMode]);

  const { speechStatus, start, stop } = useSpeech({ text: speechMessage });

  const markdownOverrides: MarkdownToJSX.Options = {
    overrides: {
      think: {
        component: ThinkTagProcessor,
      },
    },
  };

  return (
    <div>
      {message.role === 'user' && (
        <div
          className={cn(
            'w-full',
            messageIndex === 0 ? 'pt-16' : 'pt-8',
            'break-words',
          )}
        >
          <h2 className="text-black dark:text-white font-medium text-3xl lg:w-9/12">
            {message.content}
          </h2>
        </div>
      )}

      {message.role === 'assistant' && (
        <div className="flex flex-col space-y-9 lg:space-y-0 lg:flex-row lg:justify-between lg:space-x-9">
          <div
            ref={dividerRef}
            className="flex flex-col space-y-6 w-full lg:w-9/12"
          >
            {message.sources && message.sources.length > 0 && (
              <div className="flex flex-col space-y-2">
                <div className="flex flex-row items-center space-x-2">
                  <BookCopy className="text-black dark:text-white" size={20} />
                  <h3 className="text-black dark:text-white font-medium text-xl">
                    Sources
                  </h3>
                </div>
                <MessageSources sources={message.sources} />
              </div>
            )}
            <div className="flex flex-col space-y-2">
              <div className="flex flex-row items-center space-x-2">
                <Disc3
                  className={cn(
                    'text-black dark:text-white',
                    isLast && loading ? 'animate-spin' : 'animate-none',
                  )}
                  size={20}
                />
                <h3 className="text-black dark:text-white font-medium text-xl">
                  Answer
                </h3>
              </div>

              {/* Show progress message when loading */}
              {isLast && loading && message.progressMessage && (
                <div className="mb-4 text-black/70 dark:text-white/70 text-sm flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-[#24A0ED] border-t-transparent rounded-full"></div>
                  <span>{message.progressMessage}</span>
                </div>
              )}
              
              {/* Show task progress if task ID is available */}
              {message.taskId && isLast && (
                <div className="mb-4">
                  <TaskProgress 
                    taskId={message.taskId}
                    onTaskComplete={() => {}}
                    onTaskError={() => {}}
                  />
                </div>
              )}

              {parsedMessage ? (
                <Markdown
                  className={cn(
                    'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
                    'max-w-none break-words text-black dark:text-white',
                  )}
                  options={markdownOverrides}
                >
                  {parsedMessage}
                </Markdown>
              ) : (
                // If parsedMessage is empty
                isLast && loading && !message.progressMessage ? (
                  <div className="text-black/70 dark:text-white/70 text-sm">
                    Analyzing...
                  </div>
                ) : message.focusMode === 'documentAnalysis' && message.role === 'assistant' ? (
                  <div className="text-black/70 dark:text-white/70 text-sm italic">
                    Document analysis complete. The document viewer has been updated.
                  </div>
                ) : (
                  // Generic case for empty message for assistant. Users messages are handled above.
                  message.role === 'assistant' && <div className="text-black/70 dark:text-white/70 text-sm">
                    {/* No textual response. */}
                  </div>
                )
              )}
              
              {/* Document analysis banner removed - now just shows analysis text */}
              
              {/* Show agent result actions for legal modes (but not when ResearchExporter will handle it or DocumentAnalysisLayout) */}
              {!loading && message.role === 'assistant' && 
               ['legalResearch', 'briefWriting', 'discovery', 'contractAnalysis', 'legalTimeline', 'documentAnalysis', 'deepLegalResearch'].includes(message.focusMode || '') && 
               message.content && 
               !(
                 ['legalResearch', 'briefWriting', 'deepLegalResearch'].includes(message.focusMode || '') && 
                 message.sources && message.sources.length > 0
               ) &&
               !(message.focusMode === 'documentAnalysis' && message.content.includes('||INTERACTIVE_DOCUMENT_ANALYSIS||')) && (
                <AgentResultActions 
                  content={message.content}
                  agentType={message.focusMode === 'legalResearch' ? 'research' : 
                           message.focusMode === 'briefWriting' ? 'brief-writing' :
                           message.focusMode === 'discovery' ? 'discovery' : 
                           message.focusMode === 'legalTimeline' ? 'timeline' : 
                           message.focusMode === 'documentAnalysis' ? 'document-analysis' :
                           message.focusMode === 'deepLegalResearch' ? 'deepLegalResearch' : 'contract'}
                  taskId={message.taskId}
                  autoSave={true}
                />
              )}

              {/* Research Exporter for legal research with sources */}
              {!loading && message.role === 'assistant' && 
               ['legalResearch', 'briefWriting', 'deepLegalResearch'].includes(message.focusMode || '') && 
               message.sources && message.sources.length > 0 && (
                <div className="mt-4">
                  <ResearchExporter 
                    researchData={{
                      query: history[messageIndex - 1]?.content || '',
                      summary: message.content,
                      sources: message.sources,
                      cases: message.sources.filter((s: any) => s.metadata?.case_name || s.case_name || s.metadata?.citation || s.citation),
                      statutes: message.sources.filter((s: any) => {
                        const title = s.metadata?.title || s.title || '';
                        return title.includes('USC') || title.includes('Code') || title.includes('U.S.C');
                      }),
                      citations: message.sources,
                      timestamp: new Date().toISOString(),
                      matterId: currentMatter?.id
                    }}
                    title={`Research Report - ${message.focusMode === 'legalResearch' ? 'Legal Research' : 'Brief Writing'}`}
                  />
                </div>
              )}

              {/* Show document actions for non-legal brief writing (fallback) */}
              {!loading && message.role === 'assistant' && message.focusMode === 'briefWriting' && 
               message.content && (
                <DocumentActions 
                  content={message.content}
                  title="Legal Document"
                />
              )}
              
              {/* Show brief writing refinement suggestions */}
              {!loading && isLast && message.role === 'assistant' && message.focusMode === 'briefWriting' && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">💡 Need to refine this document?</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => sendMessage("Make this more persuasive and add stronger legal arguments")}
                      className="text-xs bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-full transition-colors"
                    >
                      Make it more persuasive
                    </button>
                    <button
                      onClick={() => sendMessage("Add more legal citations and case law references")}
                      className="text-xs bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-full transition-colors"
                    >
                      Add more citations
                    </button>
                    <button
                      onClick={() => sendMessage("Make this document shorter and more concise")}
                      className="text-xs bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-full transition-colors"
                    >
                      Make it shorter
                    </button>
                    <button
                      onClick={() => sendMessage("Expand this document with more detailed analysis")}
                      className="text-xs bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-full transition-colors"
                    >
                      Add more detail
                    </button>
                  </div>
                </div>
              )}
              
              {/* Show copilot suggestions after message content - only for non-legal modes */}
              {!loading && isLast && message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && 
               message.focusMode !== 'legalResearch' && message.focusMode !== 'briefWriting' && 
               message.focusMode !== 'contractAnalysis' && message.focusMode !== 'discovery' && 
               message.focusMode !== 'legalTimeline' && message.focusMode !== 'academicSearch' && 
               message.focusMode !== 'documentAnalysis' && message.focusMode !== 'deepLegalResearch' &&
               message.focusMode !== 'webSearch' &&
               message.focusMode !== 'wolframAlphaSearch' &&
               message.focusMode !== 'redditSearch' &&
               !message.focusMode?.startsWith('custom-') && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {message.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => sendMessage(suggestion)}
                      className="text-xs bg-light-100 dark:bg-dark-100 hover:bg-light-200 dark:hover:bg-dark-200 text-black dark:text-white px-3 py-1.5 rounded-full transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              {loading && isLast ? null : (
                <div className="flex flex-row items-center justify-between w-full text-black dark:text-white py-4 -mx-2">
                  <div className="flex flex-row items-center space-x-1">
                    {/*  <button className="p-2 text-black/70 dark:text-white/70 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black text-black dark:hover:text-white">
                      <Share size={18} />
                    </button> */}
                    <Rewrite rewrite={rewrite} messageId={message.messageId} />
                  </div>
                  <div className="flex flex-row items-center space-x-1">
                    <Copy initialMessage={message.content} message={message} />
                    <button
                      onClick={() => {
                        if (speechStatus === 'started') {
                          stop();
                        } else {
                          start();
                        }
                      }}
                      className="p-2 text-black/70 dark:text-white/70 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
                    >
                      {speechStatus === 'started' ? (
                        <StopCircle size={18} />
                      ) : (
                        <Volume2 size={18} />
                      )}
                    </button>
                  </div>
                </div>
              )}
              {isLast &&
                message.suggestions &&
                message.suggestions.length > 0 &&
                message.role === 'assistant' &&
                !loading && (
                  <>
                    <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />
                    <div className="flex flex-col space-y-3 text-black dark:text-white">
                      <div className="flex flex-row items-center space-x-2 mt-4">
                        <Layers3 />
                        <h3 className="text-xl font-medium">Related</h3>
                      </div>
                      <div className="flex flex-col space-y-3">
                        {message.suggestions.map((suggestion, i) => (
                          <div
                            className="flex flex-col space-y-3 text-sm"
                            key={i}
                          >
                            <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />
                            <div
                              onClick={() => {
                                sendMessage(suggestion);
                              }}
                              className="cursor-pointer flex flex-row justify-between font-medium space-x-2 items-center"
                            >
                              <p className="transition duration-200 hover:text-[#24A0ED]">
                                {suggestion}
                              </p>
                              <Plus
                                size={20}
                                className="text-[#24A0ED] flex-shrink-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
            </div>
          </div>
          {/* Hide search components for legal modes */}
          {!['briefWriting', 'legalResearch', 'discovery', 'contractAnalysis', 'documentAnalysis'].includes(message.focusMode || '') && (
            <div className="lg:sticky lg:top-20 flex flex-col items-center space-y-3 w-full lg:w-3/12 z-30 h-full pb-4">
              <SearchImages
                query={history[messageIndex - 1].content}
                chatHistory={history.slice(0, messageIndex - 1)}
                messageId={message.messageId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageBox;