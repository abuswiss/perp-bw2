import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const supabase = supabaseAdmin;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    const { data: executions, error } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch task executions' },
        { status: 500 }
      );
    }

    // Transform to match expected format
    const transformedExecutions = (executions || []).map(execution => ({
      id: execution.id,
      taskId: execution.task_id,
      agentType: execution.agent_type,
      status: execution.status,
      inputData: execution.input_data,
      outputData: execution.output_data,
      errorMessage: execution.error_message,
      startedAt: execution.started_at,
      completedAt: execution.completed_at,
      progress: 0, // TODO: Add progress tracking
      currentStep: execution.status === 'running' ? 'Processing...' : execution.status
    }));

    return NextResponse.json(transformedExecutions);
  } catch (error) {
    console.error('Error fetching task executions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}