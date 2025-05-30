import { Briefcase, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

interface Matter {
  id: string;
  matter_number: string;
  name: string;
  client_name: string;
  status: string;
}

const MatterSelector = ({
  selectedMatterId,
  setSelectedMatterId,
}: {
  selectedMatterId: string | null;
  setSelectedMatterId: (matterId: string | null) => void;
}) => {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatters();
  }, []);

  const loadMatters = async () => {
    try {
      const { data, error } = await supabase
        .from('matters')
        .select('id, matter_number, name, client_name, status')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setMatters(data || []);
    } catch (error) {
      console.error('Error loading matters:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedMatter = matters.find(m => m.id === selectedMatterId);

  return (
    <Popover className="relative">
      <PopoverButton
        type="button"
        className="text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
      >
        <div className="flex flex-row items-center space-x-1">
          <Briefcase size={20} />
          <p className="text-xs font-medium hidden lg:block">
            {selectedMatter ? selectedMatter.name : 'Select Matter'}
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
        <PopoverPanel className="absolute z-10 w-72 right-0">
          <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-2 max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : matters.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-black/70 dark:text-white/70 mb-2">No active matters</p>
                <Link
                  href="/matters"
                  className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1"
                >
                  <Plus size={16} />
                  Create Matter
                </Link>
              </div>
            ) : (
              <>
                <PopoverButton
                  onClick={() => setSelectedMatterId(null)}
                  className={cn(
                    'w-full p-2 rounded-lg flex flex-col items-start text-start duration-200 cursor-pointer transition',
                    !selectedMatterId
                      ? 'bg-light-secondary dark:bg-dark-secondary'
                      : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                  )}
                >
                  <p className="text-sm font-medium text-black dark:text-white">No Matter</p>
                  <p className="text-xs text-black/70 dark:text-white/70">General research</p>
                </PopoverButton>
                {matters.map((matter) => (
                  <PopoverButton
                    key={matter.id}
                    onClick={() => setSelectedMatterId(matter.id)}
                    className={cn(
                      'w-full p-2 rounded-lg flex flex-col items-start text-start duration-200 cursor-pointer transition',
                      selectedMatterId === matter.id
                        ? 'bg-light-secondary dark:bg-dark-secondary'
                        : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                    )}
                  >
                    <p className="text-sm font-medium text-black dark:text-white">
                      {matter.name}
                    </p>
                    <p className="text-xs text-black/70 dark:text-white/70">
                      {matter.client_name} • {matter.matter_number}
                    </p>
                  </PopoverButton>
                ))}
                <Link
                  href="/matters"
                  className="w-full p-2 mt-1 border-t border-light-200 dark:border-dark-200 text-sm text-blue-600 hover:underline flex items-center justify-center gap-1"
                >
                  <Plus size={16} />
                  Manage Matters
                </Link>
              </>
            )}
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default MatterSelector;