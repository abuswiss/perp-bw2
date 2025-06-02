'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Check, 
  X, 
  Search, 
  Filter,
  Download,
  Calendar,
  User,
  Folder,
  Eye,
  CheckSquare,
  Square
} from 'lucide-react';
import { useMatter } from '@/contexts/MatterContext';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
  matterId?: string;
  tags?: string[];
  content?: string;
  status?: 'processing' | 'completed' | 'error';
}

interface BulkDocumentSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectionConfirm: (selectedDocs: Document[], agentType: string, customQuery?: string) => void;
  maxSelection?: number;
  allowedTypes?: string[];
  preSelectedDocuments?: Document[];
}

const BulkDocumentSelector = ({ 
  isOpen, 
  onClose, 
  onSelectionConfirm,
  maxSelection = 10,
  allowedTypes = [],
  preSelectedDocuments = []
}: BulkDocumentSelectorProps) => {
  const { currentMatter } = useMatter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [agentType, setAgentType] = useState<string>('discovery');
  const [customQuery, setCustomQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Load documents on mount
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      // Pre-select any provided documents
      if (preSelectedDocuments.length > 0) {
        setSelectedDocs(new Set(preSelectedDocuments.map(doc => doc.id)));
      }
    }
  }, [isOpen, currentMatter, preSelectedDocuments]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentMatter) {
        params.set('matterId', currentMatter.id);
      }
      
      const response = await fetch(`/api/documents?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    // Search filter
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Type filter
    const matchesType = filterType === 'all' || doc.type === filterType;
    
    // Allowed types filter
    const isAllowedType = allowedTypes.length === 0 || allowedTypes.includes(doc.type);
    
    return matchesSearch && matchesType && isAllowedType;
  });

  const toggleDocumentSelection = (docId: string) => {
    const newSelection = new Set(selectedDocs);
    
    if (newSelection.has(docId)) {
      newSelection.delete(docId);
    } else if (newSelection.size < maxSelection) {
      newSelection.add(docId);
    }
    
    setSelectedDocs(newSelection);
  };

  const selectAll = () => {
    const selectableIds = filteredDocuments
      .slice(0, maxSelection)
      .map(doc => doc.id);
    setSelectedDocs(new Set(selectableIds));
  };

  const clearSelection = () => {
    setSelectedDocs(new Set());
  };

  const handleConfirm = () => {
    const selectedDocuments = documents.filter(doc => selectedDocs.has(doc.id));
    onSelectionConfirm(selectedDocuments, agentType, customQuery || undefined);
    onClose();
  };

  const getDocumentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return '📄';
      case 'docx':
      case 'doc':
        return '📝';
      case 'xlsx':
      case 'xls':
        return '📊';
      case 'pptx':
      case 'ppt':
        return '📊';
      default:
        return '📄';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const agentOptions = [
    { id: 'discovery', label: 'Discovery Review', description: 'Privilege review and document analysis' },
    { id: 'contract', label: 'Contract Reviewer', description: 'Term extraction and risk assessment' },
    { id: 'research', label: 'Legal Research', description: 'Extract key legal concepts and citations' },
    { id: 'brief-writing', label: 'Document Drafting', description: 'Generate summaries and arguments (brief to comprehensive)' }
  ];

  const documentTypes = ['all', ...new Set(documents.map(doc => doc.type))];
  const selectedCount = selectedDocs.size;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Select Documents for Agent Processing
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Choose up to {maxSelection} documents to process with your selected agent
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {documentTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedCount} of {maxSelection} selected
              </span>
              
              {filteredDocuments.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    disabled={selectedCount >= maxSelection}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                  >
                    Select All ({Math.min(filteredDocuments.length, maxSelection - selectedCount)})
                  </button>
                  
                  {selectedCount > 0 && (
                    <button
                      onClick={clearSelection}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredDocuments.length} documents available
            </div>
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No documents found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map((doc) => {
                const isSelected = selectedDocs.has(doc.id);
                const canSelect = !isSelected && selectedCount < maxSelection;
                
                return (
                  <div
                    key={doc.id}
                    onClick={() => (isSelected || canSelect) && toggleDocumentSelection(doc.id)}
                    className={`
                      p-4 rounded-lg border cursor-pointer transition-all duration-200
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : canSelect 
                          ? 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getDocumentIcon(doc.type)}</span>
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {doc.name}
                          </h3>
                        </div>
                        
                        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-4">
                            <span>{formatFileSize(doc.size)}</span>
                            <span>{doc.type.toUpperCase()}</span>
                            {doc.status && (
                              <span className={`px-2 py-1 rounded-full ${
                                doc.status === 'completed' ? 'bg-green-100 text-green-700' :
                                doc.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {doc.status}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                            {doc.uploadedBy && (
                              <>
                                <User className="w-3 h-3 ml-2" />
                                <span>{doc.uploadedBy}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Agent Selection and Custom Query */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Agent Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {agentOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setAgentType(option.id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    agentType === option.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs opacity-75 mt-1">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Instructions (Optional)
            </label>
            <textarea
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Add specific instructions for how the agent should process these documents..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Process {selectedCount} Document{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkDocumentSelector;