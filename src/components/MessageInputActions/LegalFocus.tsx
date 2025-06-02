import {
  Scale,
  ChevronDown,
  Book,
  FileText,
  Search,
  FileCheck,
  MessageSquare,
  ScanEye,
  Briefcase,
  FileSearch,
  ScrollText,
  Globe,
  SwatchBook,
  Clock,
} from 'lucide-react';
import { SiReddit } from '@icons-pack/react-simple-icons';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment } from 'react';

const legalFocusModes = [
  {
    key: 'caselaw',
    title: 'Case Law',
    description: 'Search federal and state case law',
    icon: <Scale size={20} />,
    category: 'legal'
  },
  {
    key: 'statutory',
    title: 'Statutes & Regs',
    description: 'Search statutes and regulations',
    icon: <Book size={20} />,
    category: 'legal'
  },
  {
    key: 'documentDrafting',
    title: 'Document Drafting',
    description: 'Generate legal documents including memoranda, briefs, and other legal writing',
    icon: <FileText size={20} />,
    category: 'legal'
  },
  {
    key: 'discovery',
    title: 'Discovery Review',
    description: 'Analyze and summarize documents',
    icon: <FileSearch size={20} />,
    category: 'legal'
  },
  {
    key: 'contractAnalysis',
    title: 'Contract Reviewer',
    description: 'Review contracts and agreements',
    icon: <FileCheck size={20} />,
    category: 'legal'
  },
  {
    key: 'matterDocuments',
    title: 'Matter Docs',
    description: 'Search within current matter only',
    icon: <Briefcase size={20} />,
    category: 'legal'
  },
  {
    key: 'legalTimeline',
    title: 'Timeline Generator',
    description: 'Generate litigation timelines from case descriptions',
    icon: <Clock size={20} />,
    category: 'legal'
  },
  // Hybrid modes that combine legal expertise with web search
  {
    key: 'webSearch',
    title: 'General Web',
    description: 'Search the entire internet with legal context',
    icon: <Globe size={20} />,
    category: 'hybrid'
  },
  {
    key: 'academicSearch',
    title: 'Academic Legal',
    description: 'Search legal journals and academic papers',
    icon: <SwatchBook size={20} />,
    category: 'hybrid'
  },
  {
    key: 'redditSearch',
    title: 'Legal Discussions',
    description: 'Find legal discussions and opinions online',
    icon: <SiReddit className="h-5 w-auto mr-0.5" />,
    category: 'hybrid'
  },
];

const LegalFocus = ({
  focusMode,
  setFocusMode,
}: {
  focusMode: string;
  setFocusMode: (mode: string) => void;
}) => {
  // Default to caselaw if no valid legal mode is selected
  const currentMode = legalFocusModes.find(mode => mode.key === focusMode) || legalFocusModes[0];
  
  return (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg mt-[6.5px]">
      <PopoverButton
        type="button"
        className="text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
      >
        <div className="flex flex-row items-center space-x-1">
          {currentMode.icon}
          <p className="text-xs font-medium hidden lg:block">
            {currentMode.title}
          </p>
          <ChevronDown size={20} className="-translate-x-1" />
        </div>
      </PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel className="absolute z-10 w-64 md:w-[700px] left-0">
          <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-4 max-h-[500px] overflow-y-auto">
            <div className="mb-4 px-2">
              <h3 className="text-sm font-semibold text-black dark:text-white">Legal Research Modes</h3>
              <p className="text-xs text-black/60 dark:text-white/60 mt-1">
                Select the appropriate mode for your legal task
              </p>
            </div>

            {/* Legal-Specific Modes */}
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2 px-2">
                Legal Research
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {legalFocusModes.filter(mode => mode.category === 'legal').map((mode, i) => (
                  <PopoverButton
                    onClick={() => setFocusMode(mode.key)}
                    key={i}
                    className={cn(
                      'p-3 rounded-lg flex flex-col items-start justify-start text-start space-y-2 duration-200 cursor-pointer transition border',
                      focusMode === mode.key
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400'
                        : 'hover:bg-light-secondary dark:hover:bg-dark-secondary border-transparent',
                    )}
                  >
                    <div
                      className={cn(
                        'flex flex-row items-center space-x-2',
                        focusMode === mode.key
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-black dark:text-white',
                      )}
                    >
                      {mode.icon}
                      <p className="text-sm font-medium">{mode.title}</p>
                    </div>
                    <p className="text-black/70 dark:text-white/70 text-xs">
                      {mode.description}
                    </p>
                  </PopoverButton>
                ))}
              </div>
            </div>

            {/* Hybrid Modes */}
            <div>
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2 px-2">
                Web Search + Legal Context
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {legalFocusModes.filter(mode => mode.category === 'hybrid').map((mode, i) => (
                  <PopoverButton
                    onClick={() => setFocusMode(mode.key)}
                    key={i}
                    className={cn(
                      'p-3 rounded-lg flex flex-col items-start justify-start text-start space-y-2 duration-200 cursor-pointer transition border',
                      focusMode === mode.key
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-400'
                        : 'hover:bg-light-secondary dark:hover:bg-dark-secondary border-transparent',
                    )}
                  >
                    <div
                      className={cn(
                        'flex flex-row items-center space-x-2',
                        focusMode === mode.key
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-black dark:text-white',
                      )}
                    >
                      {mode.icon}
                      <p className="text-sm font-medium">{mode.title}</p>
                    </div>
                    <p className="text-black/70 dark:text-white/70 text-xs">
                      {mode.description}
                    </p>
                  </PopoverButton>
                ))}
              </div>
            </div>
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default LegalFocus;