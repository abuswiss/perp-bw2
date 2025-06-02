# Embedding Standardization Guide

## Overview

BenchWise/Perplexica uses a standardized embedding dimension of **1536** across all embedding models to ensure compatibility with the vector database and similarity search functions.

## Why 1536 Dimensions?

- **OpenAI Standard**: OpenAI's text-embedding-3-small model uses 1536 dimensions by default
- **Good Balance**: Provides a good balance between accuracy and storage/compute costs
- **Wide Support**: Many vector databases are optimized for this dimension
- **Configurable**: OpenAI's text-embedding-3-large can be configured to output 1536 dimensions

## Supported Embedding Models

### OpenAI Models (Native 1536)
- **text-embedding-3-small**: Default 1536 dimensions, most cost-effective
- **text-embedding-3-large**: Configured to use 1536 dimensions (instead of default 3072)

### Other Models (Transformed to 1536)
- **Gemini text-embedding-004**: 768 dimensions → padded to 1536
- **Transformers models**: 384 dimensions → padded to 1536
- **Ollama models**: Variable dimensions → transformed to 1536

## Transformation Strategies

### 1. Padding (for dimensions < 1536)
- Used for models with fewer dimensions (384, 768)
- Pads with zeros to reach 1536 dimensions
- Simple and preserves original information

### 2. Linear Projection (for dimensions > 1536)
- Used for models with more dimensions
- Averages nearby dimensions to reduce to 1536
- Better than truncation as it preserves more information

### 3. Direct Configuration (OpenAI only)
- text-embedding-3-large can be configured to output 1536 dimensions directly
- No transformation needed

## Implementation

### Using Standardized Embeddings

```typescript
import { createStandardizedEmbeddings } from '@/lib/embeddings/standardizedEmbeddings';

// Create embeddings that will always output 1536 dimensions
const embeddings = await createStandardizedEmbeddings(
  'openai',                    // provider
  'text-embedding-3-small',    // model
  process.env.OPENAI_API_KEY   // API key
);

// Generate embeddings (guaranteed to be 1536 dimensions)
const vectors = await embeddings.embedDocuments(['text1', 'text2']);
```

### Database Schema

```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- Fixed at 1536 dimensions
  -- ... other columns
);
```

### Vector Search Function

```sql
CREATE OR REPLACE FUNCTION search_document_chunks(
  query_embedding vector(1536),  -- Must be 1536 dimensions
  match_count INT DEFAULT 10,
  filter_matter_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
```

## Migration

For existing embeddings with different dimensions:

```bash
# Run the migration script
npm run migrate:embeddings
```

This will:
1. Identify embeddings with non-standard dimensions
2. Transform them to 1536 dimensions using appropriate strategies
3. Update metadata to track the transformation

## Best Practices

1. **Always use StandardizedEmbeddings**: Don't use embedding models directly
2. **Validate dimensions**: Always validate that embeddings are 1536 dimensions before storage
3. **Track model info**: Store embedding model info in metadata for debugging
4. **Monitor costs**: text-embedding-3-small is most cost-effective for most use cases

## Cost Comparison

| Model | Dimensions | Cost per 1M tokens | Notes |
|-------|------------|-------------------|-------|
| text-embedding-3-small | 1536 | $0.02 | Best value, recommended default |
| text-embedding-3-large | 1536* | $0.13 | Higher accuracy, configured to 1536 |
| Gemini text-embedding-004 | 768→1536 | ~$0.00001/1K chars | Requires padding |
| Transformers (local) | 384→1536 | Free | Lower quality, requires padding |

*Configured to output 1536 instead of default 3072

## Troubleshooting

### Dimension Mismatch Error
- Ensure you're using StandardizedEmbeddings wrapper
- Check that the embedding model is properly configured
- Verify database schema has vector(1536)

### Poor Search Results
- Consider using a higher quality model (text-embedding-3-large)
- Adjust similarity threshold in search queries
- Check if transformation strategy is appropriate

### Migration Issues
- Ensure Supabase pgvector extension is enabled
- Check that all chunks have valid embeddings
- Review migration logs for specific errors