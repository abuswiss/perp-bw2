import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

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

    if (!['pending', 'running'].includes(task.status)) {
      return NextResponse.json(
        { error: 'Task cannot be cancelled in current status' },
        { status: 400 }
      );
    }

    // Update task status to cancelled
    await supabase
      .from('agent_tasks')
      .update({ 
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId);

    // Cancel any running executions
    await supabase
      .from('agent_executions')
      .update({
        status: 'failed',
        error_message: 'Task cancelled by user',
        completed_at: new Date().toISOString()
      })
      .eq('task_id', taskId)
      .eq('status', 'running');

    return NextResponse.json({ 
      success: true, 
      message: 'Task cancelled successfully' 
    });

  } catch (error) {
    console.error('Error cancelling agent task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}