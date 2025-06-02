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
import React, { useState, type ReactNode, MouseEvent } from 'react';
import Layout from './Layout';
import { useMatter } from '@/contexts/MatterContext';
import TooltipPortal from './TooltipPortal';

const VerticalIconContainer = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-col items-center gap-y-3 w-full">{children}</div>
  );
};

interface TooltipState {
  text: string;
  top: number;
  left: number;
}

const LegalSidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const [showTooltip, setShowTooltip] = useState<TooltipState | null>(null);
  const { currentMatter } = useMatter();

  const isInWorkspace = segments.includes('workspace');
  const workspaceMatterId = isInWorkspace ? segments[segments.indexOf('workspace') + 1] : null;
  const contextMatterId = workspaceMatterId || currentMatter?.id;

  const getNavHref = (basePath: string) => {
    if (isInWorkspace && workspaceMatterId) {
      if (basePath === '/') return '/';
      if (basePath === '/matters') return `/workspace/${workspaceMatterId}`;
      return `/workspace/${workspaceMatterId}${basePath}`;
    } else if (currentMatter && basePath !== '/' && basePath !== '/matters') {
      return `/workspace/${currentMatter.id}${basePath}`;
    } else {
      return basePath;
    }
  };

  const getTooltipText = (baseTooltip: string, path: string) => {
    if ((isInWorkspace || (currentMatter && path !== '/' && path !== '/matters'))) {
      const matterName = workspaceMatterId ? 'Matter' : currentMatter?.name || 'Matter';
      return `${baseTooltip} - ${matterName}`;
    }
    return baseTooltip;
  };

  const navLinks = [
    {
      icon: Home,
      href: getNavHref('/'),
      active: segments.length === 0 || segments.includes('c'),
      label: 'Research',
      tooltip: 'Legal Research',
    },
    {
      icon: Briefcase,
      href: getNavHref('/matters'),
      active: segments.includes('matters') || (isInWorkspace && segments[segments.length - 1] === workspaceMatterId),
      label: 'Matters',
      tooltip: isInWorkspace ? 'Matter Overview' : 'Manage Matters',
    },
    {
      icon: FileText,
      href: getNavHref('/documents'),
      active: segments.includes('documents'),
      label: 'Documents',
      tooltip: getTooltipText('Document Library', '/documents'),
    },
    {
      icon: Scale,
      href: getNavHref('/cases'),
      active: segments.includes('cases'),
      label: 'Case Law',
      tooltip: getTooltipText('Saved Cases', '/cases'),
    },
    {
      icon: ListTodo,
      href: getNavHref('/tasks'),
      active: segments.includes('tasks'),
      label: 'Tasks',
      tooltip: getTooltipText('Agent Tasks', '/tasks'),
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

  const handleMouseEnter = (event: MouseEvent<HTMLAnchorElement>, tooltipText: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setShowTooltip({
      text: tooltipText,
      top: rect.top + (rect.height / 2) - 14,
      left: rect.right + 8,
    });
  };

  const handleMouseLeave = () => {
    setShowTooltip(null);
  };

  return (
    <div className="relative overflow-visible">
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-20 lg:flex-col overflow-visible">
        <div className="flex grow flex-col items-center justify-between gap-y-5 overflow-y-auto bg-light-secondary dark:bg-dark-secondary px-2 py-8">
          <a href="/" className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-6 h-6">
                  <div className="absolute top-0 left-1/2 w-2 h-2 bg-white rounded-full transform -translate-x-1/2"></div>
                  <div className="absolute top-1 left-0 w-1.5 h-1.5 bg-white/80 rounded-sm transform rotate-45"></div>
                  <div className="absolute top-1 right-0 w-1.5 h-1.5 bg-white/80 rounded-sm transform -rotate-45"></div>
                  <div className="absolute bottom-0 left-1/2 w-4 h-2 bg-white transform -translate-x-1/2" style={{
                    clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)'
                  }}></div>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-black dark:text-white">BenchWise</span>
          </a>
          
          <VerticalIconContainer>
            {navLinks.map((link, i) => (
              <div key={link.href} className="relative w-full overflow-visible">
                <Link
                  href={link.href}
                  onMouseEnter={(e) => handleMouseEnter(e, link.tooltip)}
                  onMouseLeave={handleMouseLeave}
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
              </div>
            ))}
          </VerticalIconContainer>

          <div className="flex flex-col gap-3">
            {bottomLinks.map((link, i) => (
              <div key={link.href} className="relative overflow-visible">
                <Link 
                  href={link.href}
                  onMouseEnter={(e) => handleMouseEnter(e, link.tooltip)}
                  onMouseLeave={handleMouseLeave}
                  className="cursor-pointer text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors"
                >
                  <link.icon size={22} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 w-full z-50 flex flex-row items-center gap-x-2 bg-light-primary dark:bg-dark-primary px-4 py-3 shadow-sm lg:hidden">
        {navLinks.slice(0, 4).map((link, i) => (
          <Link
            href={link.href}
            key={link.href}
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

      {showTooltip && (
        <TooltipPortal>
          <div 
            style={{ 
              position: 'fixed',
              top: `${showTooltip.top}px`, 
              left: `${showTooltip.left}px`,
            }}
            className="px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-[99999] pointer-events-none"
          >
            {showTooltip.text}
          </div>
        </TooltipPortal>
      )}
    </div>
  );
};

export default LegalSidebar;