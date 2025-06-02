'use client';

import { useState, useEffect } from 'react';
import { LegalAgent, AgentCapability } from '@/lib/agents/types';

interface AgentSelectorProps {
  onAgentSelect: (agentType: string, capability?: string) => void;
  selectedAgent?: string;
  query: string;
}

export default function AgentSelector({ onAgentSelect, selectedAgent, query }: AgentSelectorProps) {
  const [agents] = useState<LegalAgent[]>([
    {
      id: 'research-agent',
      type: 'research',
      name: 'Legal Research Agent',
      description: 'Comprehensive legal research using case law databases, statutes, and web sources',
      capabilities: [
        {
          name: 'Case Law Search',
          description: 'Search federal and state cases using CourtListener',
          inputTypes: ['query', 'jurisdiction', 'date_range'],
          outputTypes: ['cases', 'citations', 'analysis'],
          estimatedDuration: 45
        },
        {
          name: 'Statutory Research',
          description: 'Research statutes and regulations',
          inputTypes: ['query', 'jurisdiction', 'code_section'],
          outputTypes: ['statutes', 'regulations', 'analysis'],
          estimatedDuration: 30
        }
      ],
      requiredContext: [],
      execute: async () => ({ success: true, result: null }),
      validateInput: () => true,
      estimateDuration: () => 60,
      getRequiredPermissions: () => []
    },
    {
      id: 'document-drafting-agent',
      type: 'writing',
      name: 'Legal Document Drafting Agent',
      description: 'Generate legal documents including memoranda, briefs, and other legal writing',
      capabilities: [
        {
          name: 'Legal Memorandum',
          description: 'Generate comprehensive legal memoranda with proper citations',
          inputTypes: ['legal_issue', 'research_data', 'template_type'],
          outputTypes: ['formatted_memo', 'citations', 'outline'],
          estimatedDuration: 120
        },
        {
          name: 'Motion Drafting',
          description: 'Draft motions for various legal proceedings',
          inputTypes: ['motion_type', 'facts', 'legal_authority'],
          outputTypes: ['motion_document', 'supporting_brief', 'citations'],
          estimatedDuration: 150
        }
      ],
      requiredContext: ['matter_info'],
      execute: async () => ({ success: true, result: null }),
      validateInput: () => true,
      estimateDuration: () => 120,
      getRequiredPermissions: () => []
    },
    {
      id: 'discovery-agent',
      type: 'review',
      name: 'Discovery Review Agent',
      description: 'Automated document review, privilege identification, and discovery management',
      capabilities: [
        {
          name: 'Document Review',
          description: 'Automated review of documents for responsiveness and privilege',
          inputTypes: ['documents', 'review_criteria', 'privilege_rules'],
          outputTypes: ['review_results', 'privilege_log', 'responsive_docs'],
          estimatedDuration: 180
        },
        {
          name: 'Privilege Identification',
          description: 'Identify attorney-client privileged communications',
          inputTypes: ['documents', 'attorney_list', 'client_list'],
          outputTypes: ['privilege_log', 'privileged_docs', 'waiver_analysis'],
          estimatedDuration: 120
        }
      ],
      requiredContext: ['matter_info', 'discovery_requests'],
      execute: async () => ({ success: true, result: null }),
      validateInput: () => true,
      estimateDuration: () => 180,
      getRequiredPermissions: () => []
    },
    {
      id: 'document-analysis-agent',
      type: 'analysis',
      name: 'Document Analysis Agent',
      description: 'Comprehensive legal document analysis with visual highlighting and interactive Q&A',
      capabilities: [
        {
          name: 'Interactive Document Analysis',
          description: 'Analyze any legal document with visual highlighting and references',
          inputTypes: ['document', 'user_question'],
          outputTypes: ['analysis', 'highlights', 'references', 'document_positions'],
          estimatedDuration: 30
        },
        {
          name: 'Document Type Detection',
          description: 'Automatically detect and adapt analysis for different document types',
          inputTypes: ['document'],
          outputTypes: ['document_type', 'analysis_strategy'],
          estimatedDuration: 10
        },
        {
          name: 'Section-by-Section Review',
          description: 'Detailed analysis of specific document sections with cross-references',
          inputTypes: ['document', 'section_reference'],
          outputTypes: ['section_analysis', 'cross_references', 'highlights'],
          estimatedDuration: 25
        }
      ],
      requiredContext: [],
      execute: async () => ({ success: true, result: null }),
      validateInput: () => true,
      estimateDuration: () => 30,
      getRequiredPermissions: () => []
    }
  ]);

  const [recommendedAgent, setRecommendedAgent] = useState<string | null>(null);
  const [selectedCapability, setSelectedCapability] = useState<string>('');

  useEffect(() => {
    if (query) {
      const recommendation = getAgentRecommendation(query);
      setRecommendedAgent(recommendation);
    }
  }, [query]);

  const getAgentRecommendation = (query: string): string | null => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('research') || lowerQuery.includes('find') || lowerQuery.includes('case law')) {
      return 'research-agent';
    } else if (lowerQuery.includes('write') || lowerQuery.includes('draft') || lowerQuery.includes('memo')) {
      return 'document-drafting-agent';
    } else if (lowerQuery.includes('discovery') || lowerQuery.includes('privilege') || lowerQuery.includes('review documents')) {
      return 'discovery-agent';
    } else if (lowerQuery.includes('contract') || lowerQuery.includes('agreement') || lowerQuery.includes('document') || lowerQuery.includes('analyze')) {
      return 'document-analysis-agent';
    }
    
    return null;
  };

  const handleAgentSelect = (agentId: string) => {
    setSelectedCapability('');
    onAgentSelect(agentId);
  };

  const handleCapabilitySelect = (agentId: string, capability: string) => {
    setSelectedCapability(capability);
    onAgentSelect(agentId, capability);
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <span>🤖</span>
        <span>Select an AI agent to handle your request</span>
        {recommendedAgent && (
          <span className="text-blue-600 dark:text-blue-400">
            (Recommended: {agents.find(a => a.id === recommendedAgent)?.name})
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedAgent === agent.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            } ${
              recommendedAgent === agent.id ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''
            }`}
            onClick={() => handleAgentSelect(agent.id)}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {agent.type === 'research' && '🔍'}
                {agent.type === 'writing' && '✍️'}
                {agent.type === 'review' && '📋'}
                {agent.type === 'analysis' && '🔬'}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {agent.name}
                  </h3>
                  {recommendedAgent === agent.id && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                      Recommended
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {agent.description}
                </p>

                {selectedAgent === agent.id && (
                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Available Capabilities:
                    </div>
                    {agent.capabilities.map((capability, index) => (
                      <div
                        key={index}
                        className={`p-2 border rounded cursor-pointer text-sm ${
                          selectedCapability === capability.name
                            ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCapabilitySelect(agent.id, capability.name);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {capability.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ~{formatDuration(capability.estimatedDuration)}
                          </span>
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 mt-1">
                          {capability.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{agent.capabilities.length} capabilities</span>
                  <span>
                    ~{formatDuration(Math.max(...agent.capabilities.map(c => c.estimatedDuration)))} max
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedAgent && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Selected:</strong> {agents.find(a => a.id === selectedAgent)?.name}
            {selectedCapability && (
              <>
                <br />
                <strong>Capability:</strong> {selectedCapability}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}