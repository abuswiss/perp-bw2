'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useMatter } from '@/contexts/MatterContext';
import { supabase, Matter } from '@/lib/supabase/client';
import { 
  Briefcase, 
  FileText, 
  ListTodo, 
  MessageSquare, 
  ChevronRight,
  ArrowLeft,
  BarChart3,
  Scale
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

const WorkspaceLayout = ({ children }: WorkspaceLayoutProps) => {
  const params = useParams();
  const pathname = usePathname();
  const matterId = params.matterId as string;
  const { setCurrentMatter } = useMatter();
  const [matter, setMatter] = useState<Matter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMatter = async () => {
      try {
        console.log('Loading matter with ID:', matterId);
        console.log('Pathname:', pathname);
        console.log('Full params:', params);
        
        const { data, error } = await supabase
          .from('matters')
          .select('*')
          .eq('id', matterId)
          .single();

        if (error) {
          console.error('Error loading matter:', error);
          return;
        }

        setMatter(data);
        setCurrentMatter(data);
      } catch (error) {
        console.error('Error in loadMatter:', error);
      } finally {
        setLoading(false);
      }
    };

    if (matterId) {
      loadMatter();
    }
  }, [matterId, setCurrentMatter]);

  const getActiveTab = () => {
    if (pathname.includes('/documents')) return 'documents';
    if (pathname.includes('/cases')) return 'cases';
    if (pathname.includes('/tasks')) return 'tasks';
    if (pathname.includes('/chats')) return 'chats';
    return 'overview';
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: BarChart3,
      href: `/workspace/${matterId}`,
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      href: `/workspace/${matterId}/documents`,
    },
    {
      id: 'cases',
      label: 'Cases',
      icon: Scale,
      href: `/workspace/${matterId}/cases`,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: ListTodo,
      href: `/workspace/${matterId}/tasks`,
    },
    {
      id: 'chats',
      label: 'Chats',
      icon: MessageSquare,
      href: `/workspace/${matterId}/chats`,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!matter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Matter Not Found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The matter you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/matters"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Matters
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="flex items-center py-4">
            <Link
              href="/matters"
              className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft size={16} className="mr-2" />
              <span className="text-sm">Back to Matters</span>
            </Link>
            <ChevronRight size={16} className="mx-2 text-gray-400" />
            <div className="flex items-center">
              <Briefcase size={16} className="mr-2 text-blue-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {matter.name}
              </span>
            </div>
          </div>

          {/* Matter Info */}
          <div className="pb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {matter.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
              {matter.client_name && (
                <span>Client: {matter.client_name}</span>
              )}
              {matter.matter_number && (
                <span>Matter #: {matter.matter_number}</span>
              )}
              {matter.practice_area && (
                <span>Practice Area: {matter.practice_area}</span>
              )}
              <span>Status: {matter.status}</span>
            </div>
            {matter.description && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {matter.description}
              </p>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => {
              const isActive = getActiveTab() === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    'flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    isActive
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300'
                  )}
                >
                  <tab.icon size={16} className="mr-2" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
};

export default WorkspaceLayout;