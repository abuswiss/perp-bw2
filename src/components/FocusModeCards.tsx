'use client';

import {
  Scale,
  FileText,
  Search,
  FileCheck,
  SwatchBook,
  Globe,
  Pencil,
  Clock,
  Microscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DEEP_RESEARCH_DISABLED = true;
const WRITING_ASSISTANT_DISABLED = true;

const focusModes = [
  {
    key: 'legalResearch',
    title: 'Legal Research',
    description: 'Search case law and statutes',
    icon: <Scale size={24} />,
    category: 'legal',
    popular: true,
  },
  {
    key: 'briefWriting',
    title: 'Document Drafting',
    description: 'Generate legal documents - from brief summaries to comprehensive analyses',
    icon: <FileText size={24} />,
    category: 'legal',
    popular: false,
  },
  {
    key: 'documentAnalysis',
    title: 'Document Analysis',
    description: 'Interactive analysis of any legal document with side-by-side viewer',
    icon: <FileCheck size={24} />,
    category: 'legal',
    popular: false,
  },
  {
    key: 'discovery',
    title: 'Discovery',
    description: 'Analyze documents for discovery',
    icon: <Search size={24} />,
    category: 'legal',
    popular: false,
    isPro: true,
  },
  {
    key: 'legalTimeline',
    title: 'Timeline Generator',
    description: 'Generate litigation timelines from case descriptions',
    icon: <Clock size={24} />,
    category: 'legal',
    popular: false,
  },
  {
    key: 'deepLegalResearch',
    title: 'Deep Legal Research',
    description: 'In-depth multi-source legal analysis: cases, statutes, and academic papers with intelligent synthesis.',
    icon: <Microscope size={24} />,
    category: 'research',
    popular: false,
    isPro: true,
  },
  {
    key: 'academicSearch',
    title: 'Academic Legal',
    description: 'Search law reviews and legal scholarship',
    icon: <SwatchBook size={24} />,
    category: 'research',
    popular: false,
    isPro: true,
  },
  {
    key: 'webSearch',
    title: 'General Search',
    description: 'Search across the internet',
    icon: <Globe size={24} />,
    category: 'general',
    popular: false,
  },
  {
    key: 'writingAssistant',
    title: 'Writing Assistant',
    description: 'General writing help',
    icon: <Pencil size={24} />,
    category: 'general',
    popular: false,
  },
];

interface FocusModeCardsProps {
  currentFocusMode: string;
  onFocusModeSelect: (mode: string) => void;
}

const FocusModeCards = ({ currentFocusMode, onFocusModeSelect }: FocusModeCardsProps) => {
  const legalModes = focusModes.filter(mode => mode.category === 'legal');
  const researchModes = focusModes.filter(mode => mode.category === 'research');
  const generalModes = focusModes.filter(mode => mode.category === 'general');

  const renderModeCard = (mode: typeof focusModes[0]) => {
    const isDisabled = (mode.key === 'writingAssistant' && WRITING_ASSISTANT_DISABLED);

    return (
      <button
        key={mode.key}
        onClick={() => !isDisabled && onFocusModeSelect(mode.key)}
        className={cn(
          'group relative p-4 rounded-lg border-2 transition-all duration-200 text-left',
          'hover:border-[#24A0ED] hover:shadow-lg hover:scale-105',
          currentFocusMode === mode.key
            ? 'border-[#24A0ED] bg-[#24A0ED]/5 shadow-lg'
            : 'border-light-200 dark:border-dark-200 bg-light-100 dark:bg-dark-100',
          'hover:bg-[#24A0ED]/10',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={isDisabled}
      >
        {mode.popular && !(mode as any).new && !(mode as any).beta && (
          <span className="absolute -top-2 -right-2 bg-[#24A0ED] text-white text-xs px-2 py-1 rounded-full">
            Popular
          </span>
        )}
        {(mode as any).new && (
          <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
            New
          </span>
        )}
        {(mode as any).beta && (
          <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
            Beta
          </span>
        )}
        <div className="flex items-start space-x-3">
          <div className={cn(
            'p-2 rounded-lg transition-colors',
            currentFocusMode === mode.key
              ? 'bg-[#24A0ED] text-white'
              : 'bg-light-200 dark:bg-dark-200 text-black dark:text-white group-hover:bg-[#24A0ED] group-hover:text-white'
          )}>
            {mode.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className={cn(
                'font-semibold text-sm mb-1 transition-colors',
                currentFocusMode === mode.key
                  ? 'text-[#24A0ED]'
                  : 'text-black dark:text-white group-hover:text-[#24A0ED]'
              )}>
                {mode.title}
              </h3>
              {(mode as any).isPro && (
                <span className="ml-2 text-xs bg-purple-500 text-white px-1.5 py-0.5 rounded-full">
                  PRO
                </span>
              )}
            </div>
            <p className="text-xs text-black/70 dark:text-white/70 leading-relaxed">
              {mode.description}
            </p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-black dark:text-white mb-2">
          Choose your focus mode
        </h3>
        <p className="text-sm text-black/60 dark:text-white/60">
          Select the type of legal work you want to do
        </p>
      </div>

      {/* Legal Research Section */}
      <div>
        <h4 className="text-sm font-medium text-black/80 dark:text-white/80 mb-3 flex items-center">
          <Scale size={16} className="mr-2" />
          Legal Research & Writing
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {legalModes.map(renderModeCard)}
        </div>
      </div>

      {/* Research & Analysis Section */}
      {researchModes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-black/80 dark:text-white/80 mb-3 flex items-center">
            <Microscope size={16} className="mr-2" />
            Research & Analysis
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {researchModes.map(renderModeCard)}
          </div>
        </div>
      )}

      {/* General Tools Section */}
      <div>
        <h4 className="text-sm font-medium text-black/80 dark:text-white/80 mb-3 flex items-center">
          <Globe size={16} className="mr-2" />
          General Tools
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {generalModes.map(renderModeCard)}
        </div>
      </div>
    </div>
  );
};

export default FocusModeCards;