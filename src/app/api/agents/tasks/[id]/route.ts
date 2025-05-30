import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const supabase = supabaseAdmin;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    const { data: task, error } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch task' },
        { status: 500 }
      );
    }

    // Get latest execution to calculate progress
    const { data: executions } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    let progress = 0;
    let currentStep = 'Pending';

    if (executions && executions.length > 0) {
      const latestExecution = executions[0];
      progress = latestExecution.progress || 0;
      currentStep = latestExecution.current_step || 'Running';
    }

    // Transform to match expected format
    const transformedTask = {
      id: task.id,
      matterId: task.matter_id,
      agentType: task.task_type,
      status: task.status,
      input: task.input_config,
      output: task.output_data,
      createdAt: task.created_at,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      progress,
      currentStep,
      error: task.error_message
    };

    return NextResponse.json(transformedTask);
  } catch (error) {
    console.error('Error fetching agent task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const updates = await request.json();

    const { data: task, error } = await supabase
      .from('agent_tasks')
      .update({
        status: updates.status,
        output_data: updates.output,
        error_message: updates.error,
        started_at: updates.status === 'running' ? new Date().toISOString() : undefined,
        completed_at: ['completed', 'failed', 'cancelled'].includes(updates.status) 
          ? new Date().toISOString() 
          : undefined
      })
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating agent task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}