/* eslint-disable @next/next/no-img-element */
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { Document } from '@langchain/core/documents';
import { File } from 'lucide-react';
import { Fragment, useState } from 'react';
import CitationFormatter from './search/CitationFormatter';
import SourceTypeFilter from './search/SourceTypeFilter';

const MessageSources = ({ sources }: { sources: Document[] }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  

  const closeModal = () => {
    setIsDialogOpen(false);
    document.body.classList.remove('overflow-hidden-scrollable');
  };

  const openModal = () => {
    setIsDialogOpen(true);
    document.body.classList.add('overflow-hidden-scrollable');
  };

  // Helper function to get source properties
  const getSourceProperty = (source: any, prop: string) => {
    return source.metadata?.[prop] || source[prop];
  };

  // Helper function to format document title with page number
  const getDocumentDisplayTitle = (source: any) => {
    const title = getSourceProperty(source, 'title') || 'Untitled';
    const pageNumber = getSourceProperty(source, 'pageNumber');
    const type = getSourceProperty(source, 'type');
    
    if (type === 'document' && pageNumber) {
      return `${title} (p. ${pageNumber})`;
    }
    return title;
  };

  // Filter sources based on active filters
  const filteredSources = sources.filter(source => {
    if (activeFilters.length === 0) return true;
    
    // Check if source matches any active filter
    return activeFilters.some(filter => {
      switch (filter) {
        case 'cases':
          return getSourceProperty(source, 'case_name') || getSourceProperty(source, 'citation');
        case 'statutes':
          const title = getSourceProperty(source, 'title') || '';
          return title.includes('USC') || title.includes('Code') || title.includes('U.S.C');
        case 'academic':
          const url = getSourceProperty(source, 'url') || '';
          return url.includes('.edu') || url.includes('scholar') || url.includes('jstor');
        case 'news':
          return url.includes('news') || url.includes('reuters') || url.includes('ap.org');
        case 'web':
          return url && !getSourceProperty(source, 'case_name') && !title.includes('USC') && getSourceProperty(source, 'type') !== 'document';
        case 'documents':
          return getSourceProperty(source, 'type') === 'document' || url?.startsWith('file://') || url === 'File';
        default:
          return true;
      }
    });
  });

  // Convert sources to format expected by CitationFormatter
  const citationSources = sources.map(source => ({
    title: getSourceProperty(source, 'title') || 'Untitled',
    url: getSourceProperty(source, 'url'),
    case_name: getSourceProperty(source, 'case_name'),
    citation: getSourceProperty(source, 'citation'),
    court: getSourceProperty(source, 'court'),
    decision_date: getSourceProperty(source, 'decision_date'),
    date: getSourceProperty(source, 'date'),
    author: getSourceProperty(source, 'author'),
    publication: getSourceProperty(source, 'publication'),
    type: getSourceProperty(source, 'type'),
    pageNumber: getSourceProperty(source, 'pageNumber'),
    documentId: getSourceProperty(source, 'documentId')
  }));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {sources.slice(0, 3).map((source, i) => (
        <a
          className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
          key={i}
          href={getSourceProperty(source, 'url') || '#'}
          target="_blank"
        >
          <p className="dark:text-white text-xs overflow-hidden whitespace-nowrap text-ellipsis">
            {getDocumentDisplayTitle(source)}
          </p>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center space-x-1">
              {getSourceProperty(source, 'url') === 'File' || getSourceProperty(source, 'url')?.startsWith('file://') ? (
                <div className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full">
                  <File size={12} className="text-white/70" />
                </div>
              ) : (
                <div className="bg-light-300 dark:bg-dark-300 w-4 h-4 rounded-lg flex items-center justify-center">
                  <div className="w-2 h-2 bg-black/20 dark:bg-white/20 rounded-full" />
                </div>
              )}
              <p className="text-xs text-black/50 dark:text-white/50 overflow-hidden whitespace-nowrap text-ellipsis">
                {getSourceProperty(source, 'url')?.startsWith('file://') ? 'Document' : (getSourceProperty(source, 'url')?.replace(/.+\/\/|www.|\..+/g, '') || 'Unknown')}
              </p>
            </div>
            <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
              <div className="bg-black/50 dark:bg-white/50 h-[4px] w-[4px] rounded-full" />
              <span>{i + 1}</span>
            </div>
          </div>
        </a>
      ))}
      {sources.length > 3 && (
        <button
          onClick={openModal}
          className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
        >
          <div className="flex flex-row items-center space-x-1">
            {sources.slice(3, 6).map((source, i) => {
              return getSourceProperty(source, 'url') === 'File' || getSourceProperty(source, 'url')?.startsWith('file://') ? (
                <div
                  key={i}
                  className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full"
                >
                  <File size={12} className="text-white/70" />
                </div>
              ) : (
                <div 
                  key={i}
                  className="bg-light-300 dark:bg-dark-300 w-4 h-4 rounded-lg flex items-center justify-center"
                >
                  <div className="w-2 h-2 bg-black/20 dark:bg-white/20 rounded-full" />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-black/50 dark:text-white/50">
            View {sources.length - 3} more
          </p>
        </button>
      )}
      <Transition appear show={isDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-200"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-4xl transform rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle className="text-lg font-medium leading-6 dark:text-white mb-4">
                    Sources & Citations ({sources.length})
                  </DialogTitle>
                  
                  {/* Source Type Filter */}
                  {sources.length > 4 && (
                    <div className="mb-4">
                      <SourceTypeFilter
                        sources={citationSources}
                        activeFilters={activeFilters}
                        onFilterChange={setActiveFilters}
                        showCounts={true}
                      />
                    </div>
                  )}

                  {/* Sources Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-auto max-h-[400px] mb-6 pr-2">
                    {filteredSources.map((source, i) => (
                      <a
                        className="bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 border border-light-200 dark:border-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
                        key={i}
                        href={getSourceProperty(source, 'url') || '#'}
                        target="_blank"
                      >
                        <p className="dark:text-white text-xs overflow-hidden whitespace-nowrap text-ellipsis">
                          {getDocumentDisplayTitle(source)}
                        </p>
                        <div className="flex flex-row items-center justify-between">
                          <div className="flex flex-row items-center space-x-1">
                            {getSourceProperty(source, 'url') === 'File' || getSourceProperty(source, 'url')?.startsWith('file://') ? (
                              <div className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full">
                                <File size={12} className="text-white/70" />
                              </div>
                            ) : (
                              <div className="bg-light-300 dark:bg-dark-300 w-4 h-4 rounded-lg flex items-center justify-center">
                                <div className="w-2 h-2 bg-black/20 dark:bg-white/20 rounded-full" />
                              </div>
                            )}
                            <p className="text-xs text-black/50 dark:text-white/50 overflow-hidden whitespace-nowrap text-ellipsis">
                              {getSourceProperty(source, 'url')?.startsWith('file://') ? 'Document' : (getSourceProperty(source, 'url')?.replace(
                                /.+\/\/|www.|\..+/g,
                                '',
                              ) || 'Unknown')}
                            </p>
                          </div>
                          <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
                            <div className="bg-black/50 dark:bg-white/50 h-[4px] w-[4px] rounded-full" />
                            <span>{i + 1}</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>

                  {/* Citation Formatter */}
                  <div className="border-t border-light-200 dark:border-dark-200 pt-4">
                    <CitationFormatter
                      sources={citationSources}
                      style="bluebook"
                      format="bibliography"
                    />
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default MessageSources;