import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { 
  CopyPlus, 
  File, 
  LoaderCircle, 
  Plus, 
  Trash, 
  Search,
  Clock,
  Check,
  X,
  FileText
} from 'lucide-react';
import { Fragment, useRef, useState, useEffect } from 'react';
import { File as FileType } from '../ChatWindow';
import { useMatter } from '@/contexts/MatterContext';

interface Document {
  id: string;
  filename: string;
  file_type: string;
  created_at: string;
  matter_id?: string;
  summary?: string;
  processing_status: string;
}

const DocumentSelectorSmall = ({
  fileIds,
  setFileIds,
  files,
  setFiles,
}: {
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: FileType[];
  setFiles: (files: FileType[]) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExistingDocs, setShowExistingDocs] = useState(false);
  const fileInputRef = useRef<any>();
  const { currentMatter } = useMatter();

  // Load available documents when component mounts or matter changes
  useEffect(() => {
    loadAvailableDocuments();
  }, [currentMatter]);

  const loadAvailableDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const url = currentMatter 
        ? `/api/documents?matterId=${currentMatter.id}`
        : '/api/documents';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAvailableDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    const data = new FormData();

    for (let i = 0; i < e.target.files!.length; i++) {
      data.append('files', e.target.files![i]);
    }

    const embeddingModelProvider = localStorage.getItem('embeddingModelProvider');
    const embeddingModel = localStorage.getItem('embeddingModel');

    data.append('embedding_model_provider', embeddingModelProvider!);
    data.append('embedding_model', embeddingModel!);

    if (currentMatter) {
      data.append('matterId', currentMatter.id);
    }

    const res = await fetch(`/api/uploads`, {
      method: 'POST',
      body: data,
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error('Upload failed:', resData);
      alert(resData.message || 'Failed to upload files');
      setLoading(false);
      return;
    }

    if (resData.files && Array.isArray(resData.files)) {
      setFiles([...files, ...resData.files]);
      setFileIds([...fileIds, ...resData.files.map((file: any) => file.fileId)]);
      // Refresh available documents list
      loadAvailableDocuments();
    }
    setLoading(false);
  };

  const handleDocumentSelect = (document: Document) => {
    // Check if document is already selected
    const isAlreadySelected = files.some(file => file.fileId === document.id);
    
    if (isAlreadySelected) {
      // Remove from selection if already selected
      const newFiles = files.filter(file => file.fileId !== document.id);
      const newFileIds = fileIds.filter(id => id !== document.id);
      setFiles(newFiles);
      setFileIds(newFileIds);
    } else {
      // Add to selected files
      const newFile: FileType = {
        fileName: document.filename,
        fileExtension: document.filename.split('.').pop() || '',
        fileId: document.id,
      };

      setFiles([...files, newFile]);
      setFileIds([...fileIds, document.id]);
    }
  };

  const removeFile = (indexToRemove: number) => {
    const newFiles = files.filter((_, index) => index !== indexToRemove);
    const newFileIds = fileIds.filter((_, index) => index !== indexToRemove);
    setFiles(newFiles);
    setFileIds(newFileIds);
  };

  const filteredDocuments = availableDocuments.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('docx')) return '📝';
    if (fileType.includes('text')) return '📃';
    return '📄';
  };

  if (loading) {
    return (
      <div className="flex flex-row items-center justify-between space-x-1 p-1">
        <LoaderCircle size={20} className="text-sky-400 animate-spin" />
      </div>
    );
  }

  return (
    <Popover className="max-w-[15rem] md:max-w-md lg:max-w-lg">
      <PopoverButton
        type="button"
        className="flex flex-row items-center justify-between space-x-1 p-1 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
      >
        {files.length > 0 ? (
          <File size={20} className="text-sky-400" />
        ) : (
          <CopyPlus size={20} />
        )}
      </PopoverButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel className="absolute z-10 w-80 md:w-[380px] bottom-14 -ml-3">
          <div className="bg-light-primary dark:bg-dark-primary border rounded-md border-light-200 dark:border-dark-200 w-full shadow-lg">
            {/* Header */}
            <div className="flex flex-row items-center justify-between px-3 py-2 border-b border-light-200 dark:border-dark-200">
              <h4 className="text-black dark:text-white font-medium text-sm">
                Documents
              </h4>
              <div className="flex flex-row items-center space-x-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="flex flex-row items-center space-x-1 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200"
                >
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    accept=".pdf,.docx,.txt"
                    multiple
                    hidden
                  />
                  <Plus size={16} />
                  <p className="text-xs">Upload</p>
                </button>
                {files.length > 0 && (
                  <button
                    onClick={() => {
                      setFiles([]);
                      setFileIds([]);
                    }}
                    className="flex flex-row items-center space-x-1 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200"
                  >
                    <Trash size={14} />
                    <p className="text-xs">Clear</p>
                  </button>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-light-200 dark:border-dark-200">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowExistingDocs(false);
                }}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-colors flex-1",
                  !showExistingDocs
                    ? "text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400"
                    : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                )}
              >
                Selected ({files.length})
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowExistingDocs(true);
                }}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-colors flex-1",
                  showExistingDocs
                    ? "text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400"
                    : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                )}
              >
                Available
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[250px] overflow-y-auto">
              {!showExistingDocs ? (
                // Selected Files Tab
                <div className="flex flex-col">
                  {files.length === 0 ? (
                    <div className="p-3 text-center text-black/50 dark:text-white/50 text-xs">
                      No documents selected
                    </div>
                  ) : (
                    files.map((file, i) => (
                      <div
                        key={i}
                        className="flex flex-row items-center justify-between w-full space-x-2 p-2 hover:bg-light-100 dark:hover:bg-dark-100"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <div className="bg-sky-100 dark:bg-sky-900 flex items-center justify-center w-6 h-6 rounded">
                            <File size={12} className="text-sky-600 dark:text-sky-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-black dark:text-white text-xs truncate">
                              {file.fileName}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeFile(i);
                          }}
                          className="text-red-500 hover:text-red-600 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // Available Documents Tab
                <div className="flex flex-col">
                  {/* Search Bar */}
                  <div className="p-2 border-b border-light-200 dark:border-dark-200">
                    <div className="relative">
                      <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-black/40 dark:text-white/40" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        className="w-full pl-8 pr-2 py-1 text-xs bg-light-100 dark:bg-dark-100 border border-light-200 dark:border-dark-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  {/* Document List */}
                  {loadingDocuments ? (
                    <div className="p-3 text-center">
                      <LoaderCircle size={16} className="animate-spin mx-auto text-sky-400" />
                      <p className="text-xs text-black/50 dark:text-white/50 mt-1">Loading...</p>
                    </div>
                  ) : filteredDocuments.length === 0 ? (
                    <div className="p-3 text-center text-black/50 dark:text-white/50 text-xs">
                      {searchQuery ? 'No matches' : 'No documents'}
                    </div>
                  ) : (
                    filteredDocuments.slice(0, 5).map((document) => {
                      const isSelected = files.some(file => file.fileId === document.id);
                      return (
                        <div
                          key={document.id}
                          className={cn(
                            "flex flex-row items-center justify-between w-full space-x-2 p-2 hover:bg-light-100 dark:hover:bg-dark-100 cursor-pointer transition-colors",
                            isSelected && "bg-sky-50 dark:bg-sky-900/20"
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDocumentSelect(document);
                          }}
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div className="text-sm">
                              {getFileIcon(document.file_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-black dark:text-white text-xs truncate font-medium">
                                {document.filename}
                              </p>
                              <div className="flex items-center space-x-1 mt-0.5">
                                <Clock size={10} className="text-black/40 dark:text-white/40" />
                                <p className="text-black/50 dark:text-white/50 text-xs">
                                  {formatDate(document.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center">
                            {isSelected ? (
                              <div className="bg-sky-600 dark:bg-sky-400 rounded-full p-0.5">
                                <Check size={10} className="text-white dark:text-black" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 border-2 border-light-300 dark:border-dark-300 rounded-full hover:border-sky-400 transition-colors" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {filteredDocuments.length > 5 && (
                    <div className="p-2 text-center border-t border-light-200 dark:border-dark-200">
                      <p className="text-xs text-black/50 dark:text-white/50">
                        +{filteredDocuments.length - 5} more documents
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default DocumentSelectorSmall;