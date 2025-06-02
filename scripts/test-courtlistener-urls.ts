import { CourtListenerAPI } from '../src/lib/integrations/courtlistener';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testCourtListenerURLs() {
  const courtListener = new CourtListenerAPI(process.env.COURTLISTENER_API_KEY);
  
  console.log('Testing CourtListener URL generation...\n');
  
  try {
    // Test 1: Search for a simple query
    console.log('Test 1: Searching for "death penalty"...');
    const searchResult = await courtListener.searchCases('death penalty', { page_size: 3 });
    
    console.log(`Found ${searchResult.count} total results`);
    console.log('\nFirst 3 results:');
    
    searchResult.results.slice(0, 3).forEach((caseItem, index) => {
      console.log(`\n${index + 1}. ${caseItem.case_name}`);
      console.log(`   ID: ${caseItem.id}`);
      console.log(`   absolute_url: ${caseItem.absolute_url}`);
      
      // Show how URLs should be constructed
      if (caseItem.absolute_url) {
        const correctUrl = `https://www.courtlistener.com${caseItem.absolute_url}`;
        console.log(`   ✅ Correct URL: ${correctUrl}`);
      } else {
        console.log(`   ❌ No absolute_url available - URL cannot be constructed`);
      }
      
      // Show the incorrect pattern we were using before
      const incorrectUrl = `https://www.courtlistener.com/opinion/${caseItem.id}/`;
      console.log(`   ❌ Incorrect URL (old pattern): ${incorrectUrl}`);
    });
    
    // Test 2: Get a specific opinion by ID to see its structure
    if (searchResult.results.length > 0) {
      const firstCase = searchResult.results[0];
      console.log('\n\nTest 2: Fetching full opinion details...');
      
      try {
        const opinion = await courtListener.getOpinionById(firstCase.id.toString());
        console.log('\nOpinion details:');
        console.log(`   ID: ${opinion.id}`);
        console.log(`   absolute_url: ${opinion.absolute_url}`);
        console.log(`   cluster_id: ${(opinion as any).cluster_id || 'Not available'}`);
        
        // Show the structure we need to understand
        console.log('\n   Note: CourtListener uses cluster IDs in URLs, not opinion IDs');
        console.log('   The absolute_url field is the canonical URL path');
      } catch (error: any) {
        console.log(`   Error fetching opinion: ${error.message}`);
      }
    }
    
    // Test 3: Check search API response structure
    console.log('\n\nTest 3: Analyzing search API response structure...');
    const response = await fetch(
      `https://www.courtlistener.com/api/rest/v4/search/?q=death+penalty&type=o&format=json&page_size=1`,
      {
        headers: {
          'Authorization': `Token ${process.env.COURTLISTENER_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      console.log('\nSearch API result structure:');
      console.log(`   cluster_id: ${result.cluster_id}`);
      console.log(`   absolute_url: ${result.absolute_url}`);
      console.log(`   opinions: ${JSON.stringify(result.opinions?.map((o: any) => ({ id: o.id })))}`);
      console.log('\n   ✅ Search results include absolute_url - this is what we should use!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testCourtListenerURLs();