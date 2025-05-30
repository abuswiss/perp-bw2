import { AgentTask, AgentExecution } from './types';
import { supabaseAdmin } from '@/lib/supabase/client';

export class AgentTaskQueue {
  private supabase = supabaseAdmin;
  private runningTasks = new Map<string, AbortController>();

  async createTask(
    matterId: string | null,
    agentType: string,
    input: any,
    taskName?: string
  ): Promise<AgentTask> {
    const task: Omit<AgentTask, 'id' | 'createdAt'> = {
      matterId,
      agentType,
      status: 'pending',
      input,
      progress: 0
    };

    // Generate task name if not provided
    const generatedTaskName = taskName || this.generateTaskName(agentType, input.query);
    
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .insert({
        matter_id: task.matterId,
        task_type: task.agentType,
        task_name: generatedTaskName,
        status: task.status,
        input_config: task.input
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create agent task: ${error.message}`);
    }

    return {
      id: data.id,
      matterId: data.matter_id,
      agentType: data.task_type,
      status: data.status,
      input: data.input_config,
      output: data.output_data,
      createdAt: new Date(data.created_at),
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      progress: 0
    };
  }

  async updateTaskStatus(
    taskId: string,
    status: AgentTask['status'],
    progress?: number,
    output?: any,
    error?: string
  ): Promise<void> {
    const updates: any = { status };
    
    if (progress !== undefined) {
      updates.progress = progress;
    }
    
    if (output) {
      updates.output_data = output;
    }
    
    if (error) {
      updates.error_message = error;
    }
    
    if (status === 'running') {
      updates.started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await this.supabase
      .from('agent_tasks')
      .update(updates)
      .eq('id', taskId);

    if (updateError) {
      throw new Error(`Failed to update task status: ${updateError.message}`);
    }
  }

  async getTask(taskId: string): Promise<AgentTask | null> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get task: ${error.message}`);
    }

    return {
      id: data.id,
      matterId: data.matter_id,
      agentType: data.task_type,
      status: data.status,
      input: data.input_config,
      output: data.output_data,
      createdAt: new Date(data.created_at),
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      progress: data.progress || 0,
      error: data.error_message
    };
  }

  async getMatterTasks(matterId: string): Promise<AgentTask[]> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get matter tasks: ${error.message}`);
    }

    return data.map(item => ({
      id: item.id,
      matterId: item.matter_id,
      agentType: item.task_type,
      status: item.status,
      input: item.input_config,
      output: item.output_data,
      createdAt: new Date(item.created_at),
      startedAt: item.started_at ? new Date(item.started_at) : undefined,
      completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
      progress: item.progress || 0,
      error: item.error_message
    }));
  }

  async getPendingTasks(): Promise<AgentTask[]> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get pending tasks: ${error.message}`);
    }

    return data.map(item => ({
      id: item.id,
      matterId: item.matter_id,
      agentType: item.task_type,
      status: item.status,
      input: item.input_config,
      output: item.output_data,
      createdAt: new Date(item.created_at),
      startedAt: item.started_at ? new Date(item.started_at) : undefined,
      completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
      progress: item.progress || 0,
      error: item.error_message
    }));
  }

  async cancelTask(taskId: string): Promise<void> {
    const controller = this.runningTasks.get(taskId);
    if (controller) {
      controller.abort();
      this.runningTasks.delete(taskId);
    }

    await this.updateTaskStatus(taskId, 'cancelled');
  }

  setTaskController(taskId: string, controller: AbortController): void {
    this.runningTasks.set(taskId, controller);
  }

  removeTaskController(taskId: string): void {
    this.runningTasks.delete(taskId);
  }

  async getTaskExecutions(taskId: string): Promise<AgentExecution[]> {
    const { data, error } = await this.supabase
      .from('agent_executions')
      .select('*')
      .eq('task_id', taskId)
      .order('started_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get task executions: ${error.message}`);
    }

    return data.map(item => ({
      id: item.id,
      taskId: item.task_id,
      agentType: item.agent_type,
      status: item.status,
      inputData: item.input_data,
      outputData: item.output_data,
      errorMessage: item.error_message,
      startedAt: new Date(item.started_at),
      completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
      progress: item.progress || 0,
      currentStep: item.current_step || ''
    }));
  }

  async getRunningTasks(): Promise<AgentTask[]> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get running tasks: ${error.message}`);
    }

    return data.map(item => ({
      id: item.id,
      matterId: item.matter_id,
      agentType: item.task_type,
      status: item.status,
      input: item.input_config,
      output: item.output_data,
      createdAt: new Date(item.created_at),
      startedAt: item.started_at ? new Date(item.started_at) : undefined,
      completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
      progress: item.progress || 0,
      error: item.error_message
    }));
  }

  private generateTaskName(agentType: string, query: string): string {
    const agentNames = {
      research: 'Legal Research',
      'brief-writing': 'Brief Writing',
      discovery: 'Discovery Review',
      contract: 'Contract Analysis'
    };
    
    const agentName = agentNames[agentType as keyof typeof agentNames] || agentType;
    const truncatedQuery = query.length > 50 ? query.substring(0, 50) + '...' : query;
    
    return `${agentName}: ${truncatedQuery}`;
  }
}