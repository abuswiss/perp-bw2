import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import CopilotToggle from './MessageInputActions/Copilot';
import Focus from './MessageInputActions/Focus';
import Optimization from './MessageInputActions/Optimization';
import DocumentSelector from './MessageInputActions/DocumentSelector';
import { File } from './ChatWindow';
import { useMatter } from '@/contexts/MatterContext';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const EmptyChatMessageInput = ({
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
  sendMessage: (message: string) => void;
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

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setMessage(transcript);
    }
  }, [transcript]);

  // Stop listening if component unmounts
  useEffect(() => {
    return () => {
      SpeechRecognition.stopListening();
    };
  }, []);

  const handleSendMessage = () => {
    sendMessage(message);
    setMessage('');
    resetTranscript();
    if (listening) {
      SpeechRecognition.stopListening();
    }
  };

  const handleMicClick = () => {
    if (!browserSupportsSpeechRecognition) {
      // TODO: Show a toast or a more prominent error message
      console.error("Browser doesn't support speech recognition.");
      return;
    }
    if (!isMicrophoneAvailable) {
      // TODO: Show a toast or a more prominent error message
      console.error('Microphone is not available.');
      return;
    }

    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      setMessage(''); // Clear current message before starting new dictation
      SpeechRecognition.startListening({ continuous: true });
    }
  };

  // Generate dynamic placeholder based on matter and focus mode
  const getPlaceholder = () => {
    if (!currentMatter) {
      // General Research suggestions
      switch (focusMode) {
        case 'legalResearch':
          return "Search case law, statutes, regulations... e.g., 'negligence in personal injury cases'";
        case 'briefWriting':
          return "Generate legal documents... e.g., 'draft a brief motion to dismiss' or 'create a comprehensive legal memorandum'";
        case 'discovery':
          return "Analyze documents for discovery... e.g., 'review contract for key terms and risks'";
        case 'contractAnalysis':
          return "Analyze contracts and agreements... e.g., 'summarize this lease agreement'";
        case 'deepLegalResearch':
          return "Conduct in-depth legal research... e.g., 'trace the legislative history of [statute]'";
        case 'writingAssistant':
          return "Get help with legal writing... e.g., 'improve the clarity of this paragraph'";
        default:
          return "Enter a legal query, start drafting, or ask to analyze a document...";
      }
    }
    
    // Matter-specific suggestions
    const matterContext = `for ${currentMatter.name}`;
    switch (focusMode) {
      case 'legalResearch':
        return `Research legal issues ${matterContext}... e.g., 'find cases about contract interpretation'`;
      case 'briefWriting':
        return `Draft legal documents ${matterContext}... e.g., 'write a brief summary of key points' or 'create detailed analysis memo'`;
      case 'discovery':
        return `Review matter documents ${matterContext}... e.g., 'analyze uploaded contracts for risks'`;
      case 'contractAnalysis':
        return `Analyze contracts ${matterContext}... e.g., 'summarize terms in uploaded agreement'`;
      default:
        return `Ask questions about ${currentMatter.name}...`;
    }
  };

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSendMessage();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      }}
      className="w-full"
    >
      <div className="flex flex-col bg-light-secondary dark:bg-dark-secondary px-5 pt-5 pb-2 rounded-lg w-full max-w-4xl border border-light-200 dark:border-dark-200 chat-input-glow">
        <TextareaAutosize
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minRows={2}
          className="bg-transparent placeholder:text-black/50 dark:placeholder:text-white/50 text-sm text-black dark:text-white resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
          placeholder={getPlaceholder()}
        />
        <div className="flex flex-row items-center justify-between mt-4">
          <div className="flex flex-row items-center space-x-3 lg:space-x-6">
            <Focus focusMode={focusMode} setFocusMode={setFocusMode} />
            <DocumentSelector
              fileIds={fileIds}
              setFileIds={setFileIds}
              files={files}
              setFiles={setFiles}
              showText
            />
          </div>
          <div className="flex flex-row items-center space-x-2 sm:space-x-4">
            {/* Only show optimization for non-legal modes */}
            {!['legalResearch', 'briefWriting', 'discovery', 'contractAnalysis'].includes(focusMode) && (
              <Optimization
                optimizationMode={optimizationMode}
                setOptimizationMode={setOptimizationMode}
              />
            )}
            <button
              type="button"
              onClick={handleMicClick}
              className={cn(
                "p-2 rounded-full transition-colors duration-200 hover:bg-black/10 dark:hover:bg-white/10",
                listening ? "bg-red-500/20 hover:bg-red-500/30" : "text-black/70 dark:text-white/70",
              )}
              title={listening ? "Stop listening" : "Start listening"}
            >
              {listening ? <MicOff size={17} className="text-red-500" /> : <Mic size={17} />}
            </button>
            <button
              disabled={message.trim().length === 0}
              className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 disabled:bg-[#e0e0dc] dark:disabled:bg-[#ececec21] hover:bg-opacity-85 transition duration-100 rounded-full p-2"
            >
              <ArrowRight className="bg-background" size={17} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default EmptyChatMessageInput;
