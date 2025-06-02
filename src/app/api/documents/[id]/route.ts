import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // 1. First, get the document to retrieve storage path and other details
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 2. Delete from Supabase Storage if exists
    if (document.storage_path && document.storage_path.includes('documents/')) {
      try {
        // Extract the path after 'documents/' for the storage API
        const storagePath = document.storage_path.split('documents/')[1];
        if (storagePath) {
          const { error: storageError } = await supabaseAdmin
            .storage
            .from('documents')
            .remove([storagePath]);
          
          if (storageError) {
            console.error('Storage deletion error:', storageError);
            // Continue with deletion even if storage fails
          }
        }
      } catch (error) {
        console.error('Error deleting from storage:', error);
      }
    }

    // 3. Delete local files if they exist
    const uploadDir = path.join(process.cwd(), 'uploads');
    const fileExtensions = ['.pdf', '.docx', '.txt', '-extracted.json', '-embeddings.json'];
    
    for (const ext of fileExtensions) {
      try {
        const filePath = path.join(uploadDir, id + ext);
        await fs.unlink(filePath);
        console.log(`Deleted local file: ${filePath}`);
      } catch (error) {
        // File might not exist, which is fine
        if ((error as any).code !== 'ENOENT') {
          console.error(`Error deleting file ${id}${ext}:`, error);
        }
      }
    }

    // 4. Delete from database (this will cascade to document_chunks due to foreign key)
    const { error: deleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete document from database' },
        { status: 500 }
      );
    }

    // 5. Clean up any references in chats
    try {
      // Get all chats that might reference this document
      const { data: chats, error: chatsError } = await supabaseAdmin
        .from('chats')
        .select('id, files')
        .not('files', 'is', null);

      if (!chatsError && chats) {
        // Update chats to remove this document ID from files array
        for (const chat of chats) {
          if (Array.isArray(chat.files) && chat.files.includes(id)) {
            const updatedFiles = chat.files.filter((fileId: string) => fileId !== id);
            await supabaseAdmin
              .from('chats')
              .update({ files: updatedFiles })
              .eq('id', chat.id);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up chat references:', error);
      // Continue - this is not critical
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Document deleted successfully',
      deletedId: id 
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}