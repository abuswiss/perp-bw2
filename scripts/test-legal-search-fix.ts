import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Mock the legal search agent behavior
async function testLegalSearchQueries() {
  console.log('Testing Legal Search Query Generation and Cleanup...\n');
  
  // Simulate what the LLM might generate
  const llmGeneratedQueries = [
    '"aggravating factors death penalty determination Texas capital punishment sentencing enhancement statutory factors"',
    'death penalty Texas aggravating factors',
    '"capital punishment" Texas "aggravating circumstances"',
    'Texas Penal Code 37.071 future dangerousness',
    '"mitigating factors" vs "aggravating factors" death penalty'
  ];
  
  console.log('LLM Generated Queries:');
  llmGeneratedQueries.forEach((q, i) => console.log(`${i + 1}. ${q}`));
  
  console.log('\nCleaning queries...\n');
  
  // Apply the same cleaning logic we added to legalSearchAgent.ts
  const cleanedQueries = llmGeneratedQueries.map(query => {
    let cleanQuery = query.trim();
    if (cleanQuery.startsWith('"') && cleanQuery.endsWith('"') && cleanQuery.length > 2) {
      const innerQuery = cleanQuery.slice(1, -1);
      if (!innerQuery.includes('"')) {
        cleanQuery = innerQuery;
      }
    }
    return cleanQuery;
  });
  
  console.log('Cleaned Queries:');
  cleanedQueries.forEach((q, i) => console.log(`${i + 1}. ${q}`));
  
  // Test with CourtListener API
  const { CourtListenerAPI } = await import('../src/lib/integrations/courtlistener');
  const api = new CourtListenerAPI();
  
  console.log('\n' + '='.repeat(80) + '\n');
  console.log('Testing cleaned queries with CourtListener API:\n');
  
  for (let i = 0; i < cleanedQueries.length; i++) {
    const originalQuery = llmGeneratedQueries[i];
    const cleanedQuery = cleanedQueries[i];
    
    console.log(`\nQuery ${i + 1}:`);
    console.log(`Original: ${originalQuery}`);
    console.log(`Cleaned:  ${cleanedQuery}`);
    console.log('-'.repeat(60));
    
    try {
      const result = await api.searchCases(cleanedQuery, { page_size: 3 });
      console.log(`✓ Success! Found ${result.count} total results`);
      
      if (result.results.length > 0) {
        console.log('\nTop results:');
        result.results.forEach((caseData, idx) => {
          console.log(`  ${idx + 1}. ${caseData.case_name} (${caseData.court}, ${new Date(caseData.date_filed).getFullYear()})`);
        });
      }
    } catch (error: any) {
      console.log(`✗ Error: ${error.message}`);
    }
  }
  
  // Test the prompt improvement
  console.log('\n\n' + '='.repeat(80) + '\n');
  console.log('Updated Legal Query Prompt Guidelines:\n');
  console.log(`IMPORTANT: 
- DO NOT wrap the entire query in quotes
- You may use quotes for specific phrases like "death penalty" or "aggravating factors"
- Keep queries focused and relevant
- Avoid overly long queries (max 10-12 keywords)`);
  
  console.log('\nExample good queries for "What are the aggravating factors for a death penalty determination under Texas law?":');
  const goodQueries = [
    'death penalty aggravating factors Texas',
    '"aggravating factors" death penalty Texas law',
    'Texas Penal Code 37.071 capital punishment',
    'future dangerousness Texas death penalty',
    '"special issues" capital sentencing Texas'
  ];
  
  goodQueries.forEach((q, i) => console.log(`${i + 1}. ${q}`));
}

// Run the test
testLegalSearchQueries().then(() => {
  console.log('\n\nTest completed successfully!');
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});