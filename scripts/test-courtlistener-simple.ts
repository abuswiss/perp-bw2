#!/usr/bin/env node

import { CourtListenerAPI } from '../src/lib/integrations/courtlistener';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function testSimple() {
  const courtListener = new CourtListenerAPI();
  
  console.log('\n✅ Testing CourtListener with the FIXED order_by parameter...\n');
  
  const query = 'What are the aggravating factors for a death penalty determination under Texas law?';
  const optimizedQuery = 'aggravating factors death penalty determination Texas capital punishment sentencing enhancement statutory factors';
  
  console.log('Original query:', query);
  console.log('Optimized query:', optimizedQuery);
  console.log('\n---\n');
  
  // Test 1: With the old broken order_by
  console.log('❌ Test 1: With OLD broken order_by parameter');
  try {
    const brokenResults = await courtListener.searchOpinions(optimizedQuery, {
      order_by: '-cluster__date_filed,id', // This causes 400 error
      page_size: 10
    });
    console.log('Results:', brokenResults.count);
  } catch (error: any) {
    console.log('Error (expected):', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: With the fixed order_by
  console.log('✅ Test 2: With FIXED order_by parameter');
  try {
    const fixedResults = await courtListener.searchOpinions(optimizedQuery, {
      order_by: 'dateFiled desc',
      page_size: 10
    });
    console.log('Results count:', fixedResults.count);
    console.log('Actual results:', fixedResults.results.length);
    
    if (fixedResults.results.length > 0) {
      console.log('\nFirst case:');
      const firstCase = fixedResults.results[0];
      console.log('- Title:', firstCase.case_name);
      console.log('- Court:', firstCase.court);
      console.log('- Date:', firstCase.date_filed);
    }
  } catch (error: any) {
    console.log('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 3: Texas-specific search
  console.log('🏛️ Test 3: Texas court-specific search');
  try {
    const texasResults = await courtListener.searchOpinions('death penalty aggravating factors', {
      court: 'tex',
      order_by: 'dateFiled desc',
      page_size: 5
    });
    console.log('Texas Supreme Court results:', texasResults.count);
    console.log('Actual results:', texasResults.results.length);
  } catch (error: any) {
    console.log('Error:', error.message);
  }
}

testSimple().catch(console.error);