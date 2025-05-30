import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const { title, content, documentType, matterId } = await req.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        filename: title,
        content: content,
        document_type: documentType || 'brief',
        matter_id: matterId || null,
        created_at: new Date().toISOString(),
        metadata: {
          generated_by: 'ai',
          word_count: content.split(' ').length,
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving document:', error);
      return NextResponse.json(
        { error: 'Failed to save document' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      document: data,
      message: 'Document saved successfully'
    });

  } catch (error) {
    console.error('Error in document save API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const matterId = searchParams.get('matterId');

    let query = supabaseAdmin
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (matterId) {
      query = query.eq('matter_id', matterId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents: data });

  } catch (error) {
    console.error('Error in document fetch API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}