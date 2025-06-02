import { Briefcase, ChevronDown, Plus, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment } from 'react';
import { useMatter } from '@/contexts/MatterContext';
import Link from 'next/link';

const ChatMatterSelector = () => {
  const { currentMatter, matters, setCurrentMatter, isLoading } = useMatter();

  // Get only active matters, sorted by most recent
  const activeMatters = matters
    .filter(m => m.status === 'active')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10); // Limit to 10 most recent

  return (
    <Popover className="relative">
      <PopoverButton
        type="button"
        className="flex flex-row items-center space-x-2 text-black/70 dark:text-white/70 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition duration-200 px-3 py-2 hover:text-black dark:hover:text-white"
      >
        <Briefcase size={18} />
        <div className="flex flex-col items-start">
          <p className="text-sm font-medium">
            {currentMatter ? currentMatter.name : 'General Research'}
          </p>
          {currentMatter && (
            <p className="text-xs text-black/50 dark:text-white/50">
              {currentMatter.client_name || 'No client'}
            </p>
          )}
        </div>
        <ChevronDown size={16} />
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
        <PopoverPanel className="absolute z-50 w-80 left-0 mt-2">
          <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 shadow-lg p-2 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* General Research Option */}
                <PopoverButton
                  onClick={() => setCurrentMatter(null)}
                  className={cn(
                    'w-full p-3 rounded-lg flex flex-col items-start text-start duration-200 cursor-pointer transition border mb-2',
                    !currentMatter
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'hover:bg-light-secondary dark:hover:bg-dark-secondary border-transparent',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase size={16} className="text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-medium text-black dark:text-white">
                      General Research
                    </p>
                  </div>
                  <p className="text-xs text-black/70 dark:text-white/70">
                    Research without a specific matter
                  </p>
                </PopoverButton>

                {/* Active Matters */}
                {activeMatters.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-black/50 dark:text-white/50 px-2 py-1 mb-1">
                      ACTIVE MATTERS
                    </p>
                    {activeMatters.map((matter) => (
                      <PopoverButton
                        key={matter.id}
                        onClick={() => setCurrentMatter(matter)}
                        className={cn(
                          'w-full p-3 rounded-lg flex flex-col items-start text-start duration-200 cursor-pointer transition',
                          currentMatter?.id === matter.id
                            ? 'bg-light-secondary dark:bg-dark-secondary'
                            : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                        )}
                      >
                        <p className="text-sm font-medium text-black dark:text-white mb-1">
                          {matter.name}
                        </p>
                        <div className="text-xs text-black/70 dark:text-white/70">
                          {matter.client_name && (
                            <span>{matter.client_name}</span>
                          )}
                          {matter.client_name && matter.matter_number && (
                            <span> • </span>
                          )}
                          {matter.matter_number && (
                            <span>{matter.matter_number}</span>
                          )}
                        </div>
                      </PopoverButton>
                    ))}
                  </div>
                )}

                {/* No matters message */}
                {activeMatters.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-black/70 dark:text-white/70 mb-2">
                      No active matters
                    </p>
                    <Link
                      href="/matters"
                      className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1"
                    >
                      <Plus size={16} />
                      Create your first matter
                    </Link>
                  </div>
                )}

                {/* Action links */}
                <div className="border-t border-light-200 dark:border-dark-200 mt-2 pt-2 space-y-1">
                  {currentMatter && (
                    <Link
                      href={`/workspace/${currentMatter.id}`}
                      className="w-full p-2 text-sm text-purple-600 hover:bg-light-secondary dark:hover:bg-dark-secondary rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <ExternalLink size={16} />
                      View Workspace
                    </Link>
                  )}
                  <Link
                    href="/matters"
                    className="w-full p-2 text-sm text-blue-600 hover:bg-light-secondary dark:hover:bg-dark-secondary rounded-lg flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus size={16} />
                    Manage Matters
                  </Link>
                </div>
              </>
            )}
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default ChatMatterSelector;