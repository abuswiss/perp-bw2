#!/usr/bin/env ts-node

import { TimelineAgent } from '../src/lib/agents/TimelineAgent';
import { AgentInput } from '../src/lib/agents/types';

async function testTimelineAgent() {
  console.log('🧪 Testing Timeline Agent...\n');
  
  const agent = new TimelineAgent();
  
  // Test case 1: Landlord/Tenant Issue
  console.log('📝 Test Case 1: Landlord/Tenant Issue');
  console.log('Input: "My landlord won\'t fix the mold in my apartment and I got sick"');
  
  const input1: AgentInput = {
    matterId: null,
    query: "My landlord won't fix the mold in my apartment and I got sick",
    context: {
      test: true
    }
  };
  
  try {
    const result1 = await agent.execute(input1);
    
    if (result1.success) {
      console.log('✅ Timeline generated successfully!');
      console.log(`📊 Case Type: ${result1.result?.timeline?.classification?.primaryType}`);
      console.log(`⏱️  Complexity: ${result1.result?.timeline?.complexity?.level}`);
      console.log(`📋 Phases: ${result1.result?.timeline?.phases?.length}`);
      console.log(`💰 Cost Range: $${result1.result?.timeline?.totalCost?.min} - $${result1.result?.timeline?.totalCost?.max}`);
      console.log(`🎯 Primary Recommendation: ${result1.result?.timeline?.summary?.primaryRecommendation}`);
      
      // Show phases
      console.log('\n📅 Timeline Phases:');
      result1.result?.timeline?.phases?.forEach((phase: any, index: number) => {
        console.log(`${index + 1}. ${phase.name} (${phase.duration.typical} ${phase.duration.unit})`);
        console.log(`   Cost: $${phase.costRange.min} - $${phase.costRange.max}`);
      });
      
      // Show next steps
      console.log('\n🚀 Immediate Next Steps:');
      result1.result?.timeline?.nextSteps?.immediate?.forEach((action: any, index: number) => {
        console.log(`${index + 1}. ${action.title}: ${action.description}`);
      });
      
    } else {
      console.log('❌ Timeline generation failed:', result1.error);
    }
    
  } catch (error) {
    console.log('❌ Error:', error);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test case 2: Employment Issue
  console.log('📝 Test Case 2: Employment Issue');
  console.log('Input: "My employer fired me after I reported safety violations"');
  
  const input2: AgentInput = {
    matterId: null,
    query: "My employer fired me after I reported safety violations",
    context: {
      test: true
    }
  };
  
  try {
    const result2 = await agent.execute(input2);
    
    if (result2.success) {
      console.log('✅ Timeline generated successfully!');
      console.log(`📊 Case Type: ${result2.result?.timeline?.classification?.primaryType}`);
      console.log(`⏱️  Complexity: ${result2.result?.timeline?.complexity?.level}`);
      console.log(`📋 Phases: ${result2.result?.timeline?.phases?.length}`);
      console.log(`💰 Cost Range: $${result2.result?.timeline?.totalCost?.min} - $${result2.result?.timeline?.totalCost?.max}`);
      console.log(`🎯 Primary Recommendation: ${result2.result?.timeline?.summary?.primaryRecommendation}`);
    } else {
      console.log('❌ Timeline generation failed:', result2.error);
    }
    
  } catch (error) {
    console.log('❌ Error:', error);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test case 3: Contract Dispute
  console.log('📝 Test Case 3: Contract Dispute');
  console.log('Input: "A contractor took my $15,000 deposit and never showed up"');
  
  const input3: AgentInput = {
    matterId: null,
    query: "A contractor took my $15,000 deposit and never showed up",
    context: {
      test: true
    }
  };
  
  try {
    const result3 = await agent.execute(input3);
    
    if (result3.success) {
      console.log('✅ Timeline generated successfully!');
      console.log(`📊 Case Type: ${result3.result?.timeline?.classification?.primaryType}`);
      console.log(`⏱️  Complexity: ${result3.result?.timeline?.complexity?.level}`);
      console.log(`📋 Phases: ${result3.result?.timeline?.phases?.length}`);
      console.log(`💰 Cost Range: $${result3.result?.timeline?.totalCost?.min} - $${result3.result?.timeline?.totalCost?.max}`);
      console.log(`🎯 Primary Recommendation: ${result3.result?.timeline?.summary?.primaryRecommendation}`);
      
      // Show ADR options
      if (result3.result?.timeline?.alternativeDisputes?.length > 0) {
        console.log('\n⚖️ Alternative Dispute Resolution Options:');
        result3.result.timeline.alternativeDisputes.forEach((option: any, index: number) => {
          console.log(`${index + 1}. ${option.type.toUpperCase()}: ${option.description}`);
          console.log(`   Cost: ${option.estimatedCost}, Duration: ${option.estimatedDuration}`);
        });
      }
      
    } else {
      console.log('❌ Timeline generation failed:', result3.error);
    }
    
  } catch (error) {
    console.log('❌ Error:', error);
  }
  
  console.log('\n🎉 Timeline Agent testing completed!');
}

// Run the test
testTimelineAgent().catch(console.error);