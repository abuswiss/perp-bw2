'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Calendar,
  TrendingUp,
  FileText,
  Users,
  Scale
} from 'lucide-react';

interface TimelinePhase {
  id: string;
  name: string;
  description: string;
  order: number;
  duration: {
    min: number;
    max: number;
    typical: number;
    unit: 'days' | 'weeks' | 'months';
  };
  costRange: {
    min: number;
    max: number;
  };
  keyActions: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'immediate' | 'short_term' | 'preparation';
  }>;
  settlementProbability: number;
  risks: Array<{
    type: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

interface LegalTimelineProps {
  timeline: {
    summary: {
      caseType: string;
      estimatedDuration: string;
      totalCostRange: string;
      strengthAssessment: string;
      primaryRecommendation: string;
    };
    phases: TimelinePhase[];
    nextSteps: {
      immediate: Array<{
        title: string;
        description: string;
        priority: string;
      }>;
    };
    alternativeDisputes?: Array<{
      type: string;
      description: string;
      estimatedCost: string;
      estimatedDuration: string;
      successRate: number;
    }>;
    criticalDeadlines?: Array<{
      description: string;
      daysFromNow: number;
      isCritical: boolean;
    }>;
  };
}

export const LegalTimelineVisualization: React.FC<LegalTimelineProps> = ({ timeline }) => {
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'summary' | 'actions'>('summary');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStrengthColor = (strength: string) => {
    switch (strength.toLowerCase()) {
      case 'strong': return 'text-green-600 bg-green-100';
      case 'moderate': return 'text-yellow-600 bg-yellow-100';
      case 'weak': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'immediate': return 'border-red-500 bg-red-50';
      case 'short_term': return 'border-orange-500 bg-orange-50';
      case 'preparation': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-white dark:bg-dark-100 rounded-lg border border-gray-200 dark:border-dark-200">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-dark-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Scale className="h-8 w-8 text-[#24A0ED]" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Legal Timeline Analysis
          </h2>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-dark-200 rounded-lg p-1">
          {[
            { id: 'summary', label: 'Executive Summary', icon: FileText },
            { id: 'timeline', label: 'Timeline Phases', icon: Clock },
            { id: 'actions', label: 'Next Steps', icon: CheckCircle }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === id
                  ? 'bg-white dark:bg-dark-100 text-[#24A0ED] shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Executive Summary Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Case Type</span>
                </div>
                <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  {timeline.summary.caseType}
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">Duration</span>
                </div>
                <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                  {timeline.summary.estimatedDuration}
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Cost Range</span>
                </div>
                <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                  {timeline.summary.totalCostRange}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Assessment</span>
                </div>
                <span className={cn(
                  'inline-block px-3 py-1 rounded-full text-sm font-medium',
                  getStrengthColor(timeline.summary.strengthAssessment)
                )}>
                  {timeline.summary.strengthAssessment}
                </span>
              </div>
            </div>

            {/* Recommendation */}
            <div className="bg-[#24A0ED]/10 border border-[#24A0ED]/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Primary Recommendation
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                {timeline.summary.primaryRecommendation}
              </p>
            </div>

            {/* Critical Deadlines */}
            {timeline.criticalDeadlines && timeline.criticalDeadlines.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
                    Critical Deadlines
                  </h3>
                </div>
                <div className="space-y-2">
                  {timeline.criticalDeadlines
                    .filter(deadline => deadline.isCritical)
                    .map((deadline, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-red-800 dark:text-red-200">{deadline.description}</span>
                        <span className="bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded text-sm font-medium">
                          {deadline.daysFromNow} days
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timeline Phases Tab */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            {timeline.phases.map((phase, index) => (
              <div
                key={phase.id}
                className={cn(
                  'border rounded-lg p-4 cursor-pointer transition-all',
                  selectedPhase === phase.id
                    ? 'border-[#24A0ED] bg-[#24A0ED]/5'
                    : 'border-gray-200 dark:border-dark-200 hover:border-[#24A0ED]/50'
                )}
                onClick={() => setSelectedPhase(selectedPhase === phase.id ? null : phase.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-[#24A0ED] text-white text-sm font-bold px-2 py-1 rounded">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {phase.name}
                      </h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {phase.description}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>{phase.duration.typical} {phase.duration.unit}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        <span>{formatCurrency(phase.costRange.min)} - {formatCurrency(phase.costRange.max)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-500" />
                        <span>{Math.round(phase.settlementProbability * 100)}% settlement probability</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Phase Details */}
                {selectedPhase === phase.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-200">
                    {phase.keyActions.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Key Actions:</h4>
                        <div className="space-y-2">
                          {phase.keyActions.map((action) => (
                            <div key={action.id} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium text-gray-900 dark:text-white">{action.title}</span>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{action.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {phase.risks.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Risk Factors:</h4>
                        <div className="space-y-2">
                          {phase.risks.map((risk, riskIndex) => (
                            <div key={riskIndex} className="flex items-start gap-2">
                              <AlertTriangle className={cn(
                                'h-4 w-4 mt-0.5 flex-shrink-0',
                                risk.type === 'high' ? 'text-red-500' :
                                risk.type === 'medium' ? 'text-yellow-500' : 'text-gray-500'
                              )} />
                              <span className="text-sm text-gray-600 dark:text-gray-400">{risk.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Next Steps Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-6">
            {/* Immediate Actions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Immediate Actions (This Week)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {timeline.nextSteps.immediate.map((action, index) => (
                  <div
                    key={index}
                    className={cn(
                      'border-l-4 p-4 rounded-r-lg',
                      getPriorityColor(action.priority)
                    )}
                  >
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                      {action.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {action.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Alternative Dispute Resolution */}
            {timeline.alternativeDisputes && timeline.alternativeDisputes.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Alternative Resolution Options
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {timeline.alternativeDisputes.map((option, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2 uppercase text-sm">
                        {option.type}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {option.description}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="block text-gray-500">Cost</span>
                          <span className="font-medium">{option.estimatedCost}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500">Duration</span>
                          <span className="font-medium">{option.estimatedDuration}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500">Success Rate</span>
                          <span className="font-medium">{Math.round(option.successRate * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};