'use client';

import { useState, useEffect } from 'react';
import { Scale, Search, BookOpen, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

const CasesPage = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const { data, error } = await supabase
        .from('case_citations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCases(data || []);
    } catch (error) {
      console.error('Error loading cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = cases.filter(caseItem =>
    caseItem.case_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    caseItem.citation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    caseItem.court?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Case Law Library
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your saved cases and legal precedents
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search cases by name, citation, or court..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-12">
          <Scale className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery ? 'No cases found matching your search' : 'No saved cases yet'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Cases will appear here as you research
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCases.map((caseItem) => (
            <div
              key={caseItem.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  {caseItem.case_name}
                </h3>
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  {caseItem.citation}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                  <Scale className="w-4 h-4" />
                  {caseItem.court}
                </span>
                {caseItem.decision_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(caseItem.decision_date).toLocaleDateString()}
                  </span>
                )}
              </div>

              {caseItem.summary && (
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                  {caseItem.summary}
                </p>
              )}

              {caseItem.key_points && caseItem.key_points.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {caseItem.key_points.slice(0, 3).map((point: string, index: number) => (
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
          ))}
        </div>
      )}
    </div>
  );
};

export default CasesPage;