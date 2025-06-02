'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { 
  FileText, 
  ListTodo, 
  MessageSquare, 
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Users
} from 'lucide-react';
import Link from 'next/link';

interface WorkspaceStats {
  documentsCount: number;
  tasksCount: number;
  chatsCount: number;
  recentActivity: any[];
  taskStats: {
    completed: number;
    pending: number;
    failed: number;
  };
}

const WorkspaceOverview = () => {
  const params = useParams();
  const matterId = params.matterId as string;
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        let documentsCount = 0;
        let tasks: any[] = [];
        let chatsCount = 0;

        // Load document count with error handling
        try {
          const { count } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('matter_id', matterId);
          documentsCount = count || 0;
        } catch (docError) {
          console.warn('Documents table not available:', docError);
        }

        // Load task count and stats with error handling
        try {
          const { data: taskData } = await supabase
            .from('agent_tasks')
            .select('status')
            .eq('matter_id', matterId);
          tasks = taskData || [];
        } catch (taskError) {
          console.warn('Agent tasks table not available:', taskError);
        }

        const taskStats = {
          completed: tasks?.filter(t => t.status === 'completed').length || 0,
          pending: tasks?.filter(t => t.status === 'pending').length || 0,
          failed: tasks?.filter(t => t.status === 'failed').length || 0,
        };

        // Load chat count with error handling
        try {
          const { count } = await supabase
            .from('legal_chats')
            .select('*', { count: 'exact', head: true })
            .eq('matter_id', matterId);
          chatsCount = count || 0;
        } catch (chatError) {
          console.warn('Legal chats table not available:', chatError);
        }

        // Load recent activity with error handling
        let recentTasks: any[] = [];
        let recentDocs: any[] = [];

        try {
          const { data: taskData } = await supabase
            .from('agent_tasks')
            .select('id, agent_type, query, status, created_at')
            .eq('matter_id', matterId)
            .order('created_at', { ascending: false })
            .limit(5);
          recentTasks = taskData || [];
        } catch (recentTaskError) {
          console.warn('Recent tasks query failed:', recentTaskError);
        }

        try {
          const { data: docData } = await supabase
            .from('documents')
            .select('id, filename, created_at')
            .eq('matter_id', matterId)
            .order('created_at', { ascending: false })
            .limit(3);
          recentDocs = docData || [];
        } catch (recentDocError) {
          console.warn('Recent documents query failed:', recentDocError);
        }

        let recentChats: any[] = [];
        try {
          const { data: chatData } = await supabase
            .from('legal_chats')
            .select('id, title, created_at')
            .eq('matter_id', matterId)
            .order('created_at', { ascending: false })
            .limit(3);
          recentChats = chatData || [];
        } catch (recentChatError) {
          console.warn('Recent chats query failed:', recentChatError);
        }

        // Combine recent activity
        const recentActivity = [
          ...(recentTasks?.map(task => ({
            type: 'task',
            id: task.id,
            title: task.query,
            subtitle: `${task.agent_type} agent`,
            status: task.status,
            created_at: task.created_at,
          })) || []),
          ...(recentDocs?.map(doc => ({
            type: 'document',
            id: doc.id,
            title: doc.filename,
            subtitle: 'Document uploaded',
            status: 'completed',
            created_at: doc.created_at,
          })) || []),
          ...(recentChats?.map(chat => ({
            type: 'chat',
            id: chat.id,
            title: chat.title,
            subtitle: 'Chat session',
            status: 'completed',
            created_at: chat.created_at,
          })) || []),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

        setStats({
          documentsCount,
          tasksCount: tasks?.length || 0,
          chatsCount: chatsCount || 0,
          recentActivity,
          taskStats,
        });
      } catch (error) {
        console.error('Error loading workspace stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (matterId) {
      loadStats();
    }
  }, [matterId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <ListTodo size={16} className="text-blue-600" />;
      case 'document':
        return <FileText size={16} className="text-green-600" />;
      case 'chat':
        return <MessageSquare size={16} className="text-purple-600" />;
      default:
        return <Calendar size={16} className="text-gray-600" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={14} className="text-green-600" />;
      case 'failed':
        return <AlertCircle size={14} className="text-red-600" />;
      default:
        return <Clock size={14} className="text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link href={`/workspace/${matterId}/documents`} className="group">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 group-hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Documents</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.documentsCount || 0}
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href={`/workspace/${matterId}/tasks`} className="group">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 group-hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <ListTodo className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Agent Tasks</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.tasksCount || 0}
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href={`/workspace/${matterId}/chats`} className="group">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 group-hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <MessageSquare className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Chat Sessions</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.chatsCount || 0}
                </p>
              </div>
            </div>
          </div>
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Task Success</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats?.tasksCount ? Math.round((stats.taskStats.completed / stats.tasksCount) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Task Status Breakdown */}
      {stats && stats.tasksCount > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Task Status Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Completed:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                {stats.taskStats.completed}
              </span>
            </div>
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Pending:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                {stats.taskStats.pending}
              </span>
            </div>
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Failed:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                {stats.taskStats.failed}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Activity
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            stats.recentActivity.map((item, index) => (
              <div key={`${item.type}-${item.id}-${index}`} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="mr-3">
                      {getActivityIcon(item.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(item.status)}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(item.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href={`/?matterId=${matterId}`}
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <MessageSquare className="h-5 w-5 text-blue-600 mr-3" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Start Research
            </span>
          </Link>
          <Link
            href={`/workspace/${matterId}/documents`}
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <FileText className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Upload Documents
            </span>
          </Link>
          <Link
            href={`/workspace/${matterId}/tasks`}
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <ListTodo className="h-5 w-5 text-purple-600 mr-3" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              View Tasks
            </span>
          </Link>
          <Link
            href="/matters"
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <Users className="h-5 w-5 text-orange-600 mr-3" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              All Matters
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceOverview;