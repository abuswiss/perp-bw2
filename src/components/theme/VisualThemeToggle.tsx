'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisualThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const VisualThemeToggle = ({ className, size = 'md' }: VisualThemeToggleProps) => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <div 
        className={cn(
          'rounded-full border border-gray-300 dark:border-gray-600',
          size === 'sm' && 'w-12 h-6',
          size === 'md' && 'w-14 h-7',
          size === 'lg' && 'w-16 h-8',
          className
        )}
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const sizeClasses = {
    sm: {
      container: 'w-12 h-6',
      toggle: 'w-5 h-5',
      icon: 'w-3 h-3',
      translate: isDark ? 'translate-x-6' : 'translate-x-0.5'
    },
    md: {
      container: 'w-14 h-7',
      toggle: 'w-6 h-6',
      icon: 'w-3.5 h-3.5',
      translate: isDark ? 'translate-x-7' : 'translate-x-0.5'
    },
    lg: {
      container: 'w-16 h-8',
      toggle: 'w-7 h-7',
      icon: 'w-4 h-4',
      translate: isDark ? 'translate-x-8' : 'translate-x-0.5'
    }
  };

  const sizes = sizeClasses[size];

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'relative inline-flex items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#24A0ED] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900',
        sizes.container,
        isDark 
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg' 
          : 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg',
        'hover:shadow-xl active:scale-95',
        className
      )}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Background gradient overlay for extra visual appeal */}
      <div 
        className={cn(
          'absolute inset-0 rounded-full transition-opacity duration-300',
          isDark 
            ? 'bg-gradient-to-r from-slate-800 to-slate-900 opacity-20' 
            : 'bg-gradient-to-r from-white to-yellow-100 opacity-30'
        )}
      />
      
      {/* Toggle circle */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full transition-all duration-300 ease-in-out transform shadow-md',
          sizes.toggle,
          sizes.translate,
          isDark 
            ? 'bg-white text-indigo-600' 
            : 'bg-white text-orange-500'
        )}
      >
        {/* Icon with smooth transition */}
        <div className={cn('relative flex items-center justify-center', sizes.icon)}>
          <Sun 
            className={cn(
              'absolute transition-all duration-300 transform',
              sizes.icon,
              isDark 
                ? 'opacity-0 rotate-90 scale-50' 
                : 'opacity-100 rotate-0 scale-100'
            )}
          />
          <Moon 
            className={cn(
              'absolute transition-all duration-300 transform',
              sizes.icon,
              isDark 
                ? 'opacity-100 rotate-0 scale-100' 
                : 'opacity-0 -rotate-90 scale-50'
            )}
          />
        </div>
      </div>
      
      {/* Subtle glow effect */}
      <div 
        className={cn(
          'absolute inset-0 rounded-full transition-opacity duration-300 pointer-events-none',
          isDark 
            ? 'bg-indigo-400 opacity-0 group-hover:opacity-20' 
            : 'bg-yellow-300 opacity-0 group-hover:opacity-20'
        )}
      />
    </button>
  );
};

export default VisualThemeToggle;