import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import CopilotToggle from './MessageInputActions/Copilot';
import LegalFocus from './MessageInputActions/LegalFocus';
import Optimization from './MessageInputActions/Optimization';
import Attach from './MessageInputActions/Attach';
import { File } from './ChatWindow';
import { useMatter } from '@/contexts/MatterContext';

const EmptyChatMessageInputEnhanced = ({
  sendMessage,
  focusMode,
  setFocusMode,
  optimizationMode,
  setOptimizationMode,
  fileIds,
  setFileIds,
  files,
  setFiles,
}: {
  sendMessage: (message: string, matterId?: string) => void;
  focusMode: string;
  setFocusMode: (mode: string) => void;
  optimizationMode: string;
  setOptimizationMode: (mode: string) => void;
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: File[];
  setFiles: (files: File[]) => void;
}) => {
  const [copilotEnabled, setCopilotEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const { currentMatter } = useMatter();

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;

      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.hasAttribute('contenteditable');

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    inputRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Enhanced send message function that includes matter context
  const handleSendMessage = (messageText: string) => {
    sendMessage(messageText, currentMatter?.id);
  };

  // Get placeholder text based on focus mode and matter context
  const getPlaceholderText = () => {
    if (!currentMatter) {
      return 'Ask a legal question... (Select a matter for better context)';
    }

    switch (focusMode) {
      case 'caselaw':
        return `Search case law for ${currentMatter.name}...`;
      case 'statutory':
        return `Search statutes and regulations for ${currentMatter.name}...`;
      case 'briefWriting':
        return `Draft legal documents for ${currentMatter.name}...`;
      case 'discovery':
        return `Analyze discovery documents for ${currentMatter.name}...`;
      case 'contractAnalysis':
        return `Review contracts for ${currentMatter.name}...`;
      case 'matterDocuments':
        return `Search within ${currentMatter.name} documents...`;
      default:
        return `Ask about ${currentMatter.name}...`;
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (message.trim()) {
          handleSendMessage(message);
          setMessage('');
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (message.trim()) {
            handleSendMessage(message);
            setMessage('');
          }
        }
      }}
      className="w-full"
    >
      <div className="flex flex-col bg-light-secondary dark:bg-dark-secondary px-5 pt-5 pb-2 rounded-lg w-full border border-light-200 dark:border-dark-200">
        {/* Matter context indicator */}
        {currentMatter && (
          <div className="mb-3 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              Active Matter: {currentMatter.name}
            </span>
            {currentMatter.client_name && (
              <span className="text-blue-500 dark:text-blue-300 ml-2">
                • {currentMatter.client_name}
              </span>
            )}
          </div>
        )}

        <TextareaAutosize
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minRows={2}
          className="bg-transparent placeholder:text-black/50 dark:placeholder:text-white/50 text-sm text-black dark:text-white resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
          placeholder={getPlaceholderText()}
        />
        <div className="flex flex-row items-center justify-between mt-4">
          <div className="flex flex-row items-center space-x-2 lg:space-x-4">
            <LegalFocus focusMode={focusMode} setFocusMode={setFocusMode} />
            <Attach
              fileIds={fileIds}
              setFileIds={setFileIds}
              files={files}
              setFiles={setFiles}
              showText
            />
          </div>
          <div className="flex flex-row items-center space-x-1 sm:space-x-4">
            <Optimization
              optimizationMode={optimizationMode}
              setOptimizationMode={setOptimizationMode}
            />
            <CopilotToggle
              copilotEnabled={copilotEnabled}
              setCopilotEnabled={setCopilotEnabled}
            />
            <button
              disabled={!message.trim()}
              className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2"
            >
              <ArrowRight className="bg-background" size={17} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default EmptyChatMessageInputEnhanced;