'use client';

import { useState, useEffect } from 'react';
import { useMatter } from '@/contexts/MatterContext';
import { CourtListenerAPI } from '@/lib/integrations/courtlistener';
import { supabase } from '@/lib/supabase/client';
import { 
  Scale, 
  Search, 
  Filter, 
  BookOpen, 
  Calendar, 
  MapPin, 
  Star,
  StarOff,
  Download,
  ExternalLink,
  Bookmark,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface CaseResult {
  id: string;
  case_name: string;
  citation: string;
  court: string;
  decision_date: string;
  url?: string;
  summary?: string;
  key_points?: string[];
  courtlistener_id?: string;
  saved?: boolean;
  relevance_score?: number;
}

interface SearchFilters {
  court?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  jurisdiction?: string;
  savedOnly?: boolean;
}

const CaseLawBrowser = () => {
  const { currentMatter } = useMatter();
  const [cases, setCases] = useState<CaseResult[]>([]);
  const [savedCases, setSavedCases] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CaseResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [activeTab, setActiveTab] = useState<'saved' | 'search'>('saved');
  const [selectedCase, setSelectedCase] = useState<CaseResult | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const resultsPerPage = 10;
  const courtListener = new CourtListenerAPI();

  useEffect(() => {
    loadSavedCases();
  }, [currentMatter]);

  const loadSavedCases = async () => {
    try {
      setLoading(true);
      const query = supabase
        .from('case_citations')
        .select('*');

      // If viewing matter-specific cases
      if (currentMatter && filters.savedOnly) {
        // Get cases saved for this matter through research sessions
        const { data: researchSessions } = await supabase
          .from('research_sessions')
          .select('selected_citations')
          .eq('matter_id', currentMatter.id);

        const citationIds = researchSessions
          ?.flatMap(session => session.selected_citations || [])
          .filter(Boolean) || [];

        if (citationIds.length > 0) {
          query.in('id', citationIds);
        } else {
          // No saved cases for this matter
          setCases([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const formattedCases: CaseResult[] = (data || []).map(caseItem => ({
        id: caseItem.id,
        case_name: caseItem.case_name,
        citation: caseItem.citation,
        court: caseItem.court,
        decision_date: caseItem.decision_date,
        summary: caseItem.summary,
        key_points: caseItem.key_points,
        courtlistener_id: caseItem.courtlistener_id,
        saved: true,
        url: caseItem.metadata?.absolute_url ? `https://www.courtlistener.com${caseItem.metadata.absolute_url}` : undefined
      }));

      setCases(formattedCases);
      setSavedCases(new Set(formattedCases.map(c => c.courtlistener_id || c.id)));
    } catch (error) {
      console.error('Error loading saved cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setActiveTab('search');

      const searchOptions: any = {
        page: currentPage,
        order_by: '-score'
      };

      if (filters.court) {
        searchOptions.court = filters.court;
      }
      if (filters.dateRange?.start) {
        searchOptions.dateAfter = filters.dateRange.start;
      }
      if (filters.dateRange?.end) {
        searchOptions.dateBefore = filters.dateRange.end;
      }

      const results = await courtListener.searchOpinions(searchQuery, searchOptions);
      
      const formattedResults: CaseResult[] = (results.results || []).map((caseItem: any) => {
        const courtlistenerId = caseItem.id?.toString();
        const url = caseItem.absolute_url ? `https://www.courtlistener.com${caseItem.absolute_url}` : '';
        
        return {
          id: courtlistenerId || `search-${Date.now()}-${Math.random()}`,
          case_name: caseItem.case_name,
          citation: Array.isArray(caseItem.citation) ? caseItem.citation.join(', ') : (caseItem.citation || ''),
          court: caseItem.court,
          decision_date: caseItem.date_filed,
          summary: caseItem.snippet || caseItem.text?.substring(0, 300) + '...',
          courtlistener_id: courtlistenerId,
          saved: savedCases.has(courtlistenerId || ''),
          relevance_score: caseItem.score,
          url: url
        };
      });

      setSearchResults(formattedResults);
      setTotalResults(results.count || 0);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const toggleSaveCase = async (caseItem: CaseResult) => {
    try {
      const caseId = caseItem.courtlistener_id || caseItem.id;
      
      if (savedCases.has(caseId)) {
        // Remove from saved
        await supabase
          .from('case_citations')
          .delete()
          .eq('courtlistener_id', caseItem.courtlistener_id);

        setSavedCases(prev => {
          const next = new Set(prev);
          next.delete(caseId);
          return next;
        });

        // Update the case in current results
        if (activeTab === 'search') {
          setSearchResults(prev => prev.map(c => 
            c.id === caseItem.id ? { ...c, saved: false } : c
          ));
        }
      } else {
        // Save case
        const caseData = {
          case_name: caseItem.case_name,
          citation: caseItem.citation,
          court: caseItem.court,
          decision_date: caseItem.decision_date,
          courtlistener_id: caseItem.courtlistener_id,
          summary: caseItem.summary,
          key_points: caseItem.key_points,
          metadata: {
            absolute_url: caseItem.url,
            relevance_score: caseItem.relevance_score,
            saved_at: new Date().toISOString(),
            saved_from_matter: currentMatter?.id
          }
        };

        const { error } = await supabase
          .from('case_citations')
          .upsert(caseData, { onConflict: 'courtlistener_id' });

        if (error) throw error;

        setSavedCases(prev => new Set([...prev, caseId]));

        // Update the case in current results
        if (activeTab === 'search') {
          setSearchResults(prev => prev.map(c => 
            c.id === caseItem.id ? { ...c, saved: true } : c
          ));
        }

        // If there's a current matter, associate the case with it
        if (currentMatter) {
          await associateCaseWithMatter(caseItem, currentMatter.id);
        }
      }
    } catch (error) {
      console.error('Error toggling case save:', error);
    }
  };

  const associateCaseWithMatter = async (caseItem: CaseResult, matterId: string) => {
    try {
      // Create or update research session
      const { data: existingSession } = await supabase
        .from('research_sessions')
        .select('id, selected_citations')
        .eq('matter_id', matterId)
        .eq('query', searchQuery || 'Manual case save')
        .single();

      if (existingSession) {
        // Add to existing session
        const updatedCitations = [...(existingSession.selected_citations || []), caseItem.id];
        await supabase
          .from('research_sessions')
          .update({ selected_citations: updatedCitations })
          .eq('id', existingSession.id);
      } else {
        // Create new session
        await supabase
          .from('research_sessions')
          .insert({
            matter_id: matterId,
            query: searchQuery || 'Manual case save',
            selected_citations: [caseItem.id],
            notes: `Case saved: ${caseItem.case_name}`
          });
      }
    } catch (error) {
      console.error('Error associating case with matter:', error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCurrentResults = () => {
    return activeTab === 'saved' ? cases : searchResults;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setCurrentPage(1);
      performSearch();
    }
  };

  const totalPages = Math.ceil(totalResults / resultsPerPage);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Case Law Research
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Search and manage legal precedents and case law
            </p>
          </div>
          {currentMatter && (
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Matter</p>
              <p className="font-medium text-gray-900 dark:text-white">{currentMatter.name}</p>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search case law (e.g., 'negligence personal injury', 'contract breach damages')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => {
              setCurrentPage(1);
              performSearch();
            }}
            disabled={loading || !searchQuery.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Court
                </label>
                <select
                  value={filters.court || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, court: e.target.value || undefined }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white text-sm"
                >
                  <option value="">All Courts</option>
                  <option value="scotus">Supreme Court</option>
                  <option value="ca1">1st Circuit</option>
                  <option value="ca2">2nd Circuit</option>
                  <option value="ca3">3rd Circuit</option>
                  <option value="ca4">4th Circuit</option>
                  <option value="ca5">5th Circuit</option>
                  <option value="ca6">6th Circuit</option>
                  <option value="ca7">7th Circuit</option>
                  <option value="ca8">8th Circuit</option>
                  <option value="ca9">9th Circuit</option>
                  <option value="ca10">10th Circuit</option>
                  <option value="ca11">11th Circuit</option>
                  <option value="cadc">D.C. Circuit</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.dateRange?.start || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    dateRange: { ...prev.dateRange, start: e.target.value || undefined }
                  }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={filters.dateRange?.end || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    dateRange: { ...prev.dateRange, end: e.target.value || undefined }
                  }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white text-sm"
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.savedOnly || false}
                  onChange={(e) => setFilters(prev => ({ ...prev, savedOnly: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show only saved cases
                </span>
              </label>
              
              <button
                onClick={() => setFilters({})}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'saved'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" />
              Saved Cases ({cases.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search Results ({searchResults.length})
            </div>
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400">
                {activeTab === 'search' ? 'Searching case law...' : 'Loading saved cases...'}
              </p>
            </div>
          </div>
        ) : getCurrentResults().length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Scale className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {activeTab === 'saved' 
                  ? 'No saved cases yet' 
                  : searchQuery 
                    ? 'No cases found for your search'
                    : 'Enter a search query to find cases'
                }
              </p>
              {activeTab === 'saved' && (
                <p className="text-sm text-gray-500">
                  Search for cases and save them to build your case library
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Results Info */}
            {activeTab === 'search' && totalResults > 0 && (
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Showing {((currentPage - 1) * resultsPerPage) + 1}-{Math.min(currentPage * resultsPerPage, totalResults)} of {totalResults.toLocaleString()} results
              </div>
            )}

            {/* Case Cards */}
            <div className="space-y-4">
              {getCurrentResults().map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer bg-white dark:bg-gray-800"
                  onClick={() => setSelectedCase(caseItem)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {caseItem.case_name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Scale className="w-4 h-4" />
                          {caseItem.court}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(caseItem.decision_date)}
                        </span>
                        {caseItem.citation && (
                          <span className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                            {caseItem.citation}
                          </span>
                        )}
                        {caseItem.relevance_score && (
                          <span className="text-green-600 dark:text-green-400 text-xs">
                            {Math.round(caseItem.relevance_score * 100)}% relevant
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveCase(caseItem);
                        }}
                        className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                          caseItem.saved
                            ? 'text-yellow-500'
                            : 'text-gray-400'
                        }`}
                        title={caseItem.saved ? 'Remove from saved' : 'Save case'}
                      >
                        {caseItem.saved ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
                      </button>
                      
                      {caseItem.url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(caseItem.url, '_blank');
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="View on CourtListener"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {caseItem.summary && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
                      {caseItem.summary}
                    </p>
                  )}

                  {caseItem.key_points && caseItem.key_points.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {caseItem.key_points.slice(0, 3).map((point, index) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                        >
                          {point}
                        </span>
                      ))}
                      {caseItem.key_points.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{caseItem.key_points.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {activeTab === 'search' && totalPages > 1 && (
              <div className="flex items-center justify-between mt-8">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setCurrentPage(prev => Math.max(1, prev - 1));
                      performSearch();
                    }}
                    disabled={currentPage === 1 || loading}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <span className="px-3 py-1 text-sm">
                    {currentPage}
                  </span>
                  
                  <button
                    onClick={() => {
                      setCurrentPage(prev => Math.min(totalPages, prev + 1));
                      performSearch();
                    }}
                    disabled={currentPage === totalPages || loading}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseLawBrowser;