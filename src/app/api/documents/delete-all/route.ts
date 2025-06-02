import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE(req: NextRequest) {
  try {
    // 1. First, get all documents to retrieve storage paths
    const { data: documents, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('id, storage_path');

    if (fetchError) {
      console.error('Error fetching documents:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    const totalDocuments = documents?.length || 0;
    let deletedCount = 0;
    let storageDeletedCount = 0;
    let localDeletedCount = 0;

    if (documents && documents.length > 0) {
      // 2. Delete from Supabase Storage
      const storagePaths = documents
        .filter(doc => doc.storage_path && doc.storage_path.includes('documents/'))
        .map(doc => doc.storage_path.split('documents/')[1])
        .filter(Boolean);

      if (storagePaths.length > 0) {
        try {
          const { error: storageError } = await supabaseAdmin
            .storage
            .from('documents')
            .remove(storagePaths);
          
          if (storageError) {
            console.error('Storage deletion error:', storageError);
          } else {
            storageDeletedCount = storagePaths.length;
          }
        } catch (error) {
          console.error('Error deleting from storage:', error);
        }
      }

      // 3. Delete local files
      const uploadDir = path.join(process.cwd(), 'uploads');
      
      for (const doc of documents) {
        const fileExtensions = ['.pdf', '.docx', '.txt', '-extracted.json', '-embeddings.json'];
        
        for (const ext of fileExtensions) {
          try {
            const filePath = path.join(uploadDir, doc.id + ext);
            await fs.unlink(filePath);
            localDeletedCount++;
          } catch (error) {
            // File might not exist, which is fine
            if ((error as any).code !== 'ENOENT') {
              console.error(`Error deleting file ${doc.id}${ext}:`, error);
            }
          }
        }
      }

      // 4. Delete from database (this will cascade to document_chunks)
      const { error: deleteError } = await supabaseAdmin
        .from('documents')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) {
        console.error('Database deletion error:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete documents from database' },
          { status: 500 }
        );
      }

      deletedCount = totalDocuments;

      // 5. Clean up all chat references
      try {
        // Get all chats with files
        const { data: chats, error: chatsError } = await supabaseAdmin
          .from('chats')
          .select('id')
          .not('files', 'is', null);

        if (!chatsError && chats) {
          // Clear all file references
          await supabaseAdmin
            .from('chats')
            .update({ files: [] })
            .in('id', chats.map(chat => chat.id));
        }
      } catch (error) {
        console.error('Error cleaning up chat references:', error);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'All documents deleted successfully',
      stats: {
        totalDocuments,
        deletedCount,
        storageDeletedCount,
        localDeletedCount
      }
    });

  } catch (error) {
    console.error('Error deleting all documents:', error);
    return NextResponse.json(
      { error: 'Failed to delete all documents' },
      { status: 500 }
    );
  }
}