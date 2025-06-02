'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ListTodo, Clock, CheckCircle, XCircle, AlertCircle, Play, Eye, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

const WorkspaceTasks = () => {
  const params = useParams();
  const matterId = params.matterId as string;
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadTasks();
  }, [matterId]);

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('matter_id', matterId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'running':
        return <Play className="w-5 h-5 text-blue-600 animate-pulse" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  const getAgentTypeLabel = (agentType: string) => {
    const labels: { [key: string]: string } = {
      'research': 'Legal Research',
      'brief-writing': 'Document Drafting',
      'discovery': 'Discovery Review',
      'contract': 'Contract Analysis',
    };
    return labels[agentType] || (agentType ? agentType.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown Task');
  };

  const getAgentTypeColor = (agentType: string) => {
    const colors: { [key: string]: string } = {
      'research': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'brief-writing': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'discovery': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'contract': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    };
    return colors[agentType] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const taskCounts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffInSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ${diffInSeconds % 60}s`;
    } else {
      const hours = Math.floor(diffInSeconds / 3600);
      const minutes = Math.floor((diffInSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Agent Tasks
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI agent tasks for this matter
          </p>
        </div>
        <Link
          href={`/?matterId=${matterId}`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Start New Task
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'running', 'completed', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-2 text-xs">
              ({taskCounts[status as keyof typeof taskCounts]})
            </span>
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <ListTodo className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {filter === 'all' ? 'No agent tasks for this matter yet' : `No ${filter} tasks`}
          </p>
          {filter === 'all' && (
            <Link
              href={`/?matterId=${matterId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Your First Task
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(task.status)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {getAgentTypeLabel(task.agent_type)}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAgentTypeColor(task.agent_type)}`}>
                        {task.agent_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Task ID: {task.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                  {task.status}
                </span>
              </div>

              {task.query && (
                <div className="mb-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Query:</span> {task.query}
                  </p>
                </div>
              )}

              {task.progress !== null && task.status === 'running' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Progress</span>
                    <span className="text-gray-700 dark:text-gray-300">{task.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {new Date(task.created_at).toLocaleString()}
                </div>
                {task.completed_at && (
                  <div>
                    <span className="font-medium">Completed:</span>{' '}
                    {new Date(task.completed_at).toLocaleString()}
                  </div>
                )}
                <div>
                  <span className="font-medium">Duration:</span>{' '}
                  {formatDuration(task.created_at, task.completed_at)}
                </div>
                {task.execution_count && (
                  <div>
                    <span className="font-medium">Executions:</span>{' '}
                    {task.execution_count}
                  </div>
                )}
              </div>

              {task.error_message && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    <span className="font-medium">Error:</span> {task.error_message}
                  </p>
                </div>
              )}

              {task.result && task.status === 'completed' && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                    <span className="font-medium">Task completed successfully</span>
                  </p>
                  {task.result.documents_generated && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Generated {task.result.documents_generated} document(s)
                    </p>
                  )}
                </div>
              )}

              {/* Task Actions */}
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/tasks/${task.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  View Details
                </Link>
                {task.status === 'completed' && task.result?.chat_id && (
                  <Link
                    href={`/c/${task.result.chat_id}`}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    View Chat
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkspaceTasks;