'use client';

import { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  FileText, 
  Scale, 
  Eye, 
  PenTool,
  ArrowRight,
  Sparkles,
  Clock,
  Target,
  X
} from 'lucide-react';
import { useMatter } from '@/contexts/MatterContext';

interface Document {
  id: string;
  name: string;
  type: string;
  content?: string;
  tags?: string[];
}

interface AgentSuggestion {
  id: string;
  agentType: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  confidence: number;
  estimatedTime: string;
  suggestedQuery: string;
  relevantDocuments: Document[];
  reasoning: string;
}

interface SmartAgentSuggestionsProps {
  documents: Document[];
  onAgentSuggest: (agentType: string, documents: Document[], query: string) => void;
  onDismiss?: () => void;
  maxSuggestions?: number;
}

const SmartAgentSuggestions = ({ 
  documents, 
  onAgentSuggest, 
  onDismiss,
  maxSuggestions = 3 
}: SmartAgentSuggestionsProps) => {
  const { currentMatter } = useMatter();
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (documents.length > 0) {
      generateSuggestions();
    }
  }, [documents, currentMatter]);

  const analyzeDocumentContent = (docs: Document[]): {
    hasContracts: boolean;
    hasLegalDocs: boolean;
    hasDiscoveryDocs: boolean;
    hasResearchMaterials: boolean;
    documentTypes: string[];
    totalSize: number;
  } => {
    const analysis = {
      hasContracts: false,
      hasLegalDocs: false,
      hasDiscoveryDocs: false,
      hasResearchMaterials: false,
      documentTypes: [] as string[],
      totalSize: docs.length
    };

    docs.forEach(doc => {
      const name = doc.name.toLowerCase();
      const content = doc.content?.toLowerCase() || '';
      
      analysis.documentTypes.push(doc.type);
      
      // Contract detection
      if (
        name.includes('contract') || 
        name.includes('agreement') || 
        name.includes('nda') ||
        content.includes('whereas') ||
        content.includes('party') ||
        content.includes('consideration')
      ) {
        analysis.hasContracts = true;
      }
      
      // Legal document detection
      if (
        name.includes('brief') ||
        name.includes('motion') ||
        name.includes('pleading') ||
        name.includes('legal') ||
        content.includes('plaintiff') ||
        content.includes('defendant') ||
        content.includes('court')
      ) {
        analysis.hasLegalDocs = true;
      }
      
      // Discovery document detection
      if (
        name.includes('discovery') ||
        name.includes('deposition') ||
        name.includes('interrogat') ||
        name.includes('production') ||
        doc.type === 'pdf' && docs.length > 5
      ) {
        analysis.hasDiscoveryDocs = true;
      }
      
      // Research material detection
      if (
        name.includes('research') ||
        name.includes('case') ||
        name.includes('statute') ||
        name.includes('law') ||
        content.includes('citation') ||
        content.includes('precedent')
      ) {
        analysis.hasResearchMaterials = true;
      }
    });

    return analysis;
  };

  const generateSuggestions = () => {
    setLoading(true);
    
    const analysis = analyzeDocumentContent(documents);
    const newSuggestions: AgentSuggestion[] = [];
    
    // Contract Analysis Suggestion
    if (analysis.hasContracts) {
      const contractDocs = documents.filter(doc => 
        doc.name.toLowerCase().includes('contract') ||
        doc.name.toLowerCase().includes('agreement') ||
        doc.name.toLowerCase().includes('nda')
      );
      
      newSuggestions.push({
        id: 'contract-analysis',
        agentType: 'contract',
        title: 'Contract Analysis',
        description: 'Review contract terms, identify risks, and extract key obligations',
        icon: FileText,
        color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
        confidence: contractDocs.length > 0 ? 95 : 75,
        estimatedTime: `${Math.ceil(contractDocs.length * 1.5)} min`,
        suggestedQuery: `Analyze ${contractDocs.length > 0 ? 'the uploaded contracts' : 'these documents as potential contracts'} for key terms, obligations, risks, and compliance requirements${currentMatter ? ` in the context of ${currentMatter.name}` : ''}.`,
        relevantDocuments: contractDocs.length > 0 ? contractDocs : documents.slice(0, 3),
        reasoning: `Detected ${contractDocs.length} contract-related documents. Contract analysis will help identify key terms, risks, and compliance requirements.`
      });
    }
    
    // Discovery Review Suggestion
    if (analysis.hasDiscoveryDocs || documents.length >= 5) {
      newSuggestions.push({
        id: 'discovery-review',
        agentType: 'discovery',
        title: 'Discovery Review',
        description: 'Privilege review, relevance assessment, and key information extraction',
        icon: Eye,
        color: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200',
        confidence: analysis.hasDiscoveryDocs ? 90 : 70,
        estimatedTime: `${Math.ceil(documents.length * 0.5)} min`,
        suggestedQuery: `Review these ${documents.length} documents for privilege, relevance, and key information. Identify potentially privileged communications and extract important facts${currentMatter ? ` relevant to ${currentMatter.name}` : ''}.`,
        relevantDocuments: documents,
        reasoning: `With ${documents.length} documents uploaded, discovery review will help organize and analyze the materials for privilege and relevance.`
      });
    }
    
    // Legal Research Suggestion
    if (analysis.hasResearchMaterials || analysis.hasLegalDocs) {
      const researchDocs = documents.filter(doc => 
        doc.name.toLowerCase().includes('research') ||
        doc.name.toLowerCase().includes('case') ||
        doc.name.toLowerCase().includes('legal')
      );
      
      newSuggestions.push({
        id: 'legal-research',
        agentType: 'research',
        title: 'Legal Research Enhancement',
        description: 'Extract legal concepts, find related cases, and build research foundation',
        icon: Scale,
        color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200',
        confidence: researchDocs.length > 0 ? 85 : 65,
        estimatedTime: `${Math.ceil((researchDocs.length || documents.length) * 2)} min`,
        suggestedQuery: `Extract key legal concepts and issues from these documents. Find related case law and statutes${currentMatter ? ` relevant to ${currentMatter.practice_area || 'this matter'}` : ''}. Build a comprehensive research foundation.`,
        relevantDocuments: researchDocs.length > 0 ? researchDocs : documents.slice(0, 2),
        reasoning: `Legal documents detected. Research enhancement will help identify key legal issues and find supporting authorities.`
      });
    }
    
    // Brief Writing Suggestion
    if (analysis.hasLegalDocs || currentMatter) {
      newSuggestions.push({
        id: 'brief-writing',
        agentType: 'brief-writing',
        title: 'Document Synthesis',
        description: 'Create comprehensive briefs, memos, and summaries from your documents',
        icon: PenTool,
        color: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200',
        confidence: analysis.hasLegalDocs ? 80 : 60,
        estimatedTime: `${Math.ceil(documents.length * 1)} min`,
        suggestedQuery: `Synthesize these documents into a comprehensive ${currentMatter ? 'legal memorandum' : 'summary'}. Extract key facts, legal issues, and recommendations${currentMatter ? ` for ${currentMatter.name}` : ''}.`,
        relevantDocuments: documents.slice(0, 5),
        reasoning: `Multiple documents can be synthesized into a coherent legal analysis or summary to support your case strategy.`
      });
    }
    
    // Sort by confidence and limit results
    const sortedSuggestions = newSuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);
    
    setSuggestions(sortedSuggestions);
    setLoading(false);
  };

  const handleSuggestionClick = (suggestion: AgentSuggestion) => {
    setSelectedSuggestion(suggestion.id);
    onAgentSuggest(suggestion.agentType, suggestion.relevantDocuments, suggestion.suggestedQuery);
    
    // Reset selection after a brief moment
    setTimeout(() => {
      setSelectedSuggestion(null);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            Analyzing Documents...
          </h3>
        </div>
        <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-600" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            Smart Agent Suggestions
          </h3>
          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
            AI-Powered
          </span>
        </div>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-white hover:bg-opacity-50 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Based on your {documents.length} uploaded document{documents.length !== 1 ? 's' : ''}, here are the most relevant agent workflows:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon;
          const isSelected = selectedSuggestion === suggestion.id;
          
          return (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`
                p-4 rounded-lg border transition-all duration-200 text-left group
                ${isSelected 
                  ? 'ring-2 ring-blue-500 ring-opacity-50 transform scale-[0.98]' 
                  : `${suggestion.color} hover:shadow-md hover:transform hover:scale-[1.02]`
                }
              `}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-white bg-opacity-70' : 'bg-white bg-opacity-50'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">
                      {suggestion.title}
                    </h4>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        {suggestion.confidence}% match
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">
                        {suggestion.estimatedTime}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-xs opacity-75 mb-3">
                {suggestion.description}
              </p>
              
              <div className="text-xs opacity-60 bg-white bg-opacity-30 rounded p-2">
                <strong>Why suggested:</strong> {suggestion.reasoning}
              </div>
              
              {isSelected && (
                <div className="mt-3 flex items-center gap-1 text-xs opacity-75">
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  <span className="ml-2">Launching agent...</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {currentMatter && (
        <div className="mt-4 text-xs text-gray-600 dark:text-gray-400 bg-white bg-opacity-30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            <span>
              Suggestions are tailored for <strong>{currentMatter.name}</strong>
              {currentMatter.practice_area && ` (${currentMatter.practice_area})`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartAgentSuggestions;