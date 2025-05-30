import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const supabase = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { matterId, agentType, query, parameters } = await request.json();

    if (!matterId || !agentType || !query) {
      return NextResponse.json(
        { error: 'Missing required fields: matterId, agentType, query' },
        { status: 400 }
      );
    }

    // Create agent task record
    const { data: task, error } = await supabase
      .from('agent_tasks')
      .insert({
        matter_id: matterId,
        task_type: agentType,
        task_name: `${agentType} - ${query.substring(0, 50)}...`,
        description: query,
        status: 'pending',
        input_config: {
          query,
          parameters: parameters || {},
          matterId
        }
      })
      .select('*')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create agent task' },
        { status: 500 }
      );
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
      progress: 0,
      error: task.error_message
    };

    return NextResponse.json(transformedTask);
  } catch (error) {
    console.error('Error creating agent task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matterId = searchParams.get('matterId');

    let query = supabase
      .from('agent_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (matterId) {
      query = query.eq('matter_id', matterId);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch agent tasks' },
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
    console.error('Error fetching agent tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}