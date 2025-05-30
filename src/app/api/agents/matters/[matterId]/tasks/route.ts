import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const supabase = supabaseAdmin;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;

    const { data: tasks, error } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch matter tasks' },
        { status: 500 }
      );
    }

    // Transform to match expected format
    const transformedTasks = (tasks || []).map(task => ({
      id: task.id,
      matterId: task.matter_id,
      agentType: task.task_type,
      status: task.status,
      input: task.input_config,
      output: task.output_data,
      createdAt: task.created_at,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      progress: 0, // TODO: Calculate from executions
      error: task.error_message
    }));

    return NextResponse.json(transformedTasks);
  } catch (error) {
    console.error('Error fetching matter tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}