'use client';

import { useState, useEffect } from 'react';
import { AgentTask, AgentExecution } from '@/lib/agents/types';

interface TaskProgressProps {
  taskId: string;
  onTaskComplete?: (result: any) => void;
  onTaskError?: (error: string) => void;
}

export default function TaskProgress({ taskId, onTaskComplete, onTaskError }: TaskProgressProps) {
  const [task, setTask] = useState<AgentTask | null>(null);
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskId) {
      fetchTaskProgress();
      const interval = setInterval(fetchTaskProgress, 2000); // Poll every 2 seconds
      
      return () => clearInterval(interval);
    }
  }, [taskId]);

  const fetchTaskProgress = async () => {
    try {
      const [taskResponse, executionsResponse] = await Promise.all([
        fetch(`/api/agents/tasks/${taskId}`),
        fetch(`/api/agents/tasks/${taskId}/executions`)
      ]);

      if (taskResponse.ok) {
        const taskData = await taskResponse.json();
        setTask(taskData);

        if (taskData.status === 'completed' && onTaskComplete) {
          onTaskComplete(taskData.output);
        } else if (taskData.status === 'failed' && onTaskError) {
          onTaskError(taskData.error || 'Task failed');
        }
      }

      if (executionsResponse.ok) {
        const executionsData = await executionsResponse.json();
        setExecutions(executionsData);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch task progress');
      setLoading(false);
    }
  };

  const cancelTask = async () => {
    try {
      await fetch(`/api/agents/tasks/${taskId}/cancel`, { method: 'POST' });
      await fetchTaskProgress();
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '⚡';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '🚫';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 dark:text-yellow-400';
      case 'running': return 'text-blue-600 dark:text-blue-400';
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      case 'cancelled': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-500';
    }
  };

  const formatDuration = (startTime: string | Date, endTime?: string | Date) => {
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
    const end = endTime ? (typeof endTime === 'string' ? new Date(endTime) : endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s`;
    } else {
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;
      return `${minutes}m ${seconds}s`;
    }
  };

  const getAgentTypeDisplay = (agentType: string) => {
    const types = {
      'research': 'Legal Research',
      'brief-writing': 'Document Drafting',
      'discovery': 'Discovery Review',
      'contract': 'Contract Analysis'
    };
    return types[agentType as keyof typeof types] || agentType;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="text-sm text-gray-600 dark:text-gray-400">Loading task progress...</span>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="text-red-700 dark:text-red-400">
          {error || 'Task not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Task Status */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">{getStatusIcon(task.status)}</span>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {getAgentTypeDisplay(task.agentType)} Task
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Status: <span className={getStatusColor(task.status)}>{task.status}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {task.status === 'running' && (
              <button
                onClick={cancelTask}
                className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
              >
                Cancel
              </button>
            )}
            
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {task.startedAt && (
                <div>
                  Duration: {formatDuration(task.startedAt, task.completedAt)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {task.status === 'running' && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span>{task.progress || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${task.progress || 0}%` }}
              ></div>
            </div>
            {task.currentStep && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {task.currentStep}
              </div>
            )}
          </div>
        )}

        {/* Task Input Summary */}
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-sm">
            <strong>Query:</strong> {task.input.query}
          </div>
          {task.input.parameters && Object.keys(task.input.parameters).length > 0 && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              <strong>Parameters:</strong> {JSON.stringify(task.input.parameters, null, 2)}
            </div>
          )}
        </div>

        {/* Error Display */}
        {task.error && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <div className="text-sm text-red-700 dark:text-red-400">
              <strong>Error:</strong> {task.error}
            </div>
          </div>
        )}
      </div>

      {/* Execution Details */}
      {executions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Execution Timeline
          </h4>
          
          {executions.map((execution, index) => (
            <div
              key={execution.id}
              className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getStatusIcon(execution.status)}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {getAgentTypeDisplay(execution.agentType)} Execution
                  </span>
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDuration(execution.startedAt, execution.completedAt)}
                </div>
              </div>

              {execution.currentStep && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Current Step: {execution.currentStep}
                </div>
              )}

              {execution.progress > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div
                      className="bg-blue-400 h-1 rounded-full"
                      style={{ width: `${execution.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {execution.errorMessage && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Error: {execution.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Results Display */}
      {task.status === 'completed' && task.output && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
            Task Completed Successfully
          </h4>
          
          {task.output.result && (
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div className="mb-2">
                <strong>Result Summary:</strong>
              </div>
              <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded border overflow-auto max-h-40">
                {typeof task.output.result === 'string' 
                  ? task.output.result 
                  : JSON.stringify(task.output.result, null, 2)
                }
              </pre>
            </div>
          )}

          {task.output.citations && task.output.citations.length > 0 && (
            <div className="mt-3">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Citations ({task.output.citations.length}):
              </div>
              <div className="text-xs space-y-1">
                {task.output.citations.slice(0, 3).map((citation: any, index: number) => (
                  <div key={index} className="p-2 bg-white dark:bg-gray-900 rounded border">
                    <div className="font-medium">{citation.title}</div>
                    {citation.citation && (
                      <div className="text-gray-600 dark:text-gray-400">{citation.citation}</div>
                    )}
                  </div>
                ))}
                {task.output.citations.length > 3 && (
                  <div className="text-gray-500 dark:text-gray-400">
                    ... and {task.output.citations.length - 3} more citations
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}