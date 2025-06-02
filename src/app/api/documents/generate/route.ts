import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Schema for document generation request
const GenerateDocumentSchema = z.object({
  matterId: z.string().uuid().nullable(),
  content: z.string().min(1, "Content cannot be empty"),
  documentType: z.enum([
    'brief',
    'memo',
    'motion',
    'contract',
    'discovery',
    'opinion',
    'research',
    'other'
  ]),
  title: z.string().optional(),
  metadata: z.object({
    generated_by: z.enum(['agent', 'user', 'api']).default('api'),
    agent_type: z.string().optional(),
    task_id: z.string().uuid().optional(),
    source_query: z.string().optional(),
    word_count: z.number().optional(),
    page_count: z.number().optional(),
    citations: z.number().optional(),
    outline: z.any().optional()
  }).optional(),
  userId: z.string().uuid().optional()
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validate request body
    const validationResult = GenerateDocumentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { 
      matterId, 
      content, 
      documentType, 
      title, 
      metadata = {}, 
      userId 
    } = validationResult.data;

    // Generate document ID and filename
    const documentId = uuidv4();
    const timestamp = new Date().toISOString();
    const sanitizedTitle = title?.replace(/[^a-zA-Z0-9-_ ]/g, '_') || documentType;
    const filename = `${sanitizedTitle}_${timestamp.split('T')[0]}_${documentId.substring(0, 8)}.md`;

    // Calculate content metrics
    const contentSize = Buffer.byteLength(content, 'utf8');
    const wordCount = (metadata as any)?.word_count || content.split(/\s+/).filter(word => word.length > 0).length;
    const pageCount = (metadata as any)?.page_count || Math.ceil(wordCount / 250);

    // Prepare document data
    const documentData = {
      id: documentId,
      matter_id: matterId,
      filename: filename,
      file_type: 'text/markdown',
      file_size: contentSize,
      extracted_text: content,
      summary: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      document_type: documentType,
      processing_status: 'completed',
      created_by: userId || null,
      metadata: {
        source: 'ai_generated',
        generated_by: (metadata as any)?.generated_by || 'api',
        generation_timestamp: timestamp,
        generation_method: 'api_endpoint',
        ...metadata,
        word_count: wordCount,
        page_count: pageCount,
        content_format: 'markdown',
        api_version: '1.0'
      }
    };

    // Insert document into database
    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert(documentData)
      .select()
      .single();

    if (error) {
      console.error('Error creating document:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to save document',
          details: error.message 
        },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      document: {
        id: data.id,
        filename: data.filename,
        documentType: data.document_type,
        fileSize: data.file_size,
        wordCount: wordCount,
        pageCount: pageCount,
        matterId: data.matter_id,
        createdAt: data.created_at,
        metadata: data.metadata
      }
    });

  } catch (error) {
    console.error('Error in document generation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve generated documents
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const matterId = searchParams.get('matterId');
    const documentType = searchParams.get('documentType');
    const generatedBy = searchParams.get('generatedBy');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabaseAdmin
      .from('documents')
      .select('*')
      .eq('metadata->>source', 'ai_generated')
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Apply filters
    if (matterId) {
      query = query.eq('matter_id', matterId);
    }
    if (documentType) {
      query = query.eq('document_type', documentType);
    }
    if (generatedBy) {
      query = query.eq('metadata->>generated_by', generatedBy);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch documents',
          details: error.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documents: data,
      total: count,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error fetching generated documents:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}