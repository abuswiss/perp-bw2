import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function GET() {
  try {
    const { data: matters, error } = await supabaseAdmin
      .from('matters')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching matters:', error);
      return NextResponse.json(
        { error: 'Failed to fetch matters' },
        { status: 500 }
      );
    }

    return NextResponse.json({ matters });
  } catch (error) {
    console.error('Error in GET /api/matters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      matter_number,
      client_name,
      practice_area,
      status = 'active',
      tags = []
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Matter name is required' },
        { status: 400 }
      );
    }

    // For now, create matters without organization/user association
    // In a real app, you'd get these from authentication
    const { data: matter, error } = await supabaseAdmin
      .from('matters')
      .insert({
        name,
        description,
        matter_number,
        client_name,
        practice_area,
        status,
        tags,
        metadata: {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating matter:', error);
      return NextResponse.json(
        { error: 'Failed to create matter' },
        { status: 500 }
      );
    }

    return NextResponse.json({ matter }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/matters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}