# Search Providers Setup for Vercel Deployment

This document explains how to configure search providers for deployment on Vercel or other cloud platforms where SearXNG cannot be self-hosted.

## Overview

The application now supports multiple search providers with automatic fallback:
1. **SearXNG** (self-hosted only)
2. **Google Custom Search API** (works on Vercel)
3. **Brave Search API** (works on Vercel)

## Search Provider Configuration

### Google Custom Search API (Recommended for Vercel)

1. **Get API Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable "Custom Search API"
   - Create API credentials (API Key)
   - Go to [Programmable Search Engine](https://programmablesearchengine.google.com/)
   - Create a new search engine
   - Get your Search Engine ID (cx)

2. **Set Environment Variables:**
   ```env
   GOOGLE_SEARCH_API_KEY=your_google_api_key_here
   GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
   ```

3. **Pricing:**
   - Free tier: 100 searches/day
   - Paid: $5 per 1000 queries

### Brave Search API (Alternative)

1. **Get API Key:**
   - Sign up at [Brave Search API](https://brave.com/search/api/)
   - Create an API key

2. **Set Environment Variable:**
   ```env
   BRAVE_SEARCH_API_KEY=your_brave_api_key_here
   ```

3. **Pricing:**
   - Free tier: 2,000 queries/month
   - Paid plans available for higher usage

## CourtListener API (Legal Search)

CourtListener continues to work independently of web search providers.

1. **Get API Key:**
   - Register at [CourtListener](https://www.courtlistener.com/)
   - Get API key from your account settings

2. **Set Environment Variable:**
   ```env
   COURTLISTENER_API_KEY=your_courtlistener_api_key_here
   ```

## How It Works

The search system automatically tries providers in this order:
1. SearXNG (if configured)
2. Google Custom Search (if API key provided)
3. Brave Search (if API key provided)

If all providers fail, it returns empty results.

## Vercel Deployment Setup

Add these environment variables in your Vercel project settings:

### Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `OPENAI_API_KEY`
- `COURTLISTENER_API_KEY`
- `FIRECRAWL_API_KEY`

### At least one of these for web search:
- `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID`
- `BRAVE_SEARCH_API_KEY`

## Testing Your Configuration

After setting up environment variables, test the search functionality:

1. Try a general web search
2. Try a legal case search (uses CourtListener)
3. Check that results are returned properly

## Troubleshooting

1. **No search results:**
   - Check environment variables are set correctly
   - Verify API keys are valid
   - Check API quotas haven't been exceeded

2. **Legal search not working:**
   - Ensure COURTLISTENER_API_KEY is set
   - Verify the key has proper permissions

3. **Deployment fails:**
   - Make sure all required environment variables are set
   - Check build logs for specific errors