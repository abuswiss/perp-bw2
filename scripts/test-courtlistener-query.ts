import { CourtListenerAPI } from '../src/lib/integrations/courtlistener';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function testCourtListenerQueries() {
  const api = new CourtListenerAPI();
  
  console.log('Testing CourtListener API queries...\n');
  console.log('API Key configured:', !!process.env.COURTLISTENER_API_KEY);
  console.log('API Key length:', process.env.COURTLISTENER_API_KEY?.length || 0);
  console.log('---\n');

  // Test queries - original vs optimized
  const testCases = [
    {
      name: 'Original user query',
      query: 'What are the aggravating factors for a death penalty determination under Texas law?'
    },
    {
      name: 'LLM-optimized query (with quotes)',
      query: '"aggravating factors death penalty determination Texas capital punishment sentencing enhancement statutory factors"'
    },
    {
      name: 'LLM-optimized query (without quotes)',
      query: 'aggravating factors death penalty determination Texas capital punishment sentencing enhancement statutory factors'
    },
    {
      name: 'Simple query - single term',
      query: 'Texas'
    },
    {
      name: 'Simple query - death penalty',
      query: 'death penalty Texas'
    },
    {
      name: 'Boolean query - OR operator',
      query: 'aggravating OR mitigating factors death penalty Texas'
    },
    {
      name: 'Boolean query - AND operator', 
      query: 'aggravating AND factors AND death AND penalty AND Texas'
    },
    {
      name: 'Phrase search',
      query: '"death penalty" Texas "aggravating factors"'
    },
    {
      name: 'Field-specific search',
      query: 'court:texas death penalty aggravating'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}`);
    console.log(`Query: "${testCase.query}"`);
    console.log('-'.repeat(80));
    
    try {
      const startTime = Date.now();
      const result = await api.searchCases(testCase.query, { page_size: 5 });
      const endTime = Date.now();
      
      console.log(`✓ Success! Found ${result.count} total results (showing first ${result.results.length})`);
      console.log(`Response time: ${endTime - startTime}ms`);
      
      if (result.results.length > 0) {
        console.log('\nFirst result:');
        const firstCase = result.results[0];
        console.log(`  Case: ${firstCase.case_name}`);
        console.log(`  Citation: ${firstCase.citation.join(', ')}`);
        console.log(`  Court: ${firstCase.court}`);
        console.log(`  Date: ${firstCase.date_filed}`);
        console.log(`  Text preview: ${firstCase.text.substring(0, 200)}...`);
      } else {
        console.log('  (No results returned)');
      }
    } catch (error: any) {
      console.log(`✗ Error: ${error.message}`);
      if (error.response) {
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Status Text: ${error.response.statusText}`);
      }
    }
  }

  // Test the search endpoint directly
  console.log('\n\nTesting direct search endpoint...');
  console.log('='.repeat(80));
  
  try {
    const testQuery = 'death penalty Texas';
    const searchParams = new URLSearchParams({
      q: testQuery,
      type: 'o',
      page_size: '5',
      format: 'json'
    });
    
    const url = `https://www.courtlistener.com/api/rest/v4/search/?${searchParams}`;
    console.log(`Direct API URL: ${url}`);
    
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    if (process.env.COURTLISTENER_API_KEY) {
      headers['Authorization'] = `Token ${process.env.COURTLISTENER_API_KEY}`;
    }
    
    const response = await fetch(url, { headers });
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✓ Success! Found ${data.count} results`);
      if (data.results && data.results.length > 0) {
        console.log(`First result: ${data.results[0].caseName || data.results[0].caseNameFull || 'Unknown'}`);
      }
    } else {
      const errorText = await response.text();
      console.log(`✗ Error response: ${errorText}`);
    }
  } catch (error: any) {
    console.log(`✗ Fetch error: ${error.message}`);
  }

  // Test different API endpoints
  console.log('\n\nTesting different endpoints...');
  console.log('='.repeat(80));
  
  const endpoints = [
    { name: 'Opinions endpoint', path: '/opinions/', params: { plain_text__icontains: 'death penalty Texas' } },
    { name: 'Clusters endpoint', path: '/clusters/', params: { case_name__icontains: 'Texas' } },
  ];

  for (const endpoint of endpoints) {
    console.log(`\nTesting ${endpoint.name}`);
    try {
      const params = new URLSearchParams();
      Object.entries(endpoint.params).forEach(([key, value]) => {
        params.append(key, value as string);
      });
      params.append('page_size', '5');
      
      const url = `https://www.courtlistener.com/api/rest/v4${endpoint.path}?${params}`;
      console.log(`URL: ${url}`);
      
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      
      if (process.env.COURTLISTENER_API_KEY) {
        headers['Authorization'] = `Token ${process.env.COURTLISTENER_API_KEY}`;
      }
      
      const response = await fetch(url, { headers });
      console.log(`Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✓ Found ${data.count} results`);
      } else {
        const errorText = await response.text();
        console.log(`✗ Error: ${errorText}`);
      }
    } catch (error: any) {
      console.log(`✗ Error: ${error.message}`);
    }
  }
}

// Run the tests
testCourtListenerQueries().then(() => {
  console.log('\n\nTests completed!');
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});