#!/usr/bin/env node

import { ResearchAgent } from '../src/lib/agents/ResearchAgent';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function testResearchAgent() {
  const agent = new ResearchAgent();
  
  console.log('\n🔍 Testing ResearchAgent with death penalty query...\n');
  
  const input = {
    query: 'What are the aggravating factors for a death penalty determination under Texas law?',
    parameters: {},
    matterId: null
  };
  
  try {
    const result = await agent.execute(input);
    
    console.log('\nExecution Result:');
    console.log('Success:', result.success);
    console.log('Execution Time:', result.executionTime, 'ms');
    
    if (result.success && result.result) {
      console.log('\nSources found:', result.result.sources?.length || 0);
      console.log('Citations:', result.citations?.length || 0);
      
      if (result.result.sources && result.result.sources.length > 0) {
        console.log('\nFirst 3 sources:');
        result.result.sources.slice(0, 3).forEach((source, index) => {
          console.log(`\n${index + 1}. ${source.metadata.title}`);
          console.log(`   Type: ${source.metadata.type}`);
          console.log(`   Court: ${source.metadata.court || 'N/A'}`);
          console.log(`   Date: ${source.metadata.date || 'N/A'}`);
          console.log(`   Relevance: ${source.metadata.relevance}`);
        });
      }
      
      console.log('\nResponse preview:');
      console.log(result.result.response?.substring(0, 500) + '...');
    } else {
      console.log('\nError:', result.error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testResearchAgent().catch(console.error);