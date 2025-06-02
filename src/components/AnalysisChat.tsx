'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, FileText, Loader2, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Highlight {
  id: string;
  startPos: number;
  endPos: number;
  text: string;
  type: 'reference' | 'selection' | 'search' | 'active';
  color: string;
}

interface AnalysisMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  highlights?: Highlight[];
  timestamp: Date;
  references?: Array<{
    text: string;
    startPos: number;
    endPos: number;
  }>;
}

interface AnalysisChatProps {
  initialAnalysis?: string;
  initialHighlights?: Highlight[];
  documentInfo: {
    filename: string;
    documentId: string;
    type?: string;
  };
  onSendMessage: (message: string) => Promise<{
    analysis: string;
    highlights: Highlight[];
  }>;
  onHighlightReference: (startPos: number, endPos: number) => void;
  className?: string;
  hideInputBar?: boolean;
}

const AnalysisChat: React.FC<AnalysisChatProps> = ({
  initialAnalysis,
  initialHighlights = [],
  documentInfo,
  onSendMessage,
  onHighlightReference,
  className,
  hideInputBar = false
}) => {
  const [messages, setMessages] = useState<AnalysisMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with initial analysis if provided
  useEffect(() => {
    if (initialAnalysis) {
      const initialMessage: AnalysisMessage = {
        id: 'initial',
        type: 'assistant',
        content: initialAnalysis,
        highlights: initialHighlights,
        timestamp: new Date(),
        references: extractReferences(initialAnalysis)
      };
      setMessages([initialMessage]);
    }
  }, [initialAnalysis, initialHighlights]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Extract document references from text
  const extractReferences = (text: string): Array<{text: string; startPos: number; endPos: number}> => {
    const references: Array<{text: string; startPos: number; endPos: number}> = [];
    const refPattern = /\[REF:([^|]+)\|([^\]]+)\]/g;
    let match;

    while ((match = refPattern.exec(text)) !== null) {
      const startText = match[1].trim();
      const endText = match[2].trim();
      references.push({
        text: `${startText}...${endText}`,
        startPos: 0, // Will be calculated based on document content
        endPos: 0
      });
    }

    return references;
  };

  // Process message content to make references clickable
  const processMessageContent = (content: string, messageId: string) => {
    const refPattern = /\[REF:([^|]+)\|([^\]]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = refPattern.exec(content)) !== null) {
      // Add text before the reference
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      // Add clickable reference
      const startText = match[1].trim();
      const endText = match[2].trim();
      const referenceText = `"${startText}...${endText}"`;
      
      parts.push(
        <button
          key={`ref_${messageId}_${match.index}`}
          onClick={() => {
            // This would need to be connected to document positions
            // For now, we'll just scroll to the reference
            console.log('Reference clicked:', startText, endText);
          }}
          className="inline-flex items-center px-2 py-1 mx-1 text-xs bg-[#24A0ED]/10 text-[#24A0ED] rounded-md hover:bg-[#24A0ED]/20 transition-colors border border-[#24A0ED]/20"
          title="Click to view in document"
        >
          <FileText className="w-3 h-3 mr-1" />
          {referenceText}
        </button>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts;
  };

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || isLoading) return;

    const userMessage: AnalysisMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const response = await onSendMessage(currentMessage.trim());
      
      const assistantMessage: AnalysisMessage = {
        id: `assistant_${Date.now()}`,
        type: 'assistant',
        content: response.analysis,
        highlights: response.highlights,
        timestamp: new Date(),
        references: extractReferences(response.analysis)
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: AnalysisMessage = {
        id: `error_${Date.now()}`,
        type: 'assistant',
        content: 'Sorry, I encountered an error while analyzing your question. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy message content
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content.replace(/\[REF:[^\]]+\]/g, ''));
  };

  // Suggested questions based on document type
  const getSuggestedQuestions = () => {
    const baseQuestions = [
      "What are the key points in this document?",
      "Summarize the main arguments or provisions",
      "What are the most important sections?"
    ];

    const typeSpecificQuestions: Record<string, string[]> = {
      'contract': [
        "What are the parties' main obligations?",
        "What are the termination clauses?",
        "What are the financial terms?"
      ],
      'brief': [
        "What is the legal issue being addressed?",
        "What are the main legal arguments?",
        "What precedents are cited?"
      ],
      'case_law': [
        "What is the court's holding?",
        "What are the key facts?",
        "What legal principle does this establish?"
      ],
      'statute': [
        "What does this statute require?",
        "Who does this apply to?",
        "What are the penalties for non-compliance?"
      ]
    };

    return typeSpecificQuestions[documentInfo.type || ''] || baseQuestions;
  };

  return (
    <div className={cn(
      'flex flex-col h-full bg-white dark:bg-dark-100 border border-light-200 dark:border-dark-200 rounded-lg',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-light-200 dark:border-dark-200">
        <div className="flex items-center space-x-3">
          <MessageSquare className="w-5 h-5 text-[#24A0ED]" />
          <div>
            <h3 className="font-medium text-black dark:text-white text-sm">
              Document Analysis
            </h3>
            <p className="text-xs text-black/60 dark:text-white/60">
              Ask questions about {documentInfo.filename}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setMessages([])}
          className="p-2 rounded-md hover:bg-light-200 dark:hover:bg-dark-200 transition-colors"
          title="Clear conversation"
        >
          <RefreshCw className="w-4 h-4 text-black dark:text-white" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-black/20 dark:text-white/20 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-black dark:text-white mb-2">
              Start analyzing your document
            </h4>
            <p className="text-black/60 dark:text-white/60 mb-6">
              Ask questions about the document content, key terms, or specific sections.
            </p>
            
            {/* Suggested questions */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-black dark:text-white">Suggested questions:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {getSuggestedQuestions().slice(0, 3).map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentMessage(question)}
                    className="px-3 py-2 text-sm bg-light-200 dark:bg-dark-200 text-black dark:text-white rounded-md hover:bg-light-300 dark:hover:bg-dark-300 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.type === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg p-3 relative group',
                message.type === 'user'
                  ? 'bg-[#24A0ED] text-white'
                  : 'bg-light-100 dark:bg-dark-200 text-black dark:text-white'
              )}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.type === 'assistant' 
                  ? processMessageContent(message.content, message.id)
                  : message.content
                }
              </div>
              
              {/* Message actions */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/10 dark:border-white/10">
                <span className="text-xs opacity-60">
                  {message.timestamp.toLocaleTimeString()}
                </span>
                <button
                  onClick={() => copyMessage(message.content)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                  title="Copy message"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>

              {/* References info */}
              {message.references && message.references.length > 0 && (
                <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10">
                  <p className="text-xs opacity-60">
                    {message.references.length} document reference{message.references.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-light-100 dark:bg-dark-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#24A0ED]" />
                <span className="text-sm text-black/60 dark:text-white/60">
                  Analyzing document...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!hideInputBar && (
        <div className="p-4 border-t border-light-200 dark:border-dark-200">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="Ask a question about this document..."
              className="flex-1 px-4 py-2 border border-light-200 dark:border-dark-300 rounded-md bg-white dark:bg-dark-100 text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#24A0ED] focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!currentMessage.trim() || isLoading}
              className={cn(
                'px-4 py-2 rounded-md transition-all',
                currentMessage.trim() && !isLoading
                  ? 'bg-[#24A0ED] text-white hover:bg-[#1e8bc3]'
                  : 'bg-light-200 dark:bg-dark-300 text-black/40 dark:text-white/40 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AnalysisChat;