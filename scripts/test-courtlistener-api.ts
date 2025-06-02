#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const API_KEY = process.env.COURTLISTENER_API_KEY || 'cc4a34d0ce5e2e173dc4ca56972ed1b6c252b3b1';
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4';

interface TestResult {
  endpoint: string;
  query: string;
  params: Record<string, string>;
  success: boolean;
  resultCount: number;
  error?: string;
  rawResponse?: any;
  sampleResult?: any;
}

const testResults: TestResult[] = [];

async function makeRequest(endpoint: string, params: Record<string, string> = {}, includeAuth: boolean = true) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  if (includeAuth && API_KEY) {
    headers['Authorization'] = `Token ${API_KEY}`;
  }

  console.log(`\n🔍 Testing: ${url.toString()}`);
  console.log(`   Auth: ${includeAuth ? 'Yes' : 'No'}`);
  
  try {
    const response = await fetch(url.toString(), { headers });
    const responseText = await response.text();
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.log(`   ❌ Error Response:`, responseText.substring(0, 500));
      return {
        success: false,
        status: response.status,
        error: responseText,
        data: null
      };
    }

    try {
      const data = JSON.parse(responseText);
      console.log(`   ✅ Success! Count: ${data.count || 'N/A'}`);
      
      if (data.results && data.results.length > 0) {
        console.log(`   Sample result keys:`, Object.keys(data.results[0]));
      }
      
      return {
        success: true,
        status: response.status,
        data,
        error: null
      };
    } catch (parseError) {
      console.log(`   ⚠️  Parse error:`, parseError);
      return {
        success: false,
        status: response.status,
        error: `Parse error: ${parseError}`,
        data: null
      };
    }
  } catch (error) {
    console.log(`   ❌ Request failed:`, error);
    return {
      success: false,
      status: 0,
      error: `Network error: ${error}`,
      data: null
    };
  }
}

async function testEndpoint(
  name: string,
  endpoint: string,
  query: string,
  params: Record<string, string> = {},
  includeAuth: boolean = true
) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${name}`);
  console.log(`Query: "${query}"`);
  console.log(`${'='.repeat(80)}`);

  const result = await makeRequest(endpoint, params, includeAuth);
  
  const testResult: TestResult = {
    endpoint,
    query,
    params,
    success: result.success,
    resultCount: result.data?.count || 0,
    error: result.error || undefined,
    rawResponse: result.data,
    sampleResult: result.data?.results?.[0]
  };

  testResults.push(testResult);

  if (result.success && result.data?.results?.length > 0) {
    console.log(`\n📄 First result preview:`);
    const firstResult = result.data.results[0];
    console.log(`   - ID: ${firstResult.id}`);
    console.log(`   - Case Name: ${firstResult.caseName || firstResult.case_name || 'N/A'}`);
    console.log(`   - Court: ${firstResult.court || firstResult.court_citation_string || 'N/A'}`);
    console.log(`   - Date: ${firstResult.dateFiled || firstResult.date_filed || 'N/A'}`);
    
    if (firstResult.snippet) {
      console.log(`   - Snippet: "${firstResult.snippet.substring(0, 100)}..."`);
    }
  }

  // Small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function runAllTests() {
  console.log(`\n🚀 Starting CourtListener API Tests`);
  console.log(`API Key: ${API_KEY ? `${API_KEY.substring(0, 10)}...` : 'Not configured'}`);
  console.log(`Base URL: ${BASE_URL}`);

  // Test 1: Simple search using /search/ endpoint
  await testEndpoint(
    'Search API - Simple Query',
    '/search/',
    'death penalty',
    {
      q: 'death penalty',
      type: 'o',
      format: 'json'
    }
  );

  // Test 2: Search with Texas filter
  await testEndpoint(
    'Search API - Texas Specific',
    '/search/',
    'death penalty Texas',
    {
      q: 'death penalty Texas',
      type: 'o',
      format: 'json'
    }
  );

  // Test 3: Complex query
  await testEndpoint(
    'Search API - Complex Query',
    '/search/',
    'aggravating factors death penalty',
    {
      q: 'aggravating factors death penalty determination Texas capital punishment sentencing guidelines statutory aggravators',
      type: 'o',
      format: 'json',
      page_size: '10'
    }
  );

  // Test 4: Direct opinions endpoint
  await testEndpoint(
    'Opinions API - Direct Search',
    '/opinions/',
    'death penalty',
    {
      plain_text__icontains: 'death penalty',
      page_size: '10'
    }
  );

  // Test 5: Clusters endpoint
  await testEndpoint(
    'Clusters API - Case Name Search',
    '/clusters/',
    'death penalty',
    {
      case_name__icontains: 'death penalty',
      page_size: '10'
    }
  );

  // Test 6: Test without API key
  await testEndpoint(
    'Search API - No Auth',
    '/search/',
    'death penalty',
    {
      q: 'death penalty',
      type: 'o',
      format: 'json'
    },
    false
  );

  // Test 7: Search with specific court
  await testEndpoint(
    'Search API - Texas Courts',
    '/search/',
    'death penalty',
    {
      q: 'death penalty',
      type: 'o',
      court: 'tex',
      format: 'json'
    }
  );

  // Test 8: Search with date range
  const lastYear = new Date();
  lastYear.setFullYear(lastYear.getFullYear() - 1);
  
  await testEndpoint(
    'Search API - Recent Cases',
    '/search/',
    'death penalty',
    {
      q: 'death penalty',
      type: 'o',
      filed_after: lastYear.toISOString().split('T')[0],
      format: 'json',
      order_by: 'dateFiled desc'
    }
  );

  // Test 9: Search published opinions only
  await testEndpoint(
    'Search API - Published Only',
    '/search/',
    'death penalty',
    {
      q: 'death penalty',
      type: 'o',
      status: 'Published',
      format: 'json'
    }
  );

  // Test 10: List available courts
  await testEndpoint(
    'Courts API - List Courts',
    '/courts/',
    'N/A',
    {
      page_size: '10'
    }
  );

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TEST SUMMARY`);
  console.log(`${'='.repeat(80)}`);

  const successCount = testResults.filter(r => r.success).length;
  const totalCount = testResults.length;
  
  console.log(`\nTotal Tests: ${totalCount}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${totalCount - successCount}`);
  
  console.log(`\nResults by Endpoint:`);
  testResults.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`\n${index + 1}. ${status} ${result.endpoint}`);
    console.log(`   Query: "${result.query}"`);
    console.log(`   Result Count: ${result.resultCount}`);
    if (!result.success) {
      console.log(`   Error: ${result.error?.substring(0, 100)}...`);
    }
  });

  // Save detailed results
  const fs = await import('fs/promises');
  const resultsPath = resolve(__dirname, 'courtlistener-test-results.json');
  await fs.writeFile(resultsPath, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 Detailed results saved to: ${resultsPath}`);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});