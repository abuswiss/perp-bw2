'use client';

import { useState, useEffect } from 'react';
import { AgentTask } from '@/lib/agents/types';
import { useMatter } from '@/contexts/MatterContext';
import AgentSelector from './AgentSelector';
import TaskProgress from './TaskProgress';

export default function AgentTaskPanel() {
  const { currentMatter } = useMatter();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentMatter) {
      fetchMatterTasks();
    }
  }, [currentMatter]);

  const fetchMatterTasks = async () => {
    if (!currentMatter) return;
    
    try {
      const response = await fetch(`/api/agents/matters/${currentMatter.id}/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Failed to fetch matter tasks:', err);
    }
  };

  const createAgentTask = async (agentType: string, capability?: string) => {
    if (!currentMatter || !userQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matterId: currentMatter.id,
          agentType,
          query: userQuery,
          parameters: capability ? { capability } : undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create agent task');
      }

      const task = await response.json();
      setTasks(prev => [task, ...prev]);
      setActiveTask(task.id);
      setShowAgentSelector(false);
      setUserQuery('');

      // Start executing the task
      executeTask(task.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const executeTask = async (taskId: string) => {
    try {
      await fetch(`/api/agents/tasks/${taskId}/execute`, {
        method: 'POST',
      });
      
      // Task will update via TaskProgress component polling
    } catch (err) {
      console.error('Failed to execute task:', err);
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '⚡';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '🚫';
      default: return '❓';
    }
  };

  const getTaskTypeDisplay = (agentType: string) => {
    const types = {
      'research': 'Legal Research',
      'brief-writing': 'Brief Writing',
      'discovery': 'Discovery Review',
      'contract': 'Contract Analysis'
    };
    return types[agentType as keyof typeof types] || agentType;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (!currentMatter) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <div className="mb-2">🤖</div>
        <div>Select a matter to use AI agents</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              AI Agents
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Automate legal workflows with specialized AI agents
            </p>
          </div>
          
          <button
            onClick={() => setShowAgentSelector(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Task
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {showAgentSelector ? (
          <div className="p-4 h-full overflow-auto">
            <div className="mb-4">
              <button
                onClick={() => setShowAgentSelector(false)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ← Back to tasks
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Describe what you need help with:
                </label>
                <textarea
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="e.g., Research case law on summary judgment standards, Draft a motion to dismiss, Review discovery documents for privilege..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  rows={3}
                />
              </div>

              {userQuery.trim() && (
                <AgentSelector
                  query={userQuery}
                  onAgentSelect={createAgentTask}
                />
              )}

              {loading && (
                <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="text-sm text-blue-700 dark:text-blue-300">Creating agent task...</span>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="text-red-700 dark:text-red-400">{error}</div>
                </div>
              )}
            </div>
          </div>
        ) : activeTask ? (
          <div className="p-4 h-full overflow-auto">
            <div className="mb-4">
              <button
                onClick={() => setActiveTask(null)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ← Back to all tasks
              </button>
            </div>

            <TaskProgress
              taskId={activeTask}
              onTaskComplete={() => {
                fetchMatterTasks();
              }}
              onTaskError={() => {
                fetchMatterTasks();
              }}
            />
          </div>
        ) : (
          <div className="p-4 h-full overflow-auto">
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 dark:text-gray-500 mb-4">
                  <div className="text-4xl mb-2">🤖</div>
                  <div>No AI agent tasks yet</div>
                  <div className="text-sm mt-2">
                    Create your first task to automate legal workflows
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Recent Tasks ({tasks.length})
                  </h3>
                  <button
                    onClick={fetchMatterTasks}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Refresh
                  </button>
                </div>

                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setActiveTask(task.id)}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getTaskStatusIcon(task.status)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {getTaskTypeDisplay(task.agentType)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {task.input.query}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(task.createdAt.toString())}
                      </div>
                    </div>

                    {task.status === 'running' && task.progress !== undefined && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                          <div
                            className="bg-blue-500 h-1 rounded-full transition-all"
                            style={{ width: `${task.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}