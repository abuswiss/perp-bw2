'use client';

import { cn } from '@/lib/utils';
import { 
  Briefcase, 
  Home, 
  FileText, 
  Scale, 
  Settings,
  FolderOpen,
  ListTodo,
  Building,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import React, { useState, type ReactNode } from 'react';
import Layout from './Layout';

const VerticalIconContainer = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-col items-center gap-y-3 w-full">{children}</div>
  );
};

const LegalSidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const navLinks = [
    {
      icon: Home,
      href: '/',
      active: segments.length === 0 || segments.includes('c'),
      label: 'Research',
      tooltip: 'Legal Research',
    },
    {
      icon: Briefcase,
      href: '/matters',
      active: segments.includes('matters'),
      label: 'Matters',
      tooltip: 'Manage Matters',
    },
    {
      icon: FileText,
      href: '/documents',
      active: segments.includes('documents'),
      label: 'Documents',
      tooltip: 'Document Library',
    },
    {
      icon: Scale,
      href: '/cases',
      active: segments.includes('cases'),
      label: 'Case Law',
      tooltip: 'Saved Cases',
    },
    {
      icon: ListTodo,
      href: '/tasks',
      active: segments.includes('tasks'),
      label: 'Tasks',
      tooltip: 'Agent Tasks',
    },
  ];

  const bottomLinks = [
    {
      icon: HelpCircle,
      href: '/help',
      label: 'Help',
      tooltip: 'Help & Support',
    },
    {
      icon: Settings,
      href: '/settings',
      label: 'Settings',
      tooltip: 'Settings',
    },
  ];

  return (
    <div>
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-20 lg:flex-col">
        <div className="flex grow flex-col items-center justify-between gap-y-5 overflow-y-auto bg-light-secondary dark:bg-dark-secondary px-2 py-8">
          <a href="/" className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Scale className="text-white w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-black dark:text-white">BenchWise</span>
          </a>
          
          <VerticalIconContainer>
            {navLinks.map((link, i) => (
              <div key={i} className="relative w-full">
                <Link
                  href={link.href}
                  onMouseEnter={() => setShowTooltip(link.href)}
                  onMouseLeave={() => setShowTooltip(null)}
                  className={cn(
                    'relative flex flex-row items-center justify-center cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 duration-150 transition w-full py-2 rounded-lg',
                    link.active
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-black/70 dark:text-white/70',
                  )}
                >
                  <link.icon size={22} />
                  {link.active && (
                    <div className="absolute right-0 -mr-2 h-full w-1 rounded-l-lg bg-blue-600 dark:bg-blue-400" />
                  )}
                </Link>
                
                {/* Tooltip */}
                {showTooltip === link.href && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                    {link.tooltip}
                  </div>
                )}
              </div>
            ))}
          </VerticalIconContainer>

          <div className="flex flex-col gap-3">
            {bottomLinks.map((link, i) => (
              <div key={i} className="relative">
                <Link 
                  href={link.href}
                  onMouseEnter={() => setShowTooltip(link.href)}
                  onMouseLeave={() => setShowTooltip(null)}
                  className="cursor-pointer text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors"
                >
                  <link.icon size={22} />
                </Link>
                
                {/* Tooltip */}
                {showTooltip === link.href && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                    {link.tooltip}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <div className="fixed bottom-0 w-full z-50 flex flex-row items-center gap-x-2 bg-light-primary dark:bg-dark-primary px-4 py-3 shadow-sm lg:hidden">
        {navLinks.slice(0, 4).map((link, i) => (
          <Link
            href={link.href}
            key={i}
            className={cn(
              'relative flex flex-col items-center space-y-1 text-center w-full py-1',
              link.active
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-black/60 dark:text-white/60',
            )}
          >
            {link.active && (
              <div className="absolute top-0 -mt-3 h-1 w-full rounded-b-lg bg-blue-600 dark:bg-blue-400" />
            )}
            <link.icon size={20} />
            <p className="text-[10px]">{link.label}</p>
          </Link>
        ))}
      </div>

      <Layout>{children}</Layout>
    </div>
  );
};

export default LegalSidebar;