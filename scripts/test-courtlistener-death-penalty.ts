#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const API_KEY = process.env.COURTLISTENER_API_KEY || 'cc4a34d0ce5e2e173dc4ca56972ed1b6c252b3b1';
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4';

async function testDeathPenaltySearch() {
  console.log('\n🔍 Testing death penalty search queries...\n');
  
  // Test 1: Original query from the logs
  console.log('Test 1: Optimized query from logs');
  const optimizedQuery = 'aggravating factors death penalty determination Texas capital punishment sentencing enhancement statutory factors';
  
  const searchParams = new URLSearchParams({
    q: optimizedQuery,
    type: 'o',
    format: 'json',
    page_size: '10'
  });
  
  const url = `${BASE_URL}/search/?${searchParams}`;
  
  console.log('URL:', url);
  console.log('Query:', optimizedQuery);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_KEY}`
      }
    });
    
    console.log('Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('Results count:', data.count || 0);
    
    if (data.results && data.results.length > 0) {
      console.log('\nFirst result:');
      console.log('- Case:', data.results[0].caseName || data.results[0].case_name);
      console.log('- Court:', data.results[0].court);
      console.log('- Date:', data.results[0].dateFiled);
      console.log('- Snippet:', data.results[0].snippet?.substring(0, 200));
    } else {
      console.log('\nNo results found!');
    }
    
    // Test 2: Simpler query
    console.log('\n\nTest 2: Simpler query');
    const simpleQuery = 'death penalty Texas';
    
    const simpleParams = new URLSearchParams({
      q: simpleQuery,
      type: 'o',
      format: 'json',
      page_size: '10'
    });
    
    const simpleUrl = `${BASE_URL}/search/?${simpleParams}`;
    console.log('URL:', simpleUrl);
    console.log('Query:', simpleQuery);
    
    const simpleResponse = await fetch(simpleUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_KEY}`
      }
    });
    
    const simpleData = await simpleResponse.json();
    console.log('Results count:', simpleData.count || 0);
    
    // Test 3: Even simpler query  
    console.log('\n\nTest 3: Basic query');
    const basicQuery = 'death penalty';
    
    const basicParams = new URLSearchParams({
      q: basicQuery,
      type: 'o',
      format: 'json',
      page_size: '5'
    });
    
    const basicUrl = `${BASE_URL}/search/?${basicParams}`;
    console.log('URL:', basicUrl);
    console.log('Query:', basicQuery);
    
    const basicResponse = await fetch(basicUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_KEY}`
      }
    });
    
    const basicData = await basicResponse.json();
    console.log('Results count:', basicData.count || 0);
    
    // Test 4: Try with court filter
    console.log('\n\nTest 4: With Texas court filter');
    const courtParams = new URLSearchParams({
      q: 'death penalty',
      type: 'o',
      court: 'tex',
      format: 'json',
      page_size: '5'
    });
    
    const courtUrl = `${BASE_URL}/search/?${courtParams}`;
    console.log('URL:', courtUrl);
    
    const courtResponse = await fetch(courtUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_KEY}`
      }
    });
    
    const courtData = await courtResponse.json();
    console.log('Results count:', courtData.count || 0);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDeathPenaltySearch().catch(console.error);