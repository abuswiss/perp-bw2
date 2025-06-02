#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const API_KEY = process.env.COURTLISTENER_API_KEY || 'cc4a34d0ce5e2e173dc4ca56972ed1b6c252b3b1';
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4';

async function makeRequest(endpoint: string) {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Token ${API_KEY}`
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, { headers });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function testFullTextRetrieval() {
  console.log('🔍 Testing Full Text Retrieval Strategy\n');

  // Step 1: Search for cases
  console.log('Step 1: Searching for "death penalty Texas" cases...');
  const searchParams = new URLSearchParams({
    q: 'death penalty Texas',
    type: 'o',
    format: 'json',
    page_size: '3' // Just get a few for testing
  });

  const searchResults = await makeRequest(`/search/?${searchParams}`);
  console.log(`Found ${searchResults.count} total results\n`);

  // Step 2: Get full text for each result
  for (const result of searchResults.results) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Case: ${result.caseName}`);
    console.log(`Court: ${result.court}`);
    console.log(`Date: ${result.dateFiled}`);
    console.log(`Cluster ID: ${result.cluster_id}`);

    // Check if we have opinion IDs
    if (result.opinions && result.opinions.length > 0) {
      console.log(`\nFound ${result.opinions.length} opinion(s)`);
      
      // Get the first opinion's full text
      const opinionId = result.opinions[0].id;
      console.log(`Fetching opinion ${opinionId}...`);
      
      try {
        const opinion = await makeRequest(`/opinions/${opinionId}/`);
        
        console.log(`\nOpinion Details:`);
        console.log(`- Type: ${opinion.type}`);
        console.log(`- Author: ${opinion.author_str || 'Unknown'}`);
        console.log(`- Download URL: ${opinion.download_url}`);
        
        if (opinion.plain_text) {
          const textSnippet = opinion.plain_text.substring(0, 500).replace(/\n+/g, ' ');
          console.log(`\nText Preview (first 500 chars):`);
          console.log(`"${textSnippet}..."`);
          console.log(`\nTotal text length: ${opinion.plain_text.length} characters`);
        } else {
          console.log('\n⚠️  No plain text available for this opinion');
        }
      } catch (error) {
        console.log(`\n❌ Error fetching opinion: ${error}`);
      }
    } else {
      console.log('\n⚠️  No opinions linked to this search result');
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 3: Try alternative approach - search opinions directly
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('Alternative Approach: Direct Opinion Search');
  console.log(`${'='.repeat(60)}\n`);

  const opinionParams = new URLSearchParams({
    plain_text__icontains: 'death penalty Texas',
    page_size: '3'
  });

  const opinionResults = await makeRequest(`/opinions/?${opinionParams}`);
  console.log(`Found ${opinionResults.count} opinions with text matching "death penalty Texas"\n`);

  for (const opinion of opinionResults.results) {
    console.log(`Opinion ID: ${opinion.id}`);
    console.log(`Cluster: ${opinion.cluster}`);
    
    if (opinion.plain_text) {
      const relevantText = extractRelevantPassages(opinion.plain_text, 'death penalty Texas');
      console.log(`\nRelevant passages:`);
      relevantText.forEach((passage, i) => {
        console.log(`\n${i + 1}. "${passage}"`);
      });
    }
    console.log(`\n${'-'.repeat(60)}`);
  }
}

function extractRelevantPassages(text: string, query: string): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 50);
  const queryTerms = query.toLowerCase().split(/\s+/);
  
  const relevantSentences = sentences
    .filter(sentence => {
      const lower = sentence.toLowerCase();
      return queryTerms.some(term => lower.includes(term));
    })
    .slice(0, 3)
    .map(s => s.trim().substring(0, 200));
    
  return relevantSentences;
}

// Run the test
testFullTextRetrieval().catch(console.error);