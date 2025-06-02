#!/usr/bin/env tsx
// Migration script to standardize existing embeddings to 1536 dimensions
// Usage: npm run migrate:embeddings

import { supabaseAdmin } from '../src/lib/supabase/client';
import { 
  STANDARD_EMBEDDING_DIMENSION,
  getEmbeddingConfig,
  getRecommendedReductionStrategy
} from '../src/lib/embeddings/config';
import { transformToStandardDimension } from '../src/lib/embeddings/dimensionTransform';

async function migrateEmbeddings() {
  console.log('🚀 Starting embedding migration to standard dimension:', STANDARD_EMBEDDING_DIMENSION);
  
  try {
    // Get all document chunks with embeddings
    const { data: chunks, error } = await supabaseAdmin
      .from('document_chunks')
      .select('id, embedding, metadata')
      .not('embedding', 'is', null);
    
    if (error) {
      console.error('❌ Error fetching chunks:', error);
      return;
    }
    
    console.log(`📊 Found ${chunks?.length || 0} chunks with embeddings`);
    
    if (!chunks || chunks.length === 0) {
      console.log('✅ No chunks to migrate');
      return;
    }
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process chunks in batches
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
      
      const updates = [];
      
      for (const chunk of batch) {
        try {
          // Check if embedding is already standard dimension
          if (chunk.embedding && chunk.embedding.length === STANDARD_EMBEDDING_DIMENSION) {
            skippedCount++;
            continue;
          }
          
          // Determine source dimension and transformation strategy
          const sourceDimension = chunk.embedding?.length || 0;
          if (sourceDimension === 0) {
            console.warn(`Chunk ${chunk.id} has no embedding`);
            errorCount++;
            continue;
          }
          
          // Get model info from metadata if available
          const embeddingModel = chunk.metadata?.embeddingModel || 'unknown';
          const modelConfig = getEmbeddingConfig(embeddingModel);
          const strategy = modelConfig ? 
            getRecommendedReductionStrategy(embeddingModel) : 
            'padding';
          
          console.log(`Transforming chunk ${chunk.id}: ${sourceDimension} -> ${STANDARD_EMBEDDING_DIMENSION} (${strategy})`);
          
          // Transform embedding
          const transformedEmbedding = transformToStandardDimension(
            chunk.embedding,
            sourceDimension,
            strategy as any
          );
          
          updates.push({
            id: chunk.id,
            embedding: transformedEmbedding,
            metadata: {
              ...chunk.metadata,
              originalDimension: sourceDimension,
              transformedDimension: STANDARD_EMBEDDING_DIMENSION,
              transformationStrategy: strategy,
              migratedAt: new Date().toISOString()
            }
          });
          
          migratedCount++;
        } catch (error) {
          console.error(`Error processing chunk ${chunk.id}:`, error);
          errorCount++;
        }
      }
      
      // Update batch in database
      if (updates.length > 0) {
        for (const update of updates) {
          const { error: updateError } = await supabaseAdmin
            .from('document_chunks')
            .update({
              embedding: update.embedding,
              metadata: update.metadata
            })
            .eq('id', update.id);
          
          if (updateError) {
            console.error(`Error updating chunk ${update.id}:`, updateError);
            errorCount++;
            migratedCount--; // Rollback count
          }
        }
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Migrated: ${migratedCount} chunks`);
    console.log(`⏭️  Skipped: ${skippedCount} chunks (already standard dimension)`);
    console.log(`❌ Errors: ${errorCount} chunks`);
    console.log(`📊 Total: ${chunks.length} chunks`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateEmbeddings()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });