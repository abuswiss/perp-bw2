'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import MessageInput from './MessageInput';
import { File, Message } from './ChatWindow';
import MessageBox from './MessageBox';
import MessageBoxLoading from './MessageBoxLoading';
import { useMatter } from '@/contexts/MatterContext';
import MatterSelector from './legal/MatterSelector';

const ChatEnhanced = ({
  loading,
  messages,
  sendMessage,
  messageAppeared,
  rewrite,
  fileIds,
  setFileIds,
  files,
  setFiles,
}: {
  messages: Message[];
  sendMessage: (message: string, matterId?: string) => void;
  loading: boolean;
  messageAppeared: boolean;
  rewrite: (messageId: string) => void;
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: File[];
  setFiles: (files: File[]) => void;
}) => {
  const [dividerWidth, setDividerWidth] = useState(0);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const messageEnd = useRef<HTMLDivElement | null>(null);
  const { currentMatter, isLoading: matterLoading } = useMatter();

  useEffect(() => {
    const updateDividerWidth = () => {
      if (dividerRef.current) {
        setDividerWidth(dividerRef.current.scrollWidth);
      }
    };

    updateDividerWidth();

    window.addEventListener('resize', updateDividerWidth);

    return () => {
      window.removeEventListener('resize', updateDividerWidth);
    };
  });

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enhance sendMessage to include matter context
  const handleSendMessage = (message: string) => {
    sendMessage(message, currentMatter?.id);
  };

  return (
    <div>
      {/* Matter Selector at the top of the chat */}
      <div className="sticky top-0 z-10 bg-light-primary dark:bg-dark-primary border-b border-light-200 dark:border-dark-200 px-4 py-3">
        <MatterSelector />
        {currentMatter && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            All messages and documents will be associated with this matter
          </div>
        )}
      </div>

      <div className="flex flex-col space-y-6 pt-8 pb-44 lg:pb-32 sm:mx-4 md:mx-8">
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;

          return (
            <Fragment key={i}>
              <MessageBox
                key={i}
                message={msg}
                messageIndex={i}
                history={messages}
                loading={loading}
                dividerRef={isLast ? dividerRef : undefined}
                isLast={isLast}
                rewrite={rewrite}
                sendMessage={handleSendMessage}
              />
              {!isLast && msg.role === 'assistant' && (
                <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />
              )}
            </Fragment>
          );
        })}
        {loading && !messageAppeared && <MessageBoxLoading />}
        <div ref={messageEnd} className="h-0" />
      </div>

      {dividerWidth > 0 && (
        <MessageInput
          sendMessage={handleSendMessage}
          loading={loading}
          fileIds={fileIds}
          setFileIds={setFileIds}
          files={files}
          setFiles={setFiles}
        />
      )}

      {/* Show matter context warning if no matter selected */}
      {!currentMatter && !matterLoading && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-lg shadow-lg z-50">
          <p className="text-sm font-medium">
            No matter selected. Messages won&apos;t be associated with any legal matter.
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatEnhanced;