import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Try to load from uploads directory first
    const uploadDir = path.join(process.cwd(), 'uploads');
    const extractedPath = path.join(uploadDir, `${id}-extracted.json`);
    
    if (fs.existsSync(extractedPath)) {
      const extractedContent = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
      
      return NextResponse.json({
        id,
        filename: extractedContent.title || 'Document',
        content: extractedContent.contents?.join('\n\n') || '',
        type: 'uploaded_file',
        metadata: extractedContent
      });
    }

    // Fallback: Try to load from Supabase documents table
    const { supabaseAdmin } = await import('@/lib/supabase/client');
    
    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('id, filename, extracted_text, document_type, metadata')
      .eq('id', id)
      .single();

    if (error || !document) {
      // Last resort: try any available file for testing
      try {
        const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('-extracted.json'));
        if (files.length > 0) {
          console.log('🔄 Using fallback file for testing:', files[0]);
          const fallbackPath = path.join(uploadDir, files[0]);
          const extractedContent = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
          
          return NextResponse.json({
            id,
            filename: extractedContent.title || 'Test Document',
            content: extractedContent.contents?.join('\n\n') || '',
            type: 'fallback_file',
            metadata: { ...extractedContent, fallback: true }
          });
        }
      } catch (fallbackError) {
        console.error('Fallback loading failed:', fallbackError);
      }
      
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      content: document.extracted_text || '',
      type: document.document_type || 'document',
      metadata: document.metadata || {}
    });

  } catch (error) {
    console.error('Error loading document content:', error);
    return NextResponse.json(
      { error: 'Failed to load document content' },
      { status: 500 }
    );
  }
}