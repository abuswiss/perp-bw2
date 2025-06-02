#!/usr/bin/env node

import { CourtListenerAPI } from '../src/lib/integrations/courtlistener';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function testFixedSearch() {
  const courtListener = new CourtListenerAPI();
  
  console.log('\n🔍 Testing fixed CourtListener search...\n');
  
  const query = 'aggravating factors death penalty determination Texas capital punishment sentencing enhancement statutory factors';
  
  console.log('Query:', query);
  console.log('\nTest 1: With fixed order_by parameter');
  
  try {
    const results = await courtListener.searchOpinions(query, {
      order_by: 'dateFiled desc',
      page_size: 10
    });
    
    console.log('Results count:', results.count);
    console.log('Actual results returned:', results.results.length);
    
    if (results.results.length > 0) {
      console.log('\nFirst 3 results:');
      results.results.slice(0, 3).forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.case_name}`);
        console.log(`   Court: ${result.court}`);
        console.log(`   Date: ${result.date_filed}`);
        console.log(`   Citation: ${result.citation?.join(', ') || 'N/A'}`);
      });
    }
    
    // Test 2: Texas-specific search
    console.log('\n\nTest 2: Texas court-specific search');
    const texResults = await courtListener.searchOpinions('death penalty aggravating factors', {
      court: 'tex',
      order_by: 'dateFiled desc',
      page_size: 5
    });
    
    console.log('Texas results count:', texResults.count);
    console.log('Actual Texas results returned:', texResults.results.length);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testFixedSearch().catch(console.error);