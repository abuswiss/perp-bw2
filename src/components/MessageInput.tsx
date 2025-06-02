import { cn } from '@/lib/utils';
import { ArrowUp, Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import DocumentSelector from './MessageInputActions/DocumentSelector';
import CopilotToggle from './MessageInputActions/Copilot';
import { File, Message } from './ChatWindow';
import DocumentSelectorSmall from './MessageInputActions/DocumentSelectorSmall';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const MessageInput = ({
  sendMessage,
  loading,
  fileIds,
  setFileIds,
  files,
  setFiles,
  messages,
}: {
  sendMessage: (message: string) => void;
  loading: boolean;
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  messages?: Message[];
}) => {
  const [copilotEnabled, setCopilotEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [textareaRows, setTextareaRows] = useState(1);
  const [mode, setMode] = useState<'multi' | 'single'>('single');

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  useEffect(() => {
    if (textareaRows >= 2 && message && mode === 'single') {
      setMode('multi');
    } else if (!message && mode === 'multi') {
      setMode('single');
    }
  }, [textareaRows, mode, message]);

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

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (transcript) {
      setMessage(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    return () => {
      SpeechRecognition.stopListening();
    };
  }, []);

  useEffect(() => {
    if (loading && listening) {
      SpeechRecognition.stopListening();
    }
  }, [loading, listening]);

  const handleSendMessage = () => {
    if (loading) return;
    sendMessage(message);
    setMessage('');
    resetTranscript();
    if (listening) {
      SpeechRecognition.stopListening();
    }
  };

  const handleMicClick = () => {
    if (!browserSupportsSpeechRecognition) {
      console.error("Browser doesn't support speech recognition.");
      return;
    }
    if (!isMicrophoneAvailable) {
      console.error('Microphone is not available.');
      return;
    }

    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      setMessage('');
      SpeechRecognition.startListening({ continuous: true });
    }
  };

  // Suggestions are now handled in MessageBox, not here

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
        className={cn(
          'bg-light-secondary dark:bg-dark-secondary p-4 flex items-center overflow-hidden border border-light-200 dark:border-dark-200',
          mode === 'multi' ? 'flex-col rounded-lg' : 'flex-row rounded-full',
        )}
      >
      {mode === 'single' && (
        <DocumentSelectorSmall
          fileIds={fileIds}
          setFileIds={setFileIds}
          files={files}
          setFiles={setFiles}
        />
      )}
      <TextareaAutosize
        ref={inputRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onHeightChange={(height, props) => {
          setTextareaRows(Math.ceil(height / props.rowHeight));
        }}
        className="transition bg-transparent dark:placeholder:text-white/50 placeholder:text-sm text-sm dark:text-white resize-none focus:outline-none w-full px-2 max-h-24 lg:max-h-36 xl:max-h-48 flex-grow flex-shrink"
        placeholder="Ask a follow-up"
      />
      {mode === 'single' && (
        <div className="flex flex-row items-center space-x-4">
          <CopilotToggle
            copilotEnabled={copilotEnabled}
            setCopilotEnabled={setCopilotEnabled}
          />
          <button
            type="button"
            onClick={handleMicClick}
            className={cn(
              "p-2 rounded-full transition-colors duration-200 hover:bg-black/10 dark:hover:bg-white/10",
              listening ? "bg-red-500/20 hover:bg-red-500/30" : "bg-transparent",
            )}
            title={listening ? "Stop listening" : "Start listening"}
          >
            {listening ? <MicOff size={17} className="text-red-500" /> : <Mic size={17} className="text-black/70 dark:text-white/70" />}
          </button>
          <button
            disabled={message.trim().length === 0 || loading}
            className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2"
          >
            <ArrowUp className="bg-background" size={17} />
          </button>
        </div>
      )}
      {mode === 'multi' && (
        <div className="flex flex-row items-center justify-between w-full pt-2">
          <DocumentSelectorSmall
            fileIds={fileIds}
            setFileIds={setFileIds}
            files={files}
            setFiles={setFiles}
          />
          <div className="flex flex-row items-center space-x-4">
            <CopilotToggle
              copilotEnabled={copilotEnabled}
              setCopilotEnabled={setCopilotEnabled}
            />
            <button
              type="button"
              onClick={handleMicClick}
              className={cn(
                "p-2 rounded-full transition-colors duration-200 hover:bg-black/10 dark:hover:bg-white/10",
                listening ? "bg-red-500/20 hover:bg-red-500/30" : "bg-transparent",
              )}
              title={listening ? "Stop listening" : "Start listening"}
            >
              {listening ? <MicOff size={17} className="text-red-500" /> : <Mic size={17} className="text-black/70 dark:text-white/70" />}
            </button>
            <button
              disabled={message.trim().length === 0 || loading}
              className="bg-[#24A0ED] text-white text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2"
            >
              <ArrowUp className="bg-background" size={17} />
            </button>
          </div>
        </div>
      )}
      </form>
  );
};

export default MessageInput;
