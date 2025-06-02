'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useMatter } from '@/contexts/MatterContext';
import { supabase } from '@/lib/supabase/client';
import { 
  Scale, 
  Search, 
  Star,
  Calendar, 
  ExternalLink,
  Plus,
  BookOpen,
  Filter,
  Download,
  FileText,
  Trash2,
  AlertCircle
} from 'lucide-react';

interface MatterCase {
  id: string;
  case_name: string;
  citation: string;
  court: string;
  decision_date: string;
  url?: string;
  summary?: string;
  key_points?: string[];
  notes?: string;
  relevance_to_matter?: string;
  saved_at: string;
  research_session_id?: string;
}

const MatterCasesPage = () => {
  const params = useParams();
  const matterId = params.matterId as string;
  const { currentMatter } = useMatter();
  const [cases, setCases] = useState<MatterCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    loadMatterCases();
  }, [matterId]);

  const loadMatterCases = async () => {
    try {
      setLoading(true);
      
      // Get research sessions for this matter
      const { data: researchSessions, error: sessionsError } = await supabase
        .from('research_sessions')
        .select('id, selected_citations, notes, created_at')
        .eq('matter_id', matterId);

      if (sessionsError) throw sessionsError;

      // Extract all case citation IDs
      const citationIds = researchSessions
        ?.flatMap(session => session.selected_citations || [])
        .filter(Boolean) || [];

      if (citationIds.length === 0) {
        setCases([]);
        setLoading(false);
        return;
      }

      // Get the actual case data
      const { data: caseData, error: casesError } = await supabase
        .from('case_citations')
        .select('*')
        .in('id', citationIds);

      if (casesError) throw casesError;

      // Map cases with their research session context
      const matterCases: MatterCase[] = (caseData || []).map(caseItem => {
        // Find the research session this case was saved in
        const relevantSession = researchSessions?.find(session => 
          session.selected_citations?.includes(caseItem.id)
        );

        return {
          id: caseItem.id,
          case_name: caseItem.case_name,
          citation: caseItem.citation,
          court: caseItem.court,
          decision_date: caseItem.decision_date,
          summary: caseItem.summary,
          key_points: caseItem.key_points,
          url: caseItem.metadata?.absolute_url ? `https://www.courtlistener.com${caseItem.metadata.absolute_url}` : undefined,
          notes: relevantSession?.notes,
          saved_at: relevantSession?.created_at || caseItem.created_at,
          research_session_id: relevantSession?.id,
          relevance_to_matter: caseItem.metadata?.relevance_to_matter
        };
      });

      // Sort by most recently saved
      matterCases.sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());

      setCases(matterCases);
    } catch (error) {
      console.error('Error loading matter cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeCaseFromMatter = async (caseId: string) => {
    if (!confirm('Remove this case from the matter? This will not delete the case from your library.')) {
      return;
    }

    try {
      // Find the research session containing this case
      const caseToRemove = cases.find(c => c.id === caseId);
      if (!caseToRemove?.research_session_id) return;

      const { data: session } = await supabase
        .from('research_sessions')
        .select('selected_citations')
        .eq('id', caseToRemove.research_session_id)
        .single();

      if (session) {
        const updatedCitations = (session.selected_citations || []).filter((id: string) => id !== caseId);
        
        if (updatedCitations.length === 0) {
          // If no more citations, delete the session
          await supabase
            .from('research_sessions')
            .delete()
            .eq('id', caseToRemove.research_session_id);
        } else {
          // Update the session with remaining citations
          await supabase
            .from('research_sessions')
            .update({ selected_citations: updatedCitations })
            .eq('id', caseToRemove.research_session_id);
        }
      }

      // Reload the cases
      await loadMatterCases();
    } catch (error) {
      console.error('Error removing case from matter:', error);
    }
  };

  const exportCases = async () => {
    const selectedCaseData = selectedCases.size > 0 
      ? cases.filter(c => selectedCases.has(c.id))
      : cases;

    if (selectedCaseData.length === 0) return;

    // Generate markdown report
    const report = `# Case Law Library - ${currentMatter?.name || 'Matter'}

Generated: ${new Date().toLocaleDateString()}
Total Cases: ${selectedCaseData.length}

---

${selectedCaseData.map((caseItem, index) => `
## ${index + 1}. ${caseItem.case_name}

**Citation:** ${caseItem.citation}
**Court:** ${caseItem.court}
**Date:** ${new Date(caseItem.decision_date).toLocaleDateString()}
**Saved:** ${new Date(caseItem.saved_at).toLocaleDateString()}

${caseItem.summary ? `**Summary:**\n${caseItem.summary}\n` : ''}

${caseItem.key_points?.length ? `**Key Points:**\n${caseItem.key_points.map(point => `- ${point}`).join('\n')}\n` : ''}

${caseItem.notes ? `**Research Notes:**\n${caseItem.notes}\n` : ''}

${caseItem.url ? `**Source:** [View on CourtListener](${caseItem.url})\n` : ''}

---
`).join('')}

*Generated by BenchWise Legal Research Platform*
`;

    // Download as markdown file
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentMatter?.name || 'Matter'}_Case_Library_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredCases = cases.filter(caseItem =>
    caseItem.case_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    caseItem.citation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    caseItem.court?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    caseItem.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleCaseSelection = (caseId: string) => {
    setSelectedCases(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      setShowBulkActions(next.size > 0);
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Case Library
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Cases saved for this matter ({cases.length} total)
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {cases.length > 0 && (
            <>
              <button
                onClick={exportCases}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Library
              </button>
              
              <a
                href="/cases"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Cases
              </a>
            </>
          )}
        </div>
      </div>

      {/* Search and Bulk Actions */}
      {cases.length > 0 && (
        <>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search cases in this matter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {showBulkActions && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCases.size} selected
                </span>
                <button
                  onClick={exportCases}
                  className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Export Selected
                </button>
                <button
                  onClick={() => {
                    setSelectedCases(new Set());
                    setShowBulkActions(false);
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Cases List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-4">Loading cases...</p>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-12">
          <Scale className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery ? 'No cases found' : 'No cases saved for this matter'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Use legal research or case law search to find and save relevant cases'
            }
          </p>
          {!searchQuery && (
            <a
              href="/cases"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search className="w-4 h-4" />
              Search Case Law
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCases.map((caseItem) => (
            <div
              key={caseItem.id}
              className={`border rounded-lg p-6 transition-all ${
                selectedCases.has(caseItem.id)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:shadow-lg bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Selection Checkbox */}
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={selectedCases.has(caseItem.id)}
                    onChange={() => toggleCaseSelection(caseItem.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </div>

                {/* Case Content */}
                <div className="flex-1">
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
                        <span className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                          {caseItem.citation}
                        </span>
                        <span className="text-green-600 dark:text-green-400 text-xs">
                          Saved {formatDate(caseItem.saved_at)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {caseItem.url && (
                        <button
                          onClick={() => window.open(caseItem.url, '_blank')}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="View on CourtListener"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => removeCaseFromMatter(caseItem.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Remove from matter"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {caseItem.summary && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      {caseItem.summary}
                    </p>
                  )}

                  {caseItem.notes && (
                    <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-400">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>Research Notes:</strong> {caseItem.notes}
                      </p>
                    </div>
                  )}

                  {caseItem.key_points && caseItem.key_points.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {caseItem.key_points.map((point, index) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MatterCasesPage;