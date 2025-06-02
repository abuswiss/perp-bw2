'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ZoomIn, ZoomOut, ChevronUp, ChevronDown, FileText, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Highlight {
  id: string;
  startPos: number;
  endPos: number;
  text: string;
  type: 'reference' | 'selection' | 'search' | 'active';
  color: string;
}

interface DocumentViewerProps {
  documentContent: string;
  documentInfo: {
    filename: string;
    documentId: string;
    wordCount: number;
    preview: string;
    type?: string;
  };
  highlights: Highlight[];
  onTextSelect?: (selectedText: string, startPos: number, endPos: number) => void;
  onHighlightClick?: (highlight: Highlight) => void;
  className?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentContent,
  documentInfo,
  highlights,
  onTextSelect,
  onHighlightClick,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle text selection
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() && onTextSelect) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString();
      
      // Calculate positions relative to the document content
      const startPos = getTextPosition(range.startContainer, range.startOffset);
      const endPos = getTextPosition(range.endContainer, range.endOffset);
      
      if (startPos !== -1 && endPos !== -1) {
        onTextSelect(selectedText, startPos, endPos);
      }
    }
  }, [onTextSelect]);

  // Get text position in the document
  const getTextPosition = (node: Node, offset: number): number => {
    if (!contentRef.current) return -1;
    
    let position = 0;
    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT
    );
    
    let currentNode;
    while (currentNode = walker.nextNode()) {
      if (currentNode === node) {
        return position + offset;
      }
      position += currentNode.textContent?.length || 0;
    }
    
    return -1;
  };

  // Search functionality
  const performSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const results: number[] = [];
    const content = documentContent.toLowerCase();
    const term = searchTerm.toLowerCase();
    let index = 0;

    while ((index = content.indexOf(term, index)) !== -1) {
      results.push(index);
      index += term.length;
    }

    setSearchResults(results);
    setCurrentSearchIndex(0);
  }, [searchTerm, documentContent]);

  // Navigate search results
  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    }
    
    setCurrentSearchIndex(newIndex);
    scrollToPosition(searchResults[newIndex]);
  };

  // Scroll to a specific position in the document
  const scrollToPosition = (position: number) => {
    if (!contentRef.current) return;

    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT
    );

    let currentPos = 0;
    let targetNode: Node | null = null;
    let targetOffset = 0;

    while (targetNode = walker.nextNode()) {
      const nodeLength = targetNode.textContent?.length || 0;
      if (currentPos + nodeLength >= position) {
        targetOffset = position - currentPos;
        break;
      }
      currentPos += nodeLength;
    }

    if (targetNode?.parentElement) {
      targetNode.parentElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  };

  // Render document content with highlights
  const renderContentWithHighlights = () => {
    if (!documentContent) return <div>No content available</div>;

    // Sort highlights by start position
    const sortedHighlights = [...highlights].sort((a, b) => a.startPos - b.startPos);
    
    // Add search highlights
    const allHighlights = [...sortedHighlights];
    if (searchTerm && searchResults.length > 0) {
      searchResults.forEach((pos, index) => {
        allHighlights.push({
          id: `search_${index}`,
          startPos: pos,
          endPos: pos + searchTerm.length,
          text: documentContent.substring(pos, pos + searchTerm.length),
          type: 'search',
          color: index === currentSearchIndex ? '#ff9800' : '#ffeb3b'
        });
      });
    }

    // Sort all highlights
    allHighlights.sort((a, b) => a.startPos - b.startPos);

    // Build the rendered content
    const parts: JSX.Element[] = [];
    let lastPos = 0;

    allHighlights.forEach((highlight, index) => {
      // Add text before highlight
      if (highlight.startPos > lastPos) {
        const textBefore = documentContent.substring(lastPos, highlight.startPos);
        parts.push(
          <span key={`text_${index}_before`}>
            {textBefore}
          </span>
        );
      }

      // Add highlighted text
      parts.push(
        <span
          key={`highlight_${highlight.id}`}
          className={cn(
            'cursor-pointer transition-all duration-200',
            highlight.type === 'reference' && 'hover:opacity-80',
            highlight.type === 'search' && 'font-semibold'
          )}
          style={{
            backgroundColor: highlight.color,
            padding: '2px 1px',
            borderRadius: '2px'
          }}
          onClick={() => onHighlightClick?.(highlight)}
          title={`${highlight.type}: ${highlight.text}`}
        >
          {highlight.text}
        </span>
      );

      lastPos = Math.max(lastPos, highlight.endPos);
    });

    // Add remaining text
    if (lastPos < documentContent.length) {
      const textAfter = documentContent.substring(lastPos);
      parts.push(
        <span key="text_final">
          {textAfter}
        </span>
      );
    }

    return <div>{parts}</div>;
  };

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'f') {
          e.preventDefault();
          const searchInput = document.querySelector('#document-search') as HTMLInputElement;
          searchInput?.focus();
        }
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoom(prev => Math.min(prev + 10, 200));
        }
        if (e.key === '-') {
          e.preventDefault();
          setZoom(prev => Math.max(prev - 10, 50));
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={cn(
      'flex flex-col h-full bg-white dark:bg-dark-100 border border-light-200 dark:border-dark-200 rounded-lg',
      isFullscreen && 'fixed inset-0 z-50',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-light-200 dark:border-dark-200">
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-[#24A0ED]" />
          <div>
            <h3 className="font-medium text-black dark:text-white text-sm">
              {documentInfo.filename}
            </h3>
            <p className="text-xs text-black/60 dark:text-white/60">
              {documentInfo.type ? documentInfo.type.replace('_', ' ').toUpperCase() : 'Document'} • {documentInfo.wordCount.toLocaleString()} words
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-md hover:bg-light-200 dark:hover:bg-dark-200 transition-colors"
            title="Toggle fullscreen"
          >
            <Maximize2 className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-light-200 dark:border-dark-200 bg-light-50 dark:bg-dark-200">
        {/* Search */}
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black/40 dark:text-white/40" />
            <input
              id="document-search"
              type="text"
              placeholder="Search document..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-light-200 dark:border-dark-300 rounded-md bg-white dark:bg-dark-100 text-black dark:text-white"
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="flex items-center space-x-1">
              <span className="text-xs text-black/60 dark:text-white/60">
                {currentSearchIndex + 1}/{searchResults.length}
              </span>
              <button
                onClick={() => navigateSearch('prev')}
                className="p-1 rounded hover:bg-light-200 dark:hover:bg-dark-300"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigateSearch('next')}
                className="p-1 rounded hover:bg-light-200 dark:hover:bg-dark-300"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setZoom(prev => Math.max(prev - 10, 50))}
            className="p-2 rounded hover:bg-light-200 dark:hover:bg-dark-300"
            disabled={zoom <= 50}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-black dark:text-white min-w-[3rem] text-center">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(prev + 10, 200))}
            className="p-2 rounded hover:bg-light-200 dark:hover:bg-dark-300"
            disabled={zoom >= 200}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Document content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-6"
      >
        <div
          ref={contentRef}
          className="max-w-none prose prose-sm dark:prose-invert"
          style={{ 
            fontSize: `${zoom}%`,
            lineHeight: '1.6',
            fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
          }}
          onMouseUp={handleTextSelection}
        >
          {renderContentWithHighlights()}
        </div>
      </div>

      {/* Highlights info */}
      {highlights.length > 0 && (
        <div className="p-3 border-t border-light-200 dark:border-dark-200 bg-light-50 dark:bg-dark-200">
          <p className="text-xs text-black/60 dark:text-white/60">
            {highlights.length} highlight{highlights.length !== 1 ? 's' : ''} • Click highlights to view analysis
          </p>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;