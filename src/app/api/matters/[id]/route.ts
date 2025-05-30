import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: matter, error } = await supabaseAdmin
      .from('matters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching matter:', error);
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ matter });
  } catch (error) {
    console.error('Error in GET /api/matters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      description,
      matter_number,
      client_name,
      practice_area,
      status,
      tags
    } = body;

    const { data: matter, error } = await supabaseAdmin
      .from('matters')
      .update({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(matter_number !== undefined && { matter_number }),
        ...(client_name !== undefined && { client_name }),
        ...(practice_area !== undefined && { practice_area }),
        ...(status !== undefined && { status }),
        ...(tags !== undefined && { tags }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating matter:', error);
      return NextResponse.json(
        { error: 'Failed to update matter' },
        { status: 500 }
      );
    }

    return NextResponse.json({ matter });
  } catch (error) {
    console.error('Error in PUT /api/matters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('matters')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting matter:', error);
      return NextResponse.json(
        { error: 'Failed to delete matter' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/matters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}