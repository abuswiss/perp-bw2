'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PanelRightClose, PanelRightOpen, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
// Document analysis uses simple text-based responses
import { HighlightProvider, useHighlights, Highlight, highlightColors } from './HighlightManager';

interface DocumentData {
  id: string;
  filename: string;
  content: string;
  type?: string;
  metadata?: any;
}

interface DocumentAnalysisWrapperProps {
  children: React.ReactNode;
  documentId?: string;
  highlights?: Highlight[];
  onDocumentLoad?: (document: DocumentData) => void;
  className?: string;
}

const DocumentAnalysisWrapperInner: React.FC<DocumentAnalysisWrapperProps> = ({
  children,
  documentId,
  highlights: externalHighlights = [],
  onDocumentLoad,
  className
}) => {
  const [userPrefersPanelVisible, setUserPrefersPanelVisible] = useState(true); // User's preference
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(35); // Document panel width %
  const [isResizing, setIsResizing] = useState(false);

  const actualPanelVisible = !!documentId && userPrefersPanelVisible; // Determine actual visibility

  const {
    highlights,
    addHighlight,
    clearHighlights,
    setActiveHighlight
  } = useHighlights();

  // Load document content when documentId changes
  useEffect(() => {
    if (documentId) {
      loadDocument(documentId);
      setUserPrefersPanelVisible(true); // Ensure panel is shown when a new documentId arrives
    } else {
      setDocumentData(null); // Clear document data if documentId is removed
      // Optionally, you might want to set setUserPrefersPanelVisible(false) here or let user control
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]); // Only depends on documentId

  // Update highlights when external highlights change
  useEffect(() => {
    if (externalHighlights.length > 0) {
      clearHighlights();
      externalHighlights.forEach(highlight => {
        addHighlight(highlight);
      });
    }
  }, [externalHighlights, addHighlight, clearHighlights]);

  const loadDocument = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/documents/${id}/content`);
      if (!response.ok) {
        throw new Error('Failed to load document');
      }
      
      const document = await response.json();
      setDocumentData(document);
      onDocumentLoad?.(document);
    } catch (err) {
      console.error('Error loading document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  // Handle text selection in document viewer
  const handleTextSelect = useCallback((selectedText: string, startPos: number, endPos: number) => {
    clearHighlights('selection');
    
    addHighlight({
      startPos,
      endPos,
      text: selectedText,
      type: 'selection',
      color: highlightColors.selection,
      metadata: {
        searchTerm: selectedText
      }
    });
  }, [addHighlight, clearHighlights]);

  // Handle highlight clicks in document viewer
  const handleHighlightClick = useCallback((highlight: Highlight) => {
    setActiveHighlight(highlight.id);
    
    // Smooth scroll to highlight if it's a reference
    if (highlight.type === 'reference') {
      // The DocumentViewer should handle scrolling internally
      console.log('Clicked reference highlight:', highlight.text);
    }
  }, [setActiveHighlight]);

  // Handle panel resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const containerWidth = window.innerWidth;
    const rightPanelWidth = ((containerWidth - e.clientX) / containerWidth) * 100;
    setPanelWidth(Math.max(20, Math.min(60, rightPanelWidth)));
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Toggle document panel
  const toggleDocument = () => {
    setUserPrefersPanelVisible(!userPrefersPanelVisible);
  };

  // Reset layout
  const resetLayout = () => {
    setPanelWidth(35);
    setUserPrefersPanelVisible(true); // Reset preference to visible
  };

  // If no document ID, just show children (this logic might need adjustment based on actualPanelVisible)
  // This original condition might be too aggressive if we want the panel to attempt to show if documentId becomes available.
  // However, if documentId is truly null from the context, then no panel can be shown.
  // For now, let's keep it: if the context provides no documentId initially, the wrapper is minimal.
  if (!documentId && !actualPanelVisible) { // Check actualPanelVisible as well, though !documentId implies !actualPanelVisible
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn('flex h-screen bg-light-50 dark:bg-dark-50', className)}>
      {/* Main Chat Area */}
      <div
        className="relative flex flex-col"
        style={{
          width: actualPanelVisible ? `${100 - panelWidth}%` : '100%'
        }}
      >
        {children}
      </div>

      {/* Resize Handle */}
      {actualPanelVisible && (
        <div
          className={cn(
            'w-1 bg-light-200 dark:bg-dark-200 cursor-col-resize hover:bg-[#24A0ED] transition-colors relative group',
            isResizing && 'bg-[#24A0ED]'
          )}
          onMouseDown={handleMouseDown}
        >
          {/* Resize indicator */}
          <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-8 bg-[#24A0ED] rounded-full" />
          </div>
        </div>
      )}

      {/* Document Panel */}
      {actualPanelVisible && (
        <div
          className="relative border-l border-light-200 dark:border-dark-200"
          style={{
            width: `${panelWidth}%`
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-[#24A0ED] border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-black/60 dark:text-white/60">Loading document...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6">
                <p className="text-red-500 mb-4">{error}</p>
                <button
                  onClick={() => documentId && loadDocument(documentId)}
                  className="px-4 py-2 bg-[#24A0ED] text-white rounded-md hover:bg-[#1e8bc3] transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : documentData ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-black/60 dark:text-white/60">Document analysis uses simple text response now</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-black/60 dark:text-white/60">No document loaded</p>
            </div>
          )}
        </div>
      )}

      {/* Control Panel */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 z-50">
        {/* Only show toggle if a document could potentially be shown (i.e. documentId was ever present or could be) */}
        {/* Or always show if we want user to be able to open it "in anticipation" - current logic is fine */}
        {documentId && ( // Only show toggle if there's a document to toggle
          <button
            onClick={toggleDocument}
            className="p-2 bg-white dark:bg-dark-100 border border-light-200 dark:border-dark-200 rounded-md shadow-sm hover:shadow-md transition-all"
            title={actualPanelVisible ? 'Hide document viewer' : 'Show document viewer'}
          >
            {actualPanelVisible ? (
              <PanelRightClose className="w-4 h-4 text-black dark:text-white" />
            ) : (
              <PanelRightOpen className="w-4 h-4 text-black dark:text-white" />
            )}
          </button>
        )}
        
        {actualPanelVisible && (
          <button
            onClick={resetLayout}
            className="p-2 bg-white dark:bg-dark-100 border border-light-200 dark:border-dark-200 rounded-md shadow-sm hover:shadow-md transition-all"
            title="Reset layout"
          >
            <RotateCcw className="w-4 h-4 text-black dark:text-white" />
          </button>
        )}
      </div>

      {/* Resizing overlay */}
      {isResizing && (
        <div className="absolute inset-0 bg-black/5 cursor-col-resize z-40" />
      )}
    </div>
  );
};

const DocumentAnalysisWrapper: React.FC<DocumentAnalysisWrapperProps> = (props) => {
  return (
    <HighlightProvider>
      <DocumentAnalysisWrapperInner {...props} />
    </HighlightProvider>
  );
};

export default DocumentAnalysisWrapper;