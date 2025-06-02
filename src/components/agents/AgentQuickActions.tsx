'use client';

import { useState } from 'react';
import { 
  Zap, 
  Scale, 
  FileText, 
  Search, 
  PenTool, 
  Eye,
  BarChart3,
  Briefcase,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useMatter } from '@/contexts/MatterContext';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  estimatedTime: string;
  agentType: string;
  defaultQuery?: string;
}

interface AgentQuickActionsProps {
  onQuickAction: (actionType: string, config: {
    agentType: string;
    query: string;
    matterId?: string;
  }) => void;
  disabled?: boolean;
}

const AgentQuickActions = ({ onQuickAction, disabled = false }: AgentQuickActionsProps) => {
  const { currentMatter } = useMatter();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const quickActions: QuickAction[] = [
    {
      id: 'research-case-law',
      label: 'Research Case Law',
      description: 'Find relevant cases and precedents',
      icon: Scale,
      color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
      estimatedTime: '2-3 min',
      agentType: 'research',
      defaultQuery: currentMatter 
        ? `Research case law relevant to ${currentMatter.practice_area || 'this matter'}: ${currentMatter.description || currentMatter.name}`
        : 'Research relevant case law and legal precedents'
    },
    {
      id: 'draft-memo',
      label: 'Draft Legal Memo',
      description: 'Generate a legal memorandum',
      icon: PenTool,
      color: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200',
      estimatedTime: '3-5 min',
      agentType: 'brief-writing',
      defaultQuery: currentMatter
        ? `Draft a legal memorandum for ${currentMatter.name}${currentMatter.description ? `: ${currentMatter.description}` : ''}`
        : 'Draft a comprehensive legal memorandum'
    },
    {
      id: 'review-documents',
      label: 'Review Documents',
      description: 'Analyze documents for privilege and relevance',
      icon: Eye,
      color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200',
      estimatedTime: '1-2 min',
      agentType: 'discovery',
      defaultQuery: 'Review uploaded documents for privilege, relevance, and key information'
    },
    {
      id: 'analyze-contract',
      label: 'Analyze Contract',
      description: 'Review contract terms and identify risks',
      icon: FileText,
      color: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200',
      estimatedTime: '2-4 min',
      agentType: 'contract',
      defaultQuery: 'Analyze contract terms, identify potential risks, and suggest improvements'
    },
    {
      id: 'matter-summary',
      label: 'Matter Summary',
      description: 'Generate comprehensive matter overview',
      icon: BarChart3,
      color: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200',
      estimatedTime: '1-2 min',
      agentType: 'research',
      defaultQuery: currentMatter
        ? `Generate a comprehensive summary of the matter: ${currentMatter.name}. Include key facts, legal issues, recent developments, and next steps.`
        : 'Generate a comprehensive matter summary with key facts and legal issues'
    },
    {
      id: 'draft-motion',
      label: 'Draft Motion',
      description: 'Create court filing documents',
      icon: Briefcase,
      color: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200',
      estimatedTime: '4-6 min',
      agentType: 'brief-writing',
      defaultQuery: currentMatter
        ? `Draft a motion for ${currentMatter.name}. Please specify the type of motion needed.`
        : 'Draft a motion for court filing. Please specify the type of motion needed.'
    }
  ];

  const handleActionClick = (action: QuickAction) => {
    if (disabled) return;
    
    setSelectedAction(action.id);
    
    const config = {
      agentType: action.agentType,
      query: action.defaultQuery || '',
      matterId: currentMatter?.id
    };
    
    onQuickAction(action.id, config);
    
    // Reset selection after a brief moment
    setTimeout(() => {
      setSelectedAction(null);
    }, 1000);
  };

  const getMatterContextActions = () => {
    if (!currentMatter) return quickActions;
    
    // Customize actions based on matter practice area
    const practiceArea = currentMatter.practice_area?.toLowerCase();
    
    if (practiceArea?.includes('contract')) {
      return [
        quickActions.find(a => a.id === 'analyze-contract')!,
        quickActions.find(a => a.id === 'research-case-law')!,
        quickActions.find(a => a.id === 'draft-memo')!,
        quickActions.find(a => a.id === 'matter-summary')!
      ];
    }
    
    if (practiceArea?.includes('litigation')) {
      return [
        quickActions.find(a => a.id === 'research-case-law')!,
        quickActions.find(a => a.id === 'draft-motion')!,
        quickActions.find(a => a.id === 'review-documents')!,
        quickActions.find(a => a.id === 'matter-summary')!
      ];
    }
    
    return quickActions;
  };

  const displayActions = getMatterContextActions();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-600" />
        <h3 className="font-medium text-gray-900 dark:text-white">
          Quick Actions
        </h3>
        {currentMatter && (
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
            {currentMatter.name}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayActions.map((action) => {
          const Icon = action.icon;
          const isSelected = selectedAction === action.id;
          const isDisabled = disabled;
          
          return (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              disabled={isDisabled}
              className={`
                p-4 rounded-lg border transition-all duration-200 text-left group
                ${isSelected 
                  ? 'ring-2 ring-blue-500 ring-opacity-50 transform scale-[0.98]' 
                  : ''
                }
                ${isDisabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : `${action.color} hover:shadow-md hover:transform hover:scale-[1.02]`
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-white bg-opacity-70' : 'bg-white bg-opacity-50'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">
                      {action.label}
                    </h4>
                    {!isDisabled && (
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  
                  <p className="text-xs opacity-75 mb-2">
                    {action.description}
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs opacity-60">
                    <Clock className="w-3 h-3" />
                    <span>{action.estimatedTime}</span>
                  </div>
                </div>
              </div>
              
              {isSelected && (
                <div className="mt-2 flex items-center gap-1 text-xs opacity-75">
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  <span className="ml-2">Launching...</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!currentMatter && (
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            <span>
              <strong>Tip:</strong> Select a matter to get contextual quick actions tailored to your practice area.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentQuickActions;