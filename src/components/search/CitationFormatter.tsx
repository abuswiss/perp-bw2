'use client';

import { useState } from 'react';
import { BookOpen, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface CitationSource {
  title: string;
  url?: string;
  date?: string;
  author?: string;
  publication?: string;
  case_name?: string;
  citation?: string;
  court?: string;
  decision_date?: string;
  volume?: string;
  page?: string;
  year?: string;
  type?: string;
  pageNumber?: number;
  documentId?: string;
}

interface CitationFormatterProps {
  sources: CitationSource[];
  style?: 'bluebook' | 'apa' | 'chicago';
  format?: 'inline' | 'bibliography';
  onCopy?: (citation: string) => void;
}

const CitationFormatter = ({ 
  sources, 
  style = 'bluebook', 
  format = 'bibliography',
  onCopy 
}: CitationFormatterProps) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const formatBluebookCase = (source: CitationSource): string => {
    if (source.case_name && source.citation) {
      return `${source.case_name}, ${source.citation}${source.court ? ` (${source.court}` : ''}${source.decision_date ? ` ${new Date(source.decision_date).getFullYear()})` : ')'}`;
    }
    if (source.case_name && source.court && source.decision_date) {
      const year = new Date(source.decision_date).getFullYear();
      return `${source.case_name} (${source.court} ${year})`;
    }
    return formatBluebookGeneral(source);
  };

  const formatBluebookGeneral = (source: CitationSource): string => {
    let citation = '';
    
    // Handle document type
    if (source.type === 'document' || source.url?.startsWith('file://')) {
      citation += source.title;
      if (source.pageNumber) {
        citation += `, at ${source.pageNumber}`;
      }
      if (source.date) {
        citation += ` (${new Date(source.date).getFullYear()})`;
      }
      return citation;
    }
    
    if (source.author) {
      citation += `${source.author}, `;
    }
    
    citation += source.title;
    
    if (source.publication) {
      citation += `, ${source.publication}`;
    }
    
    if (source.date || source.year) {
      const year = source.year || (source.date ? new Date(source.date).getFullYear().toString() : '');
      citation += ` (${year})`;
    }
    
    if (source.url) {
      citation += `, ${source.url}`;
    }
    
    return citation;
  };

  const formatAPACitation = (source: CitationSource): string => {
    let citation = '';
    
    // Handle document type
    if (source.type === 'document' || source.url?.startsWith('file://')) {
      if (source.author) {
        citation += `${source.author}. `;
      }
      const year = source.year || (source.date ? new Date(source.date).getFullYear().toString() : 'n.d.');
      citation += `(${year}). `;
      citation += `${source.title}`;
      if (source.pageNumber) {
        citation += ` (p. ${source.pageNumber})`;
      }
      citation += '.';
      return citation;
    }
    
    // Author (Year). Title. Publication. URL
    if (source.author) {
      citation += `${source.author}. `;
    }
    
    const year = source.year || (source.date ? new Date(source.date).getFullYear().toString() : 'n.d.');
    citation += `(${year}). `;
    
    citation += `${source.title}. `;
    
    if (source.publication) {
      citation += `${source.publication}. `;
    }
    
    if (source.url) {
      citation += source.url;
    }
    
    return citation;
  };

  const formatChicagoCitation = (source: CitationSource): string => {
    let citation = '';
    
    if (source.author) {
      citation += `${source.author}. `;
    }
    
    citation += `"${source.title}."`;
    
    if (source.publication) {
      citation += ` ${source.publication}`;
    }
    
    if (source.date) {
      citation += `. ${new Date(source.date).toLocaleDateString()}`;
    }
    
    if (source.url) {
      citation += `. ${source.url}`;
    }
    
    return citation;
  };

  const formatCitation = (source: CitationSource): string => {
    switch (style) {
      case 'bluebook':
        return source.case_name ? formatBluebookCase(source) : formatBluebookGeneral(source);
      case 'apa':
        return formatAPACitation(source);
      case 'chicago':
        return formatChicagoCitation(source);
      default:
        return formatBluebookGeneral(source);
    }
  };

  const handleCopy = async (citation: string, index: number) => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopiedIndex(index);
      onCopy?.(citation);
      
      setTimeout(() => {
        setCopiedIndex(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy citation:', error);
    }
  };

  const copyAllCitations = async () => {
    const allCitations = sources.map((source, index) => 
      `${index + 1}. ${formatCitation(source)}`
    ).join('\n\n');
    
    try {
      await navigator.clipboard.writeText(allCitations);
      setCopiedIndex(-1);
      onCopy?.(allCitations);
      
      setTimeout(() => {
        setCopiedIndex(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy all citations:', error);
    }
  };

  if (!sources || sources.length === 0) {
    return null;
  }

  const styleNames = {
    bluebook: 'Bluebook',
    apa: 'APA',
    chicago: 'Chicago'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded-md transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
          <BookOpen className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            Citations ({styleNames[style]}) {sources.length > 0 && `(${sources.length})`}
          </h3>
        </button>
        
        {!isCollapsed && (
          <button
            onClick={copyAllCitations}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors"
          >
            {copiedIndex === -1 ? (
              <>
                <Check className="w-4 h-4" />
                Copied All
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy All
              </>
            )}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="space-y-3">
          {sources.map((source, index) => {
            const citation = formatCitation(source);
            const isCopied = copiedIndex === index;
            
            return (
              <div
                key={index}
                className="group p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white break-words">
                      {citation}
                    </p>
                    
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mt-1 inline-block"
                      >
                        View Source →
                      </a>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleCopy(citation, index)}
                    className="flex-shrink-0 p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-all"
                    title="Copy citation"
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isCollapsed && format === 'inline' && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
            Inline Format:
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            {sources.map((source, index) => {
              const shortCitation = source.case_name || source.title.substring(0, 30) + '...';
              return style === 'bluebook' 
                ? `${shortCitation} (${index + 1})`
                : `(${source.author?.split(' ').pop() || 'Unknown'}, ${source.year || new Date(source.date || '').getFullYear()})`;
            }).join('; ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default CitationFormatter;