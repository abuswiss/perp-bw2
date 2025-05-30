import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { LegalOrchestrator } from '@/lib/orchestrator/LegalOrchestrator';

const supabase = supabaseAdmin;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    // Get the task
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (task.status !== 'pending') {
      return NextResponse.json(
        { error: 'Task is not in pending status' },
        { status: 400 }
      );
    }

    // Update task status to running
    await supabase
      .from('agent_tasks')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', taskId);

    // Execute the task asynchronously
    executeTaskAsync(taskId, task);

    return NextResponse.json({ 
      success: true, 
      message: 'Task execution started',
      taskId 
    });

  } catch (error) {
    console.error('Error executing agent task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function executeTaskAsync(taskId: string, task: any) {
  try {
    const orchestrator = new LegalOrchestrator();
    
    // Create agent execution record
    const { data: execution } = await supabase
      .from('agent_executions')
      .insert({
        task_id: taskId,
        agent_type: task.task_type,
        status: 'running',
        input_data: task.input_config,
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    const executionId = execution?.id;

    // Execute the agent directly
    const result = await orchestrator.executeDirectly(
      task.task_type,
      {
        matterId: task.matter_id,
        query: task.input_config.query,
        parameters: task.input_config.parameters,
        context: { task_id: taskId, execution_id: executionId }
      }
    );

    // Update task with result
    await supabase
      .from('agent_tasks')
      .update({
        status: result.success ? 'completed' : 'failed',
        output_data: result.result,
        error_message: result.error,
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId);

    // Update execution
    if (executionId) {
      await supabase
        .from('agent_executions')
        .update({
          status: result.success ? 'completed' : 'failed',
          output_data: result,
          error_message: result.error,
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId);
    }

    console.log(`Task ${taskId} completed with status: ${result.success ? 'success' : 'failed'}`);

  } catch (error) {
    console.error(`Error executing task ${taskId}:`, error);
    
    // Update task with error
    await supabase
      .from('agent_tasks')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId);
  }
}