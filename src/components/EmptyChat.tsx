import { Settings } from 'lucide-react';
import EmptyChatMessageInput from './EmptyChatMessageInput';
import FocusModeCards from './FocusModeCards';
import { useState } from 'react';
import { File } from './ChatWindow';
import Link from 'next/link';
import ChatMatterSelector from './ChatMatterSelector';
import VisualThemeToggle from './theme/VisualThemeToggle';

const EmptyChat = ({
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="relative">
      <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5 space-x-4">
        <VisualThemeToggle size="md" />
        <Link href="/settings">
          <Settings className="cursor-pointer lg:hidden" />
        </Link>
      </div>
      <div className="flex flex-col items-center justify-start pt-24 min-h-screen max-w-4xl mx-auto p-2 space-y-6">
        {/* Matter Selector - always visible on empty chat */}
        <div className="w-full flex justify-center">
          <ChatMatterSelector />
        </div>
        
        <h2 className="text-black/70 dark:text-white/70 text-3xl font-medium -mt-4">
          Your AI powered Paralegal.
        </h2>
        <EmptyChatMessageInput
          sendMessage={sendMessage}
          focusMode={focusMode}
          setFocusMode={setFocusMode}
          optimizationMode={optimizationMode}
          setOptimizationMode={setOptimizationMode}
          fileIds={fileIds}
          setFileIds={setFileIds}
          files={files}
          setFiles={setFiles}
        />
        
        {/* Quick Start Legal Actions Section */}
        <div className="mt-6 text-center w-full max-w-xl px-4">
          <p className="text-sm text-black/50 dark:text-white/50 mb-3">
            Or try one of these common legal queries:
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center items-center gap-x-3 gap-y-3">
            <button 
              onClick={() => {
                setFocusMode('legalResearch');
                sendMessage("What are the aggravating factors for a death penalty determination under Texas law?");
              }}
              className="text-sm text-black dark:text-white/90 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ease-in-out shadow-sm border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
              title="What are the aggravating factors for a death penalty determination under Texas law?"
            >
              Aggravating Factors (TX Death Penalty)
            </button>
            <button 
              onClick={() => {
                setFocusMode('legalResearch');
                sendMessage("When is a gift complete under Missouri law?");
              }}
              className="text-sm text-black dark:text-white/90 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ease-in-out shadow-sm border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
              title="When is a gift complete under Missouri law?"
            >
              Gift Completion (MO Law)
            </button>
            <button 
              onClick={() => {
                setFocusMode('legalResearch');
                sendMessage("What is the legal standard for termination of life support under Colorado law?");
              }}
              className="text-sm text-black dark:text-white/90 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ease-in-out shadow-sm border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
              title="What is the legal standard for termination of life support under Colorado law?"
            >
              Life Support Termination (CO Law)
            </button>
          </div>
        </div>
        
        {/* Focus Mode Selection Cards */}
        {/* <div className="w-full">
          <FocusModeCards
            currentFocusMode={focusMode}
            onFocusModeSelect={setFocusMode}
          />
        </div> */}
      </div>
    </div>
  );
};

export default EmptyChat;
