'use client';

import { useState, useMemo } from 'react';
import { 
  Scale, 
  FileText, 
  GraduationCap, 
  Newspaper, 
  Globe, 
  Book,
  Filter,
  X
} from 'lucide-react';

interface Source {
  title: string;
  url?: string;
  metadata?: {
    type?: string;
    publication?: string;
    court?: string;
  };
  case_name?: string;
  citation?: string;
  content?: string;
}

interface SourceTypeFilterProps {
  sources: Source[];
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
  showCounts?: boolean;
}

const SourceTypeFilter = ({ 
  sources, 
  activeFilters, 
  onFilterChange,
  showCounts = true 
}: SourceTypeFilterProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Categorize sources by type
  const categorizedSources = useMemo(() => {
    const categories = {
      cases: [] as Source[],
      statutes: [] as Source[],
      academic: [] as Source[],
      news: [] as Source[],
      web: [] as Source[],
      other: [] as Source[]
    };

    sources.forEach(source => {
      // Determine source type based on various indicators
      if (source.case_name || source.citation || source.metadata?.court) {
        categories.cases.push(source);
      } else if (
        source.title.includes('USC') || 
        source.title.includes('U.S.C') ||
        source.title.includes('Code') ||
        source.url?.includes('uscode') ||
        source.url?.includes('law.cornell.edu/uscode')
      ) {
        categories.statutes.push(source);
      } else if (
        source.url?.includes('scholar.google') ||
        source.url?.includes('jstor') ||
        source.url?.includes('ssrn') ||
        source.url?.includes('.edu') ||
        source.metadata?.publication?.toLowerCase().includes('journal') ||
        source.metadata?.publication?.toLowerCase().includes('review') ||
        source.title.toLowerCase().includes('journal') ||
        source.title.toLowerCase().includes('review')
      ) {
        categories.academic.push(source);
      } else if (
        source.url?.includes('news') ||
        source.url?.includes('reuters') ||
        source.url?.includes('ap.org') ||
        source.url?.includes('cnn') ||
        source.url?.includes('bbc') ||
        source.url?.includes('wsj') ||
        source.url?.includes('nytimes') ||
        source.metadata?.type === 'news'
      ) {
        categories.news.push(source);
      } else if (source.url && (
        source.url.startsWith('http') || 
        source.url.startsWith('https')
      )) {
        categories.web.push(source);
      } else {
        categories.other.push(source);
      }
    });

    return categories;
  }, [sources]);

  const filterTypes = [
    {
      id: 'cases',
      label: 'Cases',
      icon: Scale,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      count: categorizedSources.cases.length
    },
    {
      id: 'statutes',
      label: 'Statutes',
      icon: Book,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      count: categorizedSources.statutes.length
    },
    {
      id: 'academic',
      label: 'Academic',
      icon: GraduationCap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      count: categorizedSources.academic.length
    },
    {
      id: 'news',
      label: 'News',
      icon: Newspaper,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 hover:bg-orange-100',
      count: categorizedSources.news.length
    },
    {
      id: 'web',
      label: 'Web',
      icon: Globe,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 hover:bg-gray-100',
      count: categorizedSources.web.length
    },
    {
      id: 'other',
      label: 'Other',
      icon: FileText,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100',
      count: categorizedSources.other.length
    }
  ];

  const handleFilterToggle = (filterId: string) => {
    const newFilters = activeFilters.includes(filterId)
      ? activeFilters.filter(f => f !== filterId)
      : [...activeFilters, filterId];
    
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    onFilterChange([]);
  };

  const hasActiveFilters = activeFilters.length > 0;
  const availableTypes = filterTypes.filter(type => type.count > 0);

  if (availableTypes.length <= 1) {
    return null; // Don't show filter if there's only one type or no sources
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filter by Source Type
          {hasActiveFilters && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              {activeFilters.length}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {(isExpanded || hasActiveFilters) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {availableTypes.map((type) => {
            const isActive = activeFilters.includes(type.id);
            const Icon = type.icon;
            
            return (
              <button
                key={type.id}
                onClick={() => handleFilterToggle(type.id)}
                className={`
                  p-3 rounded-lg border transition-all duration-200 text-left
                  ${isActive 
                    ? `${type.bgColor} border-current ${type.color} ring-2 ring-current ring-opacity-20` 
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isActive ? type.color : 'text-gray-500'}`} />
                  <span className={`text-sm font-medium ${
                    isActive 
                      ? type.color 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {type.label}
                  </span>
                  {showCounts && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isActive 
                        ? 'bg-white bg-opacity-70' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {type.count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Quick stats when collapsed */}
      {!isExpanded && !hasActiveFilters && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {sources.length} sources across {availableTypes.length} types
        </div>
      )}

      {/* Active filter summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map(filterId => {
            const type = filterTypes.find(t => t.id === filterId);
            if (!type) return null;
            
            const Icon = type.icon;
            
            return (
              <div
                key={filterId}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${type.bgColor} ${type.color}`}
              >
                <Icon className="w-3 h-3" />
                <span>{type.label}</span>
                <span className="opacity-75">({type.count})</span>
                <button
                  onClick={() => handleFilterToggle(filterId)}
                  className="ml-1 hover:bg-white hover:bg-opacity-50 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SourceTypeFilter;