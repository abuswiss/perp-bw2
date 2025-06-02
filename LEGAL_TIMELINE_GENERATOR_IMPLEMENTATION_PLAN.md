# Legal Timeline Generator Implementation Plan

## Executive Summary

The Legal Timeline Generator will be a new focus mode in Perplexica that analyzes user's natural language descriptions of legal issues and generates comprehensive, interactive litigation timelines with cost estimates, risk assessments, and actionable next steps. It will integrate seamlessly with the existing agent architecture and leverage AI for intelligent case classification and timeline customization.

## Architecture Overview

### 1. Integration Points

The Timeline Generator will integrate into the existing Perplexica architecture at several key points:

1. **Focus Mode System**
   - Add `legalTimeline` as a new focus mode option
   - Integrate into FocusModeCards, Focus.tsx, and LegalFocus.tsx components
   - Route through LegalOrchestrator for processing

2. **Agent Architecture**
   - Create `TimelineAgent` extending `BaseAgent`
   - Implement NLP processing for case type classification
   - Generate dynamic timelines based on extracted information

3. **UI Components**
   - Interactive timeline visualization component
   - Cost estimation sliders
   - Settlement probability indicators
   - Actionable next steps dashboard

## Detailed Implementation Plan

### Phase 1: Core Agent Development

#### 1.1 TimelineAgent Implementation

```typescript
// src/lib/agents/TimelineAgent.ts
export class TimelineAgent extends BaseAgent {
  id = 'timeline-agent';
  type = 'analysis' as const;
  name = 'Legal Timeline Generator';
  description = 'Generates comprehensive litigation timelines from natural language descriptions';
  
  capabilities: AgentCapability[] = [
    {
      name: 'Case Type Classification',
      description: 'Identify legal issue type and complexity',
      inputTypes: ['natural_language', 'matter_context'],
      outputTypes: ['case_classification', 'complexity_assessment'],
      estimatedDuration: 15
    },
    {
      name: 'Timeline Generation',
      description: 'Create customized litigation timeline',
      inputTypes: ['case_type', 'jurisdiction', 'complexity'],
      outputTypes: ['timeline_phases', 'cost_estimates', 'duration_estimates'],
      estimatedDuration: 30
    },
    {
      name: 'Risk Assessment',
      description: 'Analyze risks and settlement probabilities',
      inputTypes: ['case_facts', 'case_type'],
      outputTypes: ['risk_factors', 'settlement_probability'],
      estimatedDuration: 20
    },
    {
      name: 'Next Steps Generation',
      description: 'Generate actionable immediate steps',
      inputTypes: ['case_type', 'urgency_factors'],
      outputTypes: ['immediate_actions', 'preparation_steps'],
      estimatedDuration: 15
    }
  ];
}
```

#### 1.2 NLP Processing Engine

```typescript
// src/lib/agents/timeline/NLPProcessor.ts
export class TimelineNLPProcessor {
  private llm: BaseChatModel;
  
  async classifyCaseType(input: string): Promise<CaseTypeClassification> {
    // Extract key information using LLM
    const extractionPrompt = PromptTemplate.fromTemplate(`
      Analyze this legal issue description and extract:
      1. Primary case type (personal injury, employment, contract, etc.)
      2. Key parties involved
      3. Jurisdiction indicators
      4. Damage types mentioned
      5. Special circumstances
      
      Description: {input}
      
      Return as JSON with these fields.
    `);
    
    // Process with LLM and return structured data
  }
  
  async assessComplexity(classification: CaseTypeClassification): Promise<ComplexityAssessment> {
    // Analyze complexity based on multiple factors
    // Return simple/moderate/complex with reasoning
  }
  
  async extractEntities(input: string): Promise<LegalEntities> {
    // Extract parties, dates, amounts, locations
    // Use both LLM and pattern matching
  }
}
```

#### 1.3 Timeline Generation Logic

```typescript
// src/lib/agents/timeline/TimelineGenerator.ts
export class TimelineGenerator {
  private jurisdictionRules: JurisdictionRules;
  
  async generateTimeline(
    caseType: string,
    jurisdiction: string,
    complexity: string
  ): Promise<LitigationTimeline> {
    const baseTimeline = this.getBaseTimeline(caseType);
    const customizedTimeline = this.applyJurisdictionRules(baseTimeline, jurisdiction);
    const adjustedTimeline = this.adjustForComplexity(customizedTimeline, complexity);
    
    return this.enrichWithDetails(adjustedTimeline);
  }
  
  private calculateCostEstimates(phase: TimelinePhase): CostRange {
    // Calculate based on phase type, complexity, jurisdiction
    // Include attorney fees, court costs, expert witnesses
  }
  
  private assessSettlementProbability(phase: string, caseType: string): number {
    // Return probability 0-1 based on statistical data
  }
}
```

### Phase 2: UI Components

#### 2.1 Timeline Visualization Component

```typescript
// src/components/timeline/LegalTimelineVisualization.tsx
export const LegalTimelineVisualization: React.FC<TimelineProps> = ({ timeline, onPhaseClick }) => {
  return (
    <div className="legal-timeline-container">
      <TimelineHeader summary={timeline.summary} />
      
      <InteractiveTimeline>
        {timeline.phases.map((phase, index) => (
          <TimelinePhase
            key={phase.id}
            phase={phase}
            isActive={phase.status === 'current'}
            onClick={() => onPhaseClick(phase)}
            settlementProbability={phase.settlementProbability}
          >
            <PhaseDetails>
              <Duration>{phase.duration}</Duration>
              <CostEstimate range={phase.costRange} />
              <KeyActions actions={phase.keyActions} />
            </PhaseDetails>
          </TimelinePhase>
        ))}
      </InteractiveTimeline>
      
      <TimelineControls>
        <CostSlider onAdjust={handleCostAdjustment} />
        <ComplexityToggle onChange={handleComplexityChange} />
      </TimelineControls>
    </div>
  );
};
```

#### 2.2 Executive Summary Component

```typescript
// src/components/timeline/TimelineSummary.tsx
export const TimelineSummary: React.FC<SummaryProps> = ({ analysis }) => {
  return (
    <Card className="timeline-summary">
      <CardHeader>
        <h3>Executive Summary</h3>
      </CardHeader>
      <CardContent>
        <SummaryGrid>
          <MetricCard
            label="Case Type"
            value={analysis.caseType}
            icon={<ScaleIcon />}
          />
          <MetricCard
            label="Estimated Duration"
            value={analysis.estimatedDuration}
            icon={<ClockIcon />}
          />
          <MetricCard
            label="Total Cost Range"
            value={analysis.costRange}
            icon={<DollarIcon />}
          />
          <MetricCard
            label="Strength Assessment"
            value={analysis.strengthAssessment}
            confidence={analysis.confidence}
            icon={<ChartIcon />}
          />
        </SummaryGrid>
        
        <RecommendationBox>
          <h4>Recommendation</h4>
          <p>{analysis.primaryRecommendation}</p>
        </RecommendationBox>
      </CardContent>
    </Card>
  );
};
```

#### 2.3 Next Steps Dashboard

```typescript
// src/components/timeline/NextStepsPanel.tsx
export const NextStepsPanel: React.FC<NextStepsProps> = ({ steps, onActionComplete }) => {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  
  return (
    <div className="next-steps-panel">
      <TabGroup>
        <Tab label="Immediate" badge={steps.immediate.length}>
          <ActionList>
            {steps.immediate.map(action => (
              <ActionItem
                key={action.id}
                action={action}
                isCompleted={completedSteps.has(action.id)}
                onComplete={() => handleActionComplete(action.id)}
              />
            ))}
          </ActionList>
        </Tab>
        
        <Tab label="This Month" badge={steps.shortTerm.length}>
          <ActionList actions={steps.shortTerm} />
        </Tab>
        
        <Tab label="Preparation" badge={steps.preparation.length}>
          <ActionList actions={steps.preparation} />
        </Tab>
      </TabGroup>
    </div>
  );
};
```

### Phase 3: AI Integration

#### 3.1 LLM-Powered Analysis

```typescript
// src/lib/agents/timeline/AIAnalyzer.ts
export class TimelineAIAnalyzer {
  private llm: BaseChatModel;
  
  async analyzeNaturalLanguageInput(input: string): Promise<TimelineAnalysis> {
    // Multi-step analysis pipeline
    const classification = await this.classifyCaseType(input);
    const entities = await this.extractEntities(input);
    const complexity = await this.assessComplexity(input, classification);
    const urgency = await this.assessUrgency(input, entities);
    
    return {
      classification,
      entities,
      complexity,
      urgency,
      customFactors: await this.identifyCustomFactors(input)
    };
  }
  
  async generateCustomRecommendations(
    analysis: TimelineAnalysis,
    timeline: LitigationTimeline
  ): Promise<Recommendations> {
    const prompt = PromptTemplate.fromTemplate(`
      Based on this case analysis and timeline, provide:
      1. Primary recommendation (settle vs litigate)
      2. Key risk factors to monitor
      3. Critical deadlines and statutes of limitations
      4. Cost-saving opportunities
      5. Alternative dispute resolution options
      
      Case Analysis: {analysis}
      Timeline: {timeline}
    `);
    
    return await this.processWithStructuredOutput(prompt, { analysis, timeline });
  }
}
```

#### 3.2 Smart Customization Engine

```typescript
// src/lib/agents/timeline/CustomizationEngine.ts
export class TimelineCustomizationEngine {
  async customizeForJurisdiction(
    baseTimeline: Timeline,
    jurisdiction: string
  ): Promise<Timeline> {
    const rules = await this.getJurisdictionRules(jurisdiction);
    
    return {
      ...baseTimeline,
      phases: baseTimeline.phases.map(phase => 
        this.applyJurisdictionSpecificRules(phase, rules)
      ),
      specialRequirements: rules.specialRequirements,
      localDeadlines: rules.deadlines
    };
  }
  
  async detectRiskFactors(caseDetails: CaseDetails): Promise<RiskFactors> {
    // AI-powered risk detection
    const defendantAnalysis = await this.analyzeDefendantProfile(caseDetails.defendant);
    const historicalOutcomes = await this.getHistoricalOutcomes(caseDetails.caseType);
    
    return {
      highRisk: this.identifyHighRiskFactors(caseDetails, defendantAnalysis),
      timeSensitive: this.identifyTimeSensitiveFactors(caseDetails),
      costWarnings: this.identifyCostRisks(caseDetails, historicalOutcomes)
    };
  }
}
```

### Phase 4: Data Models and Schema

#### 4.1 TypeScript Interfaces

```typescript
// src/lib/agents/timeline/types.ts
export interface TimelinePhase {
  id: string;
  name: string;
  description: string;
  duration: {
    min: number;
    max: number;
    unit: 'days' | 'weeks' | 'months';
  };
  costRange: {
    min: number;
    max: number;
    breakdown: CostBreakdown;
  };
  keyActions: Action[];
  prerequisites: string[];
  deliverables: string[];
  settlementProbability: number;
  risks: Risk[];
}

export interface CaseTypeClassification {
  primaryType: CaseType;
  subType?: string;
  confidence: number;
  relatedTypes: CaseType[];
  specialCircumstances: string[];
}

export interface LitigationTimeline {
  id: string;
  summary: ExecutiveSummary;
  phases: TimelinePhase[];
  totalDuration: DurationEstimate;
  totalCost: CostEstimate;
  alternativeDisputes: ADROption[];
  criticalDeadlines: Deadline[];
  nextSteps: NextSteps;
}
```

#### 4.2 Database Schema Updates

```sql
-- Add to Supabase schema
CREATE TABLE timeline_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_type VARCHAR(100) NOT NULL,
  jurisdiction VARCHAR(100),
  phases JSONB NOT NULL,
  average_duration INTEGER, -- in days
  average_cost DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE timeline_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES matters(id),
  input_description TEXT NOT NULL,
  case_classification JSONB NOT NULL,
  generated_timeline JSONB NOT NULL,
  recommendations JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_timeline_templates_case_type ON timeline_templates(case_type);
CREATE INDEX idx_timeline_analyses_matter_id ON timeline_analyses(matter_id);
```

### Phase 5: Integration with Existing Systems

#### 5.1 Focus Mode Integration

```typescript
// Update src/components/FocusModeCards.tsx
const legalModes: Mode[] = [
  // ... existing modes
  {
    id: 'legalTimeline',
    name: 'Timeline Generator',
    description: 'Generate litigation timelines from case descriptions',
    icon: <TimelineIcon className="h-6 w-6" />,
    badge: 'NEW'
  }
];

// Update src/lib/orchestrator/LegalOrchestrator.ts
private initializeAgents(): void {
  // ... existing agents
  this.agents.set('legalTimeline', new TimelineAgent());
}
```

#### 5.2 Chat Route Handler

```typescript
// Update src/app/api/chat/route.ts
const legalModes = [
  'legalResearch', 
  'briefWriting', 
  'discovery', 
  'contractAnalysis',
  'legalTimeline' // Add new mode
];

// Add formatting for timeline responses
if (agentResult.metadata?.agentType === 'timeline-agent') {
  formattedResponse = formatTimelineResponse(agentResult);
}
```

#### 5.3 Matter Context Integration

```typescript
// Enhance TimelineAgent to use matter context
async execute(input: AgentInput): Promise<AgentOutput> {
  // Load matter documents for better context
  const matterContext = await this.loadMatterContext(input.matterId);
  
  // Use existing case documents to enhance timeline accuracy
  const enhancedAnalysis = await this.enhanceWithMatterDocuments(
    input.query,
    matterContext
  );
  
  // Generate timeline with full context
  return this.generateContextualTimeline(enhancedAnalysis);
}
```

## Implementation Timeline

### Week 1-2: Core Agent Development
- Implement TimelineAgent base structure
- Create NLP processing pipeline
- Set up case type classification system
- Implement basic timeline generation

### Week 3-4: AI Integration
- Integrate LLM for natural language processing
- Implement entity extraction
- Create complexity assessment algorithms
- Build recommendation engine

### Week 5-6: UI Components
- Build timeline visualization component
- Create executive summary display
- Implement next steps dashboard
- Add interactive controls

### Week 7-8: Testing and Polish
- Comprehensive testing with various case types
- Performance optimization
- UI/UX refinements
- Documentation

## Performance Considerations

1. **Caching Strategy**
   - Cache timeline templates by case type/jurisdiction
   - Store analyzed patterns for faster processing
   - Use matter-specific caching for repeat queries

2. **Streaming Responses**
   - Stream timeline phases as they're generated
   - Progressive enhancement of timeline details
   - Immediate display of executive summary

3. **Optimization**
   - Parallel processing of timeline phases
   - Efficient LLM prompt batching
   - Lazy loading of detailed phase information

## Security and Privacy

1. **Data Protection**
   - Ensure all case descriptions are encrypted
   - Implement access controls for timeline data
   - Audit trail for all timeline generations

2. **Compliance**
   - Attorney-client privilege protection
   - Configurable data retention policies
   - Export capabilities for client records

## Success Metrics

1. **Accuracy Metrics**
   - Case type classification accuracy: >90%
   - Timeline duration estimates within 20% of actual
   - Cost estimates within 30% range accuracy

2. **Usage Metrics**
   - Average time to generate timeline: <30 seconds
   - User engagement with timeline phases
   - Conversion to matter creation

3. **Quality Metrics**
   - User satisfaction ratings
   - Professional attorney validation
   - Actionable next steps completion rate

## Future Enhancements

1. **Machine Learning Improvements**
   - Learn from actual case outcomes
   - Refine cost estimates based on historical data
   - Improve settlement probability predictions

2. **Integration Extensions**
   - Direct court filing system integration
   - Calendar integration for deadlines
   - Client portal for timeline sharing

3. **Advanced Features**
   - Multi-party litigation timelines
   - International jurisdiction support
   - Collaborative timeline editing

This implementation plan provides a robust foundation for the Legal Timeline Generator that leverages Perplexica's existing architecture while introducing powerful new capabilities for legal professionals.