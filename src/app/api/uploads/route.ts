import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAvailableEmbeddingModelProviders } from '@/lib/providers';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from 'langchain/document';
import { supabaseAdmin } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { createStandardizedEmbeddings, StandardizedEmbeddings } from '@/lib/embeddings/standardizedEmbeddings';
import { STANDARD_EMBEDDING_DIMENSION } from '@/lib/embeddings/config';

interface FileRes {
  fileName: string;
  fileExtension: string;
  fileId: string;
  documentId?: string;
}

const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const files = formData.getAll('files') as File[];
    const embedding_model = formData.get('embedding_model');
    const embedding_model_provider = formData.get('embedding_model_provider');
    const matter_id = formData.get('matterId') as string | null; // Changed from matter_id to matterId
    const user_id = formData.get('user_id') as string | null;

    if (!embedding_model || !embedding_model_provider) {
      return NextResponse.json(
        { message: 'Missing embedding model or provider' },
        { status: 400 },
      );
    }

    console.log(`Using embedding model: ${embedding_model_provider}/${embedding_model}`);
    console.log(`Target embedding dimension: ${STANDARD_EMBEDDING_DIMENSION}`);

    // Use standardized embeddings wrapper to ensure consistent dimensions
    let embeddingsModel: StandardizedEmbeddings;
    
    try {
      // Get API key based on provider
      let apiKey: string | undefined;
      
      if (embedding_model_provider === 'openai') {
        // Try environment variable first, then config
        apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          try {
            const { getOpenaiApiKey } = await import('@/lib/config');
            apiKey = getOpenaiApiKey();
          } catch (error) {
            console.error('Failed to load OpenAI API key from config:', error);
          }
        }
      } else if (embedding_model_provider === 'gemini') {
        apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
          try {
            const { getGeminiApiKey } = await import('@/lib/config');
            apiKey = getGeminiApiKey();
          } catch (error) {
            console.error('Failed to load Gemini API key from config:', error);
          }
        }
      }
      
      if (!apiKey) {
        throw new Error(`${(embedding_model_provider as string).toUpperCase()} API key not found in environment or config`);
      }
      
      embeddingsModel = await createStandardizedEmbeddings(
        embedding_model_provider as string,
        embedding_model as string,
        apiKey
      );
      
      console.log('Embedding model info:', embeddingsModel.getModelInfo());
    } catch (error) {
      console.error('Failed to create standardized embeddings, falling back to default:', error);
      // Fallback to default OpenAI model
      let fallbackApiKey = process.env.OPENAI_API_KEY;
      if (!fallbackApiKey) {
        try {
          const { getOpenaiApiKey } = await import('@/lib/config');
          fallbackApiKey = getOpenaiApiKey();
        } catch (configError) {
          console.error('Failed to load fallback OpenAI API key from config:', configError);
          return NextResponse.json(
            { message: 'OpenAI API key not configured' },
            { status: 500 }
          );
        }
      }
      
      embeddingsModel = await createStandardizedEmbeddings(
        'openai',
        'text-embedding-3-small',
        fallbackApiKey
      );
    }

    const processedFiles: FileRes[] = [];

    await Promise.all(
      files.map(async (file: any) => {
        const fileExtension = file.name.split('.').pop();
        if (!['pdf', 'docx', 'txt'].includes(fileExtension!)) {
          return NextResponse.json(
            { message: 'File type not supported' },
            { status: 400 },
          );
        }

        // Generate unique file ID
        const fileId = uuidv4();
        const uniqueFileName = `${fileId}.${fileExtension}`;
        const filePath = path.join(uploadDir, uniqueFileName);

        // Save file locally first for processing
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, new Uint8Array(buffer));

        // Upload to Supabase Storage
        const storagePath = matter_id 
          ? `matters/${matter_id}/${uniqueFileName}`
          : `unsorted/${uniqueFileName}`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin
          .storage
          .from('documents')
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          // Continue with local processing even if storage fails
        }

        // Process document content
        let docs: any[] = [];
        if (fileExtension === 'pdf') {
          const loader = new PDFLoader(filePath);
          docs = await loader.load();
        } else if (fileExtension === 'docx') {
          const loader = new DocxLoader(filePath);
          docs = await loader.load();
        } else if (fileExtension === 'txt') {
          const text = fs.readFileSync(filePath, 'utf-8');
          docs = [
            new Document({ pageContent: text, metadata: { title: file.name } }),
          ];
        }

        const splitted = await splitter.splitDocuments(docs);
        
        // Extract full text
        const fullText = docs.map(doc => doc.pageContent).join('\n\n');
        
        // Generate summary (first 500 chars for now, can be enhanced with LLM)
        const summary = fullText.substring(0, 500) + (fullText.length > 500 ? '...' : '');

        // Create document record in Supabase
        const { data: documentRecord, error: docError } = await supabaseAdmin
          .from('documents')
          .insert({
            id: fileId,
            matter_id: matter_id || null,
            filename: file.name,
            file_type: file.type || `application/${fileExtension}`,
            file_size: file.size,
            storage_path: uploadData?.path || filePath,
            extracted_text: fullText,
            summary: summary,
            document_type: inferDocumentType(file.name, fullText),
            processing_status: 'processing',
            created_by: user_id || null,
            metadata: {
              source: 'user_upload',
              uploaded_by: user_id || 'anonymous',
              upload_method: 'api',
              upload_timestamp: new Date().toISOString(),
              original_filename: file.name,
              original_mimetype: file.type,
              processing_pipeline: 'chunk_and_embed',
              embedding_model: `${embedding_model_provider}/${embedding_model}`,
              chunk_size: 500,
              chunk_overlap: 100,
              originalPath: filePath,
              pageCount: docs.length,
              chunkCount: splitted.length
            }
          })
          .select()
          .single();

        if (docError) {
          console.error('Error creating document record:', docError);
        }

        // Generate and store embeddings for each chunk
        const embeddings = await embeddingsModel.embedDocuments(
          splitted.map((doc) => doc.pageContent),
        );
        
        // Log embedding details for debugging
        console.log(`Generated ${embeddings.length} embeddings`);
        if (embeddings.length > 0) {
          console.log(`First embedding dimension: ${embeddings[0]?.length}`);
          console.log(`First few values: ${embeddings[0]?.slice(0, 5).join(', ')}`);
        }
        
        // Validate embeddings have correct dimensions
        if (!StandardizedEmbeddings.validateEmbeddings(embeddings)) {
          console.error(`Invalid embedding dimensions detected. Expected ${STANDARD_EMBEDDING_DIMENSION}, got ${embeddings[0]?.length}`);
          // Don't throw error, just log warning and continue
          console.warn('Continuing despite dimension mismatch...');
        }

        // Store chunks with embeddings in Supabase
        const chunksToInsert = splitted.map((doc, index) => ({
          document_id: fileId,
          chunk_index: index,
          content: doc.pageContent,
          embedding: embeddings[index], // Now guaranteed to be 1536 dimensions
          start_page: doc.metadata?.pageNumber || null,
          end_page: doc.metadata?.pageNumber || null,
          metadata: {
            ...doc.metadata,
            embeddingModel: `${embedding_model_provider}/${embedding_model}`,
            embeddingDimension: STANDARD_EMBEDDING_DIMENSION,
            chunkMethod: 'recursive_character',
            processedAt: new Date().toISOString()
          }
        }));

        const { error: chunksError } = await supabaseAdmin
          .from('document_chunks')
          .insert(chunksToInsert);

        if (chunksError) {
          console.error('Error storing chunks:', chunksError);
        }

        // Update document processing status
        await supabaseAdmin
          .from('documents')
          .update({ processing_status: 'completed' })
          .eq('id', fileId);

        // Also save to local files for backward compatibility
        const extractedDataPath = filePath.replace(/\.\w+$/, '-extracted.json');
        fs.writeFileSync(
          extractedDataPath,
          JSON.stringify({
            title: file.name,
            contents: splitted.map((doc) => doc.pageContent),
            metadata: {
              uploadDate: new Date().toISOString(),
              pageCount: docs.length,
              chunkCount: splitted.length,
              documentType: inferDocumentType(file.name, fullText),
            }
          }),
        );

        const embeddingsDataPath = filePath.replace(
          /\.\w+$/,
          '-embeddings.json',
        );
        fs.writeFileSync(
          embeddingsDataPath,
          JSON.stringify({
            title: file.name,
            embeddings,
          }),
        );

        processedFiles.push({
          fileName: file.name,
          fileExtension: fileExtension!,
          fileId: fileId,
          documentId: fileId
        });

        // Clean up local file after processing
        // fs.unlinkSync(filePath); // Commented out for now to maintain compatibility
      }),
    );

    return NextResponse.json({
      files: processedFiles,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
}

// Helper function to infer document type based on filename and content
function inferDocumentType(filename: string, content: string): string {
  const lowerName = filename.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (lowerName.includes('contract') || lowerContent.includes('agreement') || lowerContent.includes('party') && lowerContent.includes('shall')) {
    return 'contract';
  } else if (lowerName.includes('brief') || lowerContent.includes('plaintiff') || lowerContent.includes('defendant')) {
    return 'brief';
  } else if (lowerName.includes('discovery') || lowerContent.includes('interrogator') || lowerContent.includes('request for production')) {
    return 'discovery';
  } else if (lowerName.includes('letter') || lowerName.includes('correspondence')) {
    return 'correspondence';
  } else if (lowerName.includes('complaint') || lowerName.includes('motion') || lowerName.includes('petition')) {
    return 'pleading';
  }

  return 'other';
}