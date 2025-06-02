'use client';

import { useState } from 'react';
import { 
  Microscope, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Target,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeepResearchResultsProps {
  data: {
    synthesis?: string;
    keyFindings?: Array<{
      finding: string;
      confidence: number;
      sources: string[];
    }>;
    themes?: Array<{
      theme: string;
      description: string;
      relevance: number;
    }>;
    contradictions?: Array<{
      point: string;
      sources: Array<{
        url: string;
        position: string;
      }>;
    }>;
    gaps?: string[];
    recommendations?: string[];
    sources?: Array<{
      url: string;
      title: string;
      confidence: number;
    }>;
    metadata?: {
      totalSources: number;
      successfulExtractions: number;
      model: string;
      timestamp: string;
    };
  };
}

export default function DeepResearchResults({ data }: DeepResearchResultsProps) {
  const [activeTab, setActiveTab] = useState('synthesis');
  const [showAllSources, setShowAllSources] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['synthesis']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (confidence >= 0.5) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfidenceEmoji = (confidence: number) => {
    if (confidence >= 0.9) return '🟢';
    if (confidence >= 0.7) return '🟡';
    if (confidence >= 0.5) return '🟠';
    return '🔴';
  };

  const getRelevanceBar = (relevance: number) => {
    const filled = Math.round(relevance * 10);
    const empty = 10 - filled;
    return (
      <div className="flex items-center space-x-2">
        <div className="flex">
          {Array(filled).fill(0).map((_, i) => (
            <div key={i} className="w-2 h-4 bg-blue-500 mr-0.5 rounded-sm" />
          ))}
          {Array(empty).fill(0).map((_, i) => (
            <div key={i} className="w-2 h-4 bg-gray-200 mr-0.5 rounded-sm" />
          ))}
        </div>
        <span className="text-sm text-gray-600">{Math.round(relevance * 100)}%</span>
      </div>
    );
  };

  const tabs = [
    { id: 'synthesis', label: 'Synthesis', icon: <Target size={16} /> },
    { id: 'findings', label: 'Key Findings', icon: <CheckCircle size={16} /> },
    { id: 'themes', label: 'Themes', icon: <TrendingUp size={16} /> },
    { id: 'contradictions', label: 'Contradictions', icon: <AlertTriangle size={16} /> },
    { id: 'insights', label: 'Insights', icon: <Lightbulb size={16} /> },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Microscope className="text-blue-600 dark:text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Deep Research Analysis
            </h2>
            {data.metadata && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {data.metadata.successfulExtractions} of {data.metadata.totalSources} sources analyzed • 
                Model: {data.metadata.model} • 
                {new Date(data.metadata.timestamp).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Research Stats */}
        {data.metadata && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {data.metadata.successfulExtractions}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Sources Analyzed</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {data.keyFindings?.length || 0}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Key Findings</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {data.themes?.length || 0}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Major Themes</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {data.contradictions?.length || 0}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Contradictions</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="space-y-6">
        {/* Synthesis Tab */}
        {activeTab === 'synthesis' && data.synthesis && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
            <div className="flex items-center space-x-2 mb-4">
              <Target className="text-blue-600 dark:text-blue-400" size={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Research Synthesis
              </h3>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ 
                __html: data.synthesis.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              }} />
            </div>
          </div>
        )}

        {/* Key Findings Tab */}
        {activeTab === 'findings' && data.keyFindings && (
          <div className="space-y-4">
            {data.keyFindings.map((finding, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
                <div className="flex items-start space-x-4">
                  <div className={cn(
                    'flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium border',
                    getConfidenceColor(finding.confidence)
                  )}>
                    {getConfidenceEmoji(finding.confidence)} {Math.round(finding.confidence * 100)}%
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {finding.finding}
                    </h4>
                    {finding.sources.length > 0 && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Supporting sources:</span> {finding.sources.length}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Themes Tab */}
        {activeTab === 'themes' && data.themes && (
          <div className="space-y-4">
            {data.themes.map((theme, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {theme.theme}
                    </h4>
                    {getRelevanceBar(theme.relevance)}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">
                    {theme.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contradictions Tab */}
        {activeTab === 'contradictions' && data.contradictions && (
          <div className="space-y-4">
            {data.contradictions.length > 0 ? (
              data.contradictions.map((contradiction, idx) => (
                <div key={idx} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-1" size={20} />
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-red-900 dark:text-red-100 mb-3">
                        {contradiction.point}
                      </h4>
                      <div className="space-y-2">
                        {contradiction.sources.map((source, sourceIdx) => (
                          <div key={sourceIdx} className="bg-white dark:bg-gray-800 rounded p-3 border">
                            <div className="flex items-center space-x-2 mb-1">
                              <ExternalLink size={14} />
                              <a 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                              >
                                {source.url}
                              </a>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="font-medium">Position:</span> {source.position}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800 text-center">
                <CheckCircle className="text-green-600 dark:text-green-400 mx-auto mb-2" size={32} />
                <h4 className="text-lg font-medium text-green-900 dark:text-green-100 mb-1">
                  No Contradictions Found
                </h4>
                <p className="text-green-700 dark:text-green-300">
                  All sources align consistently on this topic.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            {data.gaps && data.gaps.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center space-x-2 mb-3">
                  <BarChart3 className="text-yellow-600 dark:text-yellow-400" size={20} />
                  <h4 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                    Information Gaps
                  </h4>
                </div>
                <ul className="space-y-2">
                  {data.gaps.map((gap, idx) => (
                    <li key={idx} className="text-yellow-800 dark:text-yellow-200 flex items-start space-x-2">
                      <span className="text-yellow-600 dark:text-yellow-400 mt-1">•</span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.recommendations && data.recommendations.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center space-x-2 mb-3">
                  <Lightbulb className="text-blue-600 dark:text-blue-400" size={20} />
                  <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    Recommendations
                  </h4>
                </div>
                <ul className="space-y-2">
                  {data.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-blue-800 dark:text-blue-200 flex items-start space-x-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sources Section */}
      {data.sources && data.sources.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Research Sources ({data.sources.length})
              </h3>
              <button
                onClick={() => setShowAllSources(!showAllSources)}
                className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {showAllSources ? <EyeOff size={16} /> : <Eye size={16} />}
                <span className="text-sm">
                  {showAllSources ? 'Hide' : 'Show'} all sources
                </span>
              </button>
            </div>
          </div>
          
          {showAllSources && (
            <div className="p-6 space-y-3">
              {data.sources.map((source, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {source.title || source.url}
                    </a>
                  </div>
                  <div className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    getConfidenceColor(source.confidence || 1.0)
                  )}>
                    {Math.round((source.confidence || 1.0) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}