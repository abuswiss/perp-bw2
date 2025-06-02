'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Document } from '@langchain/core/documents';
import Navbar from './Navbar';
import Chat from './Chat';
import EmptyChat from './EmptyChat';
import crypto from 'crypto';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { getSuggestions } from '@/lib/actions';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import NextError from 'next/error';
import { useMatter } from '@/contexts/MatterContext';
import { useDocumentAnalysis } from '@/contexts/DocumentAnalysisContext';
// Document analysis imports removed - now using simple text response

export type Message = {
  messageId: string;
  chatId: string;
  createdAt: Date;
  content: string;
  role: 'user' | 'assistant';
  suggestions?: string[];
  sources?: Document[];
  taskId?: string;
  progressMessage?: string;
  documentType?: 'brief' | 'contract' | 'memo' | 'motion' | 'other';
  focusMode?: string;
};

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

interface ChatModelProvider {
  name: string;
  provider: string;
}

interface EmbeddingModelProvider {
  name: string;
  provider: string;
}

const checkConfig = async (
  setChatModelProvider: (provider: ChatModelProvider) => void,
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void,
  setIsConfigReady: (ready: boolean) => void,
  setHasError: (hasError: boolean) => void,
) => {
  try {
    let chatModel = localStorage.getItem('chatModel');
    let chatModelProvider = localStorage.getItem('chatModelProvider');
    let embeddingModel = localStorage.getItem('embeddingModel');
    let embeddingModelProvider = localStorage.getItem('embeddingModelProvider');

    const autoImageSearch = localStorage.getItem('autoImageSearch');

    if (!autoImageSearch) {
      localStorage.setItem('autoImageSearch', 'true');
    }

    const providers = await fetch(`/api/models`, {
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(async (res) => {
      if (!res.ok)
        throw new Error(
          `Failed to fetch models: ${res.status} ${res.statusText}`,
        );
      return res.json();
    });

    if (
      !chatModel ||
      !chatModelProvider ||
      !embeddingModel ||
      !embeddingModelProvider
    ) {
      if (!chatModel || !chatModelProvider) {
        const chatModelProviders = providers.chatModelProviders;

        chatModelProvider =
          chatModelProvider || Object.keys(chatModelProviders)[0];

        chatModel = Object.keys(chatModelProviders[chatModelProvider])[0];

        if (!chatModelProviders || Object.keys(chatModelProviders).length === 0)
          return toast.error('No chat models available');
      }

      if (!embeddingModel || !embeddingModelProvider) {
        const embeddingModelProviders = providers.embeddingModelProviders;

        if (
          !embeddingModelProviders ||
          Object.keys(embeddingModelProviders).length === 0
        )
          return toast.error('No embedding models available');

        embeddingModelProvider = Object.keys(embeddingModelProviders)[0];
        embeddingModel = Object.keys(
          embeddingModelProviders[embeddingModelProvider],
        )[0];
      }

      localStorage.setItem('chatModel', chatModel!);
      localStorage.setItem('chatModelProvider', chatModelProvider);
      localStorage.setItem('embeddingModel', embeddingModel!);
      localStorage.setItem('embeddingModelProvider', embeddingModelProvider);
    } else {
      const chatModelProviders = providers.chatModelProviders;
      const embeddingModelProviders = providers.embeddingModelProviders;

      if (
        Object.keys(chatModelProviders).length > 0 &&
        !chatModelProviders[chatModelProvider]
      ) {
        const chatModelProvidersKeys = Object.keys(chatModelProviders);
        chatModelProvider =
          chatModelProvidersKeys.find(
            (key) => Object.keys(chatModelProviders[key]).length > 0,
          ) || chatModelProvidersKeys[0];

        localStorage.setItem('chatModelProvider', chatModelProvider);
      }

      if (
        chatModelProvider &&
        !chatModelProviders[chatModelProvider][chatModel]
      ) {
        chatModel = Object.keys(
          chatModelProviders[
            Object.keys(chatModelProviders[chatModelProvider]).length > 0
              ? chatModelProvider
              : Object.keys(chatModelProviders)[0]
          ],
        )[0];
        localStorage.setItem('chatModel', chatModel);
      }

      if (
        Object.keys(embeddingModelProviders).length > 0 &&
        !embeddingModelProviders[embeddingModelProvider]
      ) {
        embeddingModelProvider = Object.keys(embeddingModelProviders)[0];
        localStorage.setItem('embeddingModelProvider', embeddingModelProvider);
      }

      if (
        embeddingModelProvider &&
        !embeddingModelProviders[embeddingModelProvider][embeddingModel]
      ) {
        embeddingModel = Object.keys(
          embeddingModelProviders[embeddingModelProvider],
        )[0];
        localStorage.setItem('embeddingModel', embeddingModel);
      }
    }

    setChatModelProvider({
      name: chatModel!,
      provider: chatModelProvider,
    });

    setEmbeddingModelProvider({
      name: embeddingModel!,
      provider: embeddingModelProvider,
    });

    setIsConfigReady(true);
  } catch (err) {
    console.error('An error occurred while checking the configuration:', err);
    setIsConfigReady(false);
    setHasError(true);
  }
};

const loadMessages = async (
  chatId: string,
  setMessages: (messages: Message[]) => void,
  setIsMessagesLoaded: (loaded: boolean) => void,
  setChatHistory: (history: [string, string][]) => void,
  setFocusMode: (mode: string) => void,
  setNotFound: (notFound: boolean) => void,
  setFiles: (files: File[]) => void,
  setFileIds: (fileIds: string[]) => void,
) => {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 404) {
    setNotFound(true);
    setIsMessagesLoaded(true);
    return;
  }

  const data = await res.json();

  const messages = data.messages.map((msg: any) => {
    return {
      ...msg,
      ...JSON.parse(msg.metadata),
    };
  }) as Message[];

  setMessages(messages);

  const history = messages.map((msg) => {
    return [msg.role, msg.content];
  }) as [string, string][];

  console.debug(new Date(), 'app:messages_loaded');

  document.title = messages[0].content;

  const files = data.chat.files.map((file: any) => {
    return {
      fileName: file.name,
      fileExtension: file.name.split('.').pop(),
      fileId: file.fileId,
    };
  });

  setFiles(files);
  setFileIds(files.map((file: File) => file.fileId));

  setChatHistory(history);
  setFocusMode(data.chat.focusMode);
  setIsMessagesLoaded(true);
};

const ChatWindow = ({ id }: { id?: string }) => {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q');
  const { setDocumentAnalysis } = useDocumentAnalysis();

  const [chatId, setChatId] = useState<string | undefined>(id);
  const [newChatCreated, setNewChatCreated] = useState(false);

  const [chatModelProvider, setChatModelProvider] = useState<ChatModelProvider>(
    {
      name: '',
      provider: '',
    },
  );

  const [embeddingModelProvider, setEmbeddingModelProvider] =
    useState<EmbeddingModelProvider>({
      name: '',
      provider: '',
    });

  const [isConfigReady, setIsConfigReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    checkConfig(
      setChatModelProvider,
      setEmbeddingModelProvider,
      setIsConfigReady,
      setHasError,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);

  const [chatHistory, setChatHistory] = useState<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);

  const [focusMode, setFocusMode] = useState<string>('webSearch');
  const [optimizationMode, setOptimizationMode] = useState<
    'speed' | 'balanced' | 'quality'
  >('speed');
  
  // Add refs to track streaming state
  const streamingRef = useRef<{
    currentMessage: string;
    messageId: string;
    added: boolean;
    sources?: Document[];
    buffer: string;
    bufferTimeout?: NodeJS.Timeout;
    isUpdating: boolean;
    jsonBuffer: string;
    inJsonBlock: boolean;
  }>({
    currentMessage: '',
    messageId: '',
    added: false,
    sources: undefined,
    buffer: '',
    isUpdating: false,
    jsonBuffer: '',
    inJsonBlock: false
  });

  // Buffer-based message update
  const updateMessageContent = useCallback((messageId: string, content: string) => {
    // Add to buffer
    streamingRef.current.buffer = content;
    
    // If we're already updating, don't schedule another update
    if (streamingRef.current.isUpdating) {
      return;
    }

    streamingRef.current.isUpdating = true;

    // Schedule update for next frame
    requestAnimationFrame(() => {
      setMessages(prev => {
        const messageIndex = prev.findIndex(m => m.messageId === messageId);
        if (messageIndex === -1) return prev;
        
        const updatedMessages = [...prev];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: streamingRef.current.buffer
        };
        return updatedMessages;
      });

      // Reset update flag after a short delay to allow for new updates
      setTimeout(() => {
        streamingRef.current.isUpdating = false;
      }, 16); // One frame at 60fps
    });
  }, []);

  // Use MatterContext instead of local state
  const { currentMatter, setCurrentMatter } = useMatter();
  // Document analysis context removed - using simple text response

  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);

  const [notFound, setNotFound] = useState(false);
  const messagesRef = useRef<Message[]>([]);
  
  // Update ref when messages change
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (
      chatId &&
      !newChatCreated &&
      !isMessagesLoaded &&
      messages.length === 0
    ) {
      loadMessages(
        chatId,
        setMessages,
        setIsMessagesLoaded,
        setChatHistory,
        setFocusMode,
        setNotFound,
        setFiles,
        setFileIds,
      );
    } else if (!chatId) {
      setNewChatCreated(true);
      setIsMessagesLoaded(true);
      setChatId(crypto.randomBytes(20).toString('hex'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isMessagesLoaded && isConfigReady) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
    } else {
      setIsReady(false);
    }
  }, [isMessagesLoaded, isConfigReady]);

  const sendMessage = async (message: string, messageId?: string) => {
    if (loading) return;
    if (!isConfigReady) {
      toast.error('Cannot send message before the configuration is ready');
      return;
    }

    setLoading(true);
    setMessageAppeared(false);

    messageId = messageId ?? crypto.randomBytes(7).toString('hex');
    
    // Initialize streaming state
    streamingRef.current = {
      currentMessage: '',
      messageId,
      added: false,
      sources: undefined,
      buffer: '',
      isUpdating: false,
      jsonBuffer: '',
      inJsonBlock: false
    };

    // Add user message immediately
    setMessages(prev => [
      ...prev,
      {
        content: message,
        messageId,
        chatId: chatId!,
        role: 'user',
        createdAt: new Date(),
      },
    ]);

    // If this is document analysis with files, show the document panel immediately
    // TODO: Temporarily disabled to debug separate window issue
    // if (focusMode === 'documentAnalysis' && fileIds.length > 0) {
    //   console.log('🔄 Starting document analysis - opening document panel early');
    //   // Use the first file ID to open the document panel
    //   setDocumentAnalysis(fileIds[0], []);
    // }

    const messageHandler = async (data: any) => {
      if (data.type === 'error') {
        toast.error(data.data);
        setLoading(false);
        return;
      }

      if (data.type === 'progress') {
        setMessages(prev =>
          prev.map(msg => {
            if (msg && msg.messageId === data.messageId && msg.role === 'assistant') {
              return { ...msg, progressMessage: data.data };
            }
            return msg;
          })
        );
        return;
      }

      if (data.type === 'documentAnalysis') {
        // Handle document analysis data separately
        // This will be sent by the server when it detects document analysis JSON
        const { documentId, highlights } = data.data;
        if (documentId) {
          setDocumentAnalysis(documentId, highlights || []);
        }
        return;
      }

      if (data.type === 'sources') {
        streamingRef.current.sources = data.data;
        if (!streamingRef.current.added) {
          setMessages(prev => [
            ...prev,
            {
              content: '',
              messageId: data.messageId,
              chatId: chatId!,
              role: 'assistant',
              sources: data.data,
              createdAt: new Date(),
              focusMode: focusMode,
            },
          ]);
          streamingRef.current.added = true;
        }
        setMessageAppeared(true);
      }

      if (data.type === 'message') {
        // Filter out document analysis JSON markers during streaming
        let filteredContent = data.data;
        const startMarker = '||DOC_DATA_START||';
        const endMarker = '||DOC_DATA_END||';
        
        // Handle JSON block buffering
        if (streamingRef.current.inJsonBlock) {
          // We're inside a JSON block, buffer everything
          streamingRef.current.jsonBuffer += data.data;
          
          // Check if we have the end marker
          if (streamingRef.current.jsonBuffer.includes(endMarker)) {
            const endIndex = streamingRef.current.jsonBuffer.indexOf(endMarker);
            const jsonContent = streamingRef.current.jsonBuffer.substring(0, endIndex);
            
            // Parse and handle the document analysis data
            try {
              const docData = JSON.parse(jsonContent);
              if (docData && docData.documentId) {
                // Trigger document viewer immediately
                setDocumentAnalysis(docData.documentId, docData.highlights || []);
              }
            } catch (e) {
              console.error('Error parsing document analysis JSON:', e);
            }
            
            // Continue with content after the JSON block
            filteredContent = streamingRef.current.jsonBuffer.substring(endIndex + endMarker.length);
            streamingRef.current.inJsonBlock = false;
            streamingRef.current.jsonBuffer = '';
          } else {
            // Still inside JSON block, don't show anything
            return;
          }
        } else {
          // Not in JSON block, check if we're starting one
          const startIndex = data.data.indexOf(startMarker);
          if (startIndex !== -1) {
            // Found start marker
            filteredContent = data.data.substring(0, startIndex);
            streamingRef.current.inJsonBlock = true;
            streamingRef.current.jsonBuffer = data.data.substring(startIndex + startMarker.length);
            
            // Check if the end marker is also in this chunk
            const endIndex = streamingRef.current.jsonBuffer.indexOf(endMarker);
            if (endIndex !== -1) {
              const jsonContent = streamingRef.current.jsonBuffer.substring(0, endIndex);
              
              // Parse and handle the document analysis data
              try {
                const docData = JSON.parse(jsonContent);
                if (docData && docData.documentId) {
                  // Trigger document viewer immediately
                  setDocumentAnalysis(docData.documentId, docData.highlights || []);
                }
              } catch (e) {
                console.error('Error parsing document analysis JSON:', e);
              }
              
              // Add any content after the JSON block
              const afterJson = streamingRef.current.jsonBuffer.substring(endIndex + endMarker.length);
              if (afterJson) {
                filteredContent += afterJson;
              }
              streamingRef.current.inJsonBlock = false;
              streamingRef.current.jsonBuffer = '';
            }
          }
        }
        
        // Update message content
        if (!streamingRef.current.added && filteredContent) {
          setMessages(prev => [
            ...prev,
            {
              content: filteredContent,
              messageId: data.messageId,
              chatId: chatId!,
              role: 'assistant',
              sources: streamingRef.current.sources,
              createdAt: new Date(),
              focusMode: focusMode,
            },
          ]);
          streamingRef.current.added = true;
          streamingRef.current.currentMessage = filteredContent;
          streamingRef.current.buffer = filteredContent;
        } else if (filteredContent) {
          streamingRef.current.currentMessage += filteredContent;
          updateMessageContent(data.messageId, streamingRef.current.currentMessage);
        }
        setMessageAppeared(true);
      }

      if (data.type === 'taskId') {
        setMessages(prev =>
          prev.map(msg => {
            if (msg.messageId === data.messageId) {
              return { ...msg, taskId: data.data };
            }
            return msg;
          })
        );
      }

      if (data.type === 'messageEnd') {
        // Clear any pending updates
        if (streamingRef.current.bufferTimeout) {
          clearTimeout(streamingRef.current.bufferTimeout);
        }

        // Final update to ensure we have the complete message
        setMessages(prev => {
          const messageIndex = prev.findIndex(m => m.messageId === data.messageId);
          if (messageIndex === -1) return prev;
          
          const updatedMessages = [...prev];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            content: streamingRef.current.currentMessage
          };
          return updatedMessages;
        });

        setChatHistory(prev => [
          ...prev,
          ['human', message],
          ['assistant', streamingRef.current.currentMessage],
        ]);

        setLoading(false);

        const lastMsg = messagesRef.current[messagesRef.current.length - 1];

        const autoImageSearch = localStorage.getItem('autoImageSearch');

        if (lastMsg && autoImageSearch === 'true') {
          document
            .getElementById(`search-images-${lastMsg.messageId}`)
            ?.click();
        }

        if (
          lastMsg &&
          lastMsg.role === 'assistant' &&
          !lastMsg.suggestions
        ) {
          try {
            console.log('🤖 Loading suggestions for message:', lastMsg.messageId);
            const suggestions = await getSuggestions(messagesRef.current);
            console.log('✨ Suggestions loaded:', suggestions);
            setMessages(prev =>
              prev.map(msg => {
                if (msg.messageId === lastMsg.messageId) {
                  return { ...msg, suggestions };
                }
                return msg;
              })
            );
          } catch (error) {
            console.error('❌ Failed to load suggestions:', error);
          }
        }
      }
    };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        message: {
          messageId: messageId,
          chatId: chatId!,
          content: message,
        },
        chatId: chatId!,
        files: fileIds,
        focusMode: focusMode,
        optimizationMode: optimizationMode,
        history: chatHistory,
        matterId: currentMatter?.id || null,
        chatModel: {
          name: chatModelProvider.name,
          provider: chatModelProvider.provider,
        },
        embeddingModel: {
          name: embeddingModelProvider.name,
          provider: embeddingModelProvider.provider,
        },
        systemInstructions: localStorage.getItem('systemInstructions'),
      }),
    });

    if (!res.body) throw new Error('No response body');

    const reader = res.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    let partialChunk = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      partialChunk += decoder.decode(value, { stream: true });

      const messages = partialChunk.split('\n');
      let lastProcessedIndex = -1;
      
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg.trim()) {
          lastProcessedIndex = i;
          continue;
        }
        
        try {
          const json = JSON.parse(msg);
          messageHandler(json);
          lastProcessedIndex = i;
        } catch (error) {
          // This message is incomplete, stop processing
          if (i === messages.length - 1) {
            // Last message might be incomplete
            console.debug('Incomplete JSON, waiting for next chunk...');
          } else {
            // Non-last message shouldn't be incomplete
            console.error('Invalid JSON in stream:', msg);
            lastProcessedIndex = i;
          }
          break;
        }
      }
      
      // Keep only the unprocessed part
      if (lastProcessedIndex >= 0) {
        partialChunk = messages.slice(lastProcessedIndex + 1).join('\n');
      }
    }
  };

  const rewrite = (messageId: string) => {
    const index = messages.findIndex((msg) => msg.messageId === messageId);

    if (index === -1) return;

    const message = messages[index - 1];

    setMessages((prev) => {
      return [...prev.slice(0, messages.length > 2 ? index - 1 : 0)];
    });
    setChatHistory((prev) => {
      return [...prev.slice(0, messages.length > 2 ? index - 1 : 0)];
    });

    sendMessage(message.content, message.messageId);
  };

  useEffect(() => {
    if (isReady && initialMessage && isConfigReady) {
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigReady, isReady, initialMessage]);

  if (hasError) {
    return (
      <div className="relative">
        <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5">
          <Link href="/settings">
            <Settings className="cursor-pointer lg:hidden" />
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="dark:text-white/70 text-black/70 text-sm">
            Failed to connect to the server. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return isReady ? (
    notFound ? (
      <NextError statusCode={404} />
    ) : (
      <div>
        {messages.length > 0 ? (
          <>
            <Navbar chatId={chatId!} messages={messages} />
            <Chat
              loading={loading}
              messages={messages}
              sendMessage={sendMessage}
              messageAppeared={messageAppeared}
              rewrite={rewrite}
              fileIds={fileIds}
              setFileIds={setFileIds}
              files={files}
              setFiles={setFiles}
            />
          </>
        ) : (
          <EmptyChat
            sendMessage={sendMessage}
            focusMode={focusMode}
            setFocusMode={setFocusMode}
            optimizationMode={optimizationMode}
            setOptimizationMode={(mode: string) => setOptimizationMode(mode as 'speed' | 'balanced' | 'quality')}
            fileIds={fileIds}
            setFileIds={setFileIds}
            files={files}
            setFiles={setFiles}
          />
        )}
      </div>
    )
  ) : (
    <div className="flex flex-row items-center justify-center min-h-screen">
      <svg
        aria-hidden="true"
        className="w-8 h-8 text-light-200 fill-light-secondary dark:text-[#202020] animate-spin dark:fill-[#ffffff3b]"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
    </div>
  );
};

export default ChatWindow;
