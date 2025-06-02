import { 
  TimelinePhase, 
  LitigationTimeline, 
  CaseType,
  ComplexityAssessment,
  CaseTypeClassification,
  ADROption,
  Deadline,
  NextSteps,
  Action,
  Risk
} from './types';
import { v4 as uuidv4 } from 'uuid';

export class TimelineGenerator {
  private baseTimelines: Map<CaseType, TimelinePhase[]> = new Map();

  constructor() {
    this.initializeBaseTimelines();
  }

  async generateTimeline(
    caseType: CaseType,
    jurisdiction: string | undefined,
    complexity: ComplexityAssessment,
    classification: CaseTypeClassification
  ): Promise<LitigationTimeline> {
    // Get base timeline for case type
    const basePhases = this.getBaseTimeline(caseType);
    
    // Apply complexity adjustments
    const adjustedPhases = this.adjustForComplexity(basePhases, complexity);
    
    // Apply jurisdiction-specific rules
    const customizedPhases = await this.applyJurisdictionRules(adjustedPhases, jurisdiction);
    
    // Calculate totals
    const totalDuration = this.calculateTotalDuration(customizedPhases);
    const totalCost = this.calculateTotalCost(customizedPhases);
    
    // Generate ADR options
    const adrOptions = this.generateADROptions(caseType, complexity);
    
    // Generate critical deadlines
    const criticalDeadlines = this.generateCriticalDeadlines(caseType, jurisdiction);
    
    // Generate next steps
    const nextSteps = this.generateNextSteps(caseType, classification);
    
    // Generate risk factors
    const riskFactors = this.generateRiskFactors(complexity, classification);
    
    // Create executive summary
    const summary = this.createExecutiveSummary(
      caseType,
      totalDuration,
      totalCost,
      complexity,
      classification
    );

    return {
      id: uuidv4(),
      summary,
      classification,
      complexity,
      phases: customizedPhases,
      totalDuration,
      totalCost,
      alternativeDisputes: adrOptions,
      criticalDeadlines,
      nextSteps,
      riskFactors,
      metadata: {
        generatedAt: new Date(),
        jurisdiction: jurisdiction || 'general',
        lastUpdated: new Date()
      }
    };
  }

  private initializeBaseTimelines() {
    // Personal Injury Timeline
    this.baseTimelines.set('personal_injury', [
      {
        id: uuidv4(),
        name: 'Initial Consultation & Case Evaluation',
        description: 'Meet with attorney, evaluate case merits, gather initial documentation',
        order: 1,
        duration: { min: 1, max: 2, typical: 1, unit: 'weeks' },
        costRange: {
          min: 0,
          max: 500,
          breakdown: {
            attorneyFees: { min: 0, max: 500 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [
          {
            id: uuidv4(),
            title: 'Gather medical records',
            description: 'Collect all medical documentation related to injury',
            priority: 'immediate',
            category: 'documentation'
          },
          {
            id: uuidv4(),
            title: 'Document damages',
            description: 'Create detailed record of all losses and expenses',
            priority: 'immediate',
            category: 'documentation'
          }
        ],
        prerequisites: [],
        deliverables: ['Retainer agreement', 'Initial case assessment'],
        settlementProbability: 0.1,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Investigation & Demand Letter',
        description: 'Investigate liability, gather evidence, send demand letter',
        order: 2,
        duration: { min: 4, max: 8, typical: 6, unit: 'weeks' },
        costRange: {
          min: 1000,
          max: 3000,
          breakdown: {
            attorneyFees: { min: 800, max: 2500 },
            courtCosts: { min: 200, max: 500 }
          }
        },
        keyActions: [
          {
            id: uuidv4(),
            title: 'Investigate accident scene',
            description: 'Document conditions, take photos, interview witnesses',
            priority: 'immediate',
            category: 'legal'
          }
        ],
        prerequisites: ['Initial consultation completed'],
        deliverables: ['Demand letter', 'Evidence package'],
        settlementProbability: 0.3,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Filing Lawsuit',
        description: 'Prepare and file complaint if settlement not reached',
        order: 3,
        duration: { min: 2, max: 4, typical: 3, unit: 'weeks' },
        costRange: {
          min: 800,
          max: 2000,
          breakdown: {
            attorneyFees: { min: 500, max: 1500 },
            courtCosts: { min: 300, max: 500 }
          }
        },
        keyActions: [],
        prerequisites: ['Demand letter sent', 'No settlement reached'],
        deliverables: ['Filed complaint', 'Summons issued'],
        settlementProbability: 0.4,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Discovery Phase',
        description: 'Exchange information, depositions, expert witnesses',
        order: 4,
        duration: { min: 6, max: 12, typical: 9, unit: 'months' },
        costRange: {
          min: 5000,
          max: 25000,
          breakdown: {
            attorneyFees: { min: 3000, max: 15000 },
            courtCosts: { min: 1000, max: 5000 },
            expertWitnesses: { min: 1000, max: 5000 }
          }
        },
        keyActions: [],
        prerequisites: ['Lawsuit filed', 'Defendant served'],
        deliverables: ['Deposition transcripts', 'Expert reports'],
        settlementProbability: 0.6,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Mediation/Settlement Conference',
        description: 'Court-ordered or voluntary mediation to resolve case',
        order: 5,
        duration: { min: 1, max: 2, typical: 1, unit: 'weeks' },
        costRange: {
          min: 1500,
          max: 3000,
          breakdown: {
            attorneyFees: { min: 1000, max: 2000 },
            courtCosts: { min: 500, max: 1000 }
          }
        },
        keyActions: [],
        prerequisites: ['Discovery substantially complete'],
        deliverables: ['Mediation brief', 'Settlement agreement (if successful)'],
        settlementProbability: 0.75,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Trial Preparation & Trial',
        description: 'Prepare for and conduct jury or bench trial',
        order: 6,
        duration: { min: 2, max: 4, typical: 3, unit: 'months' },
        costRange: {
          min: 10000,
          max: 50000,
          breakdown: {
            attorneyFees: { min: 8000, max: 40000 },
            courtCosts: { min: 2000, max: 10000 }
          }
        },
        keyActions: [],
        prerequisites: ['Mediation unsuccessful', 'Trial date set'],
        deliverables: ['Trial briefs', 'Verdict'],
        settlementProbability: 0.85,
        risks: [
          {
            id: uuidv4(),
            type: 'high',
            description: 'Unpredictable jury verdict',
            impact: 'Could result in no recovery or less than settlement offers',
            mitigation: 'Thoroughly prepare witnesses and evidence presentation'
          }
        ]
      }
    ]);

    // Employment Law Timeline
    this.baseTimelines.set('employment', [
      {
        id: uuidv4(),
        name: 'Initial Consultation & Documentation',
        description: 'Review employment documents, assess claims',
        order: 1,
        duration: { min: 1, max: 2, typical: 1, unit: 'weeks' },
        costRange: {
          min: 0,
          max: 750,
          breakdown: {
            attorneyFees: { min: 0, max: 750 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [
          {
            id: uuidv4(),
            title: 'Gather employment records',
            description: 'Collect pay stubs, employment contract, performance reviews',
            priority: 'immediate',
            category: 'documentation'
          },
          {
            id: uuidv4(),
            title: 'Document incidents',
            description: 'Create timeline of discriminatory or retaliatory acts',
            priority: 'immediate',
            category: 'documentation'
          }
        ],
        prerequisites: [],
        deliverables: ['Case evaluation memo'],
        settlementProbability: 0.05,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Administrative Filing (EEOC/State Agency)',
        description: 'File charge with appropriate agency',
        order: 2,
        duration: { min: 2, max: 4, typical: 3, unit: 'weeks' },
        costRange: {
          min: 500,
          max: 2000,
          breakdown: {
            attorneyFees: { min: 500, max: 2000 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [
          {
            id: uuidv4(),
            title: 'File EEOC charge',
            description: 'Submit charge within 180-300 days of last incident',
            priority: 'immediate',
            category: 'legal'
          }
        ],
        prerequisites: ['Initial documentation complete'],
        deliverables: ['EEOC charge', 'Intake questionnaire'],
        settlementProbability: 0.15,
        risks: [],
        criticalDeadlines: [
          {
            id: uuidv4(),
            description: 'EEOC filing deadline',
            daysFromNow: 180,
            type: 'filing',
            isCritical: true
          }
        ]
      },
      {
        id: uuidv4(),
        name: 'Agency Investigation',
        description: 'Cooperate with EEOC/state agency investigation',
        order: 3,
        duration: { min: 6, max: 18, typical: 12, unit: 'months' },
        costRange: {
          min: 2000,
          max: 5000,
          breakdown: {
            attorneyFees: { min: 2000, max: 5000 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [],
        prerequisites: ['EEOC charge filed'],
        deliverables: ['Position statement', 'Right to sue letter'],
        settlementProbability: 0.35,
        risks: []
      }
    ]);

    // Landlord/Tenant Timeline
    this.baseTimelines.set('landlord_tenant', [
      {
        id: uuidv4(),
        name: 'Document Issues & Notice',
        description: 'Document problems and provide notice to landlord',
        order: 1,
        duration: { min: 1, max: 2, typical: 1, unit: 'weeks' },
        costRange: {
          min: 0,
          max: 300,
          breakdown: {
            attorneyFees: { min: 0, max: 300 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [
          {
            id: uuidv4(),
            title: 'Photograph all issues',
            description: 'Take detailed photos/videos of all problems',
            priority: 'immediate',
            category: 'documentation'
          },
          {
            id: uuidv4(),
            title: 'Send written notice',
            description: 'Notify landlord in writing of all issues',
            priority: 'immediate',
            category: 'communication'
          }
        ],
        prerequisites: [],
        deliverables: ['Written notice to landlord', 'Photo documentation'],
        settlementProbability: 0.3,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Demand Letter & Negotiation',
        description: 'Formal demand for repairs or compensation',
        order: 2,
        duration: { min: 2, max: 4, typical: 3, unit: 'weeks' },
        costRange: {
          min: 300,
          max: 1000,
          breakdown: {
            attorneyFees: { min: 300, max: 1000 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [],
        prerequisites: ['Initial notice sent', 'No adequate response'],
        deliverables: ['Demand letter'],
        settlementProbability: 0.5,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Small Claims or District Court Filing',
        description: 'File lawsuit for damages or injunctive relief',
        order: 3,
        duration: { min: 2, max: 3, typical: 2, unit: 'weeks' },
        costRange: {
          min: 200,
          max: 1500,
          breakdown: {
            attorneyFees: { min: 0, max: 1000 },
            courtCosts: { min: 200, max: 500 }
          }
        },
        keyActions: [],
        prerequisites: ['Demand letter sent', 'No resolution'],
        deliverables: ['Filed complaint'],
        settlementProbability: 0.65,
        risks: []
      }
    ]);

    // Contract Dispute Timeline
    this.baseTimelines.set('contract_dispute', [
      {
        id: uuidv4(),
        name: 'Contract Review & Analysis',
        description: 'Analyze contract terms and breach',
        order: 1,
        duration: { min: 1, max: 2, typical: 1, unit: 'weeks' },
        costRange: {
          min: 500,
          max: 2000,
          breakdown: {
            attorneyFees: { min: 500, max: 2000 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [
          {
            id: uuidv4(),
            title: 'Gather all contract documents',
            description: 'Collect original contract and all amendments',
            priority: 'immediate',
            category: 'documentation'
          }
        ],
        prerequisites: [],
        deliverables: ['Legal analysis memo'],
        settlementProbability: 0.15,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Breach Notice & Cure Period',
        description: 'Formal notice of breach with opportunity to cure',
        order: 2,
        duration: { min: 2, max: 4, typical: 3, unit: 'weeks' },
        costRange: {
          min: 500,
          max: 1500,
          breakdown: {
            attorneyFees: { min: 500, max: 1500 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [],
        prerequisites: ['Contract analysis complete'],
        deliverables: ['Breach notice'],
        settlementProbability: 0.4,
        risks: []
      }
    ]);

    // Add basic timelines for other case types
    this.baseTimelines.set('consumer_protection', this.createBasicTimeline('consumer_protection'));
    this.baseTimelines.set('business_litigation', this.createBasicTimeline('business_litigation'));
    this.baseTimelines.set('family_law', this.createBasicTimeline('family_law'));
    this.baseTimelines.set('criminal', this.createBasicTimeline('criminal'));
    this.baseTimelines.set('other', this.createBasicTimeline('other'));
  }

  private createBasicTimeline(caseType: CaseType): TimelinePhase[] {
    return [
      {
        id: uuidv4(),
        name: 'Initial Consultation',
        description: 'Meet with attorney and evaluate case',
        order: 1,
        duration: { min: 1, max: 2, typical: 1, unit: 'weeks' },
        costRange: {
          min: 0,
          max: 1000,
          breakdown: {
            attorneyFees: { min: 0, max: 1000 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [],
        prerequisites: [],
        deliverables: ['Case evaluation'],
        settlementProbability: 0.1,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Pre-Filing Investigation',
        description: 'Gather evidence and assess claims',
        order: 2,
        duration: { min: 4, max: 8, typical: 6, unit: 'weeks' },
        costRange: {
          min: 1000,
          max: 5000,
          breakdown: {
            attorneyFees: { min: 1000, max: 5000 },
            courtCosts: { min: 0, max: 0 }
          }
        },
        keyActions: [],
        prerequisites: ['Consultation complete'],
        deliverables: ['Investigation report'],
        settlementProbability: 0.25,
        risks: []
      },
      {
        id: uuidv4(),
        name: 'Filing & Litigation',
        description: 'File lawsuit and proceed through litigation',
        order: 3,
        duration: { min: 12, max: 24, typical: 18, unit: 'months' },
        costRange: {
          min: 10000,
          max: 50000,
          breakdown: {
            attorneyFees: { min: 8000, max: 40000 },
            courtCosts: { min: 2000, max: 10000 }
          }
        },
        keyActions: [],
        prerequisites: ['Investigation complete'],
        deliverables: ['Court filings', 'Resolution'],
        settlementProbability: 0.7,
        risks: []
      }
    ];
  }

  private getBaseTimeline(caseType: CaseType): TimelinePhase[] {
    const timeline = this.baseTimelines.get(caseType);
    if (!timeline) {
      return this.createBasicTimeline(caseType);
    }
    // Deep clone to avoid modifying base timeline
    return JSON.parse(JSON.stringify(timeline));
  }

  private adjustForComplexity(
    phases: TimelinePhase[],
    complexity: ComplexityAssessment
  ): TimelinePhase[] {
    const complexityMultiplier = {
      simple: 0.8,
      moderate: 1.0,
      complex: 1.5
    };

    const costMultiplier = {
      simple: 0.7,
      moderate: 1.0,
      complex: 2.0
    };

    const multiplier = complexityMultiplier[complexity.level];
    const costMult = costMultiplier[complexity.level];

    return phases.map(phase => ({
      ...phase,
      duration: {
        ...phase.duration,
        min: Math.round(phase.duration.min * multiplier),
        max: Math.round(phase.duration.max * multiplier),
        typical: Math.round(phase.duration.typical * multiplier)
      },
      costRange: {
        ...phase.costRange,
        min: Math.round(phase.costRange.min * costMult),
        max: Math.round(phase.costRange.max * costMult),
        breakdown: Object.fromEntries(
          Object.entries(phase.costRange.breakdown).map(([key, value]) => [
            key,
            value ? { min: Math.round(value.min * costMult), max: Math.round(value.max * costMult) } : value
          ])
        ) as any
      }
    }));
  }

  private async applyJurisdictionRules(
    phases: TimelinePhase[],
    jurisdiction?: string
  ): Promise<TimelinePhase[]> {
    // In a real implementation, this would fetch jurisdiction-specific rules
    // For now, we'll apply some common adjustments
    
    if (!jurisdiction) return phases;

    // Example: California has specific employment law timelines
    if (jurisdiction.toLowerCase().includes('california') && 
        phases.some(p => p.name.includes('EEOC'))) {
      return phases.map(phase => {
        if (phase.name.includes('EEOC')) {
          return {
            ...phase,
            name: 'DFEH/CRD Filing (California)',
            description: 'File with California Civil Rights Department',
            criticalDeadlines: [
              {
                id: uuidv4(),
                description: 'California DFEH filing deadline',
                daysFromNow: 365, // California has 1 year
                type: 'filing',
                isCritical: true
              }
            ]
          };
        }
        return phase;
      });
    }

    return phases;
  }

  private calculateTotalDuration(phases: TimelinePhase[]): {
    min: number;
    max: number;
    typical: number;
    unit: string;
  } {
    let minDays = 0;
    let maxDays = 0;
    let typicalDays = 0;

    for (const phase of phases) {
      const daysMultiplier = phase.duration.unit === 'weeks' ? 7 : 
                           phase.duration.unit === 'months' ? 30 : 1;
      
      minDays += phase.duration.min * daysMultiplier;
      maxDays += phase.duration.max * daysMultiplier;
      typicalDays += phase.duration.typical * daysMultiplier;
    }

    // Convert back to most appropriate unit
    if (maxDays > 365) {
      return {
        min: Math.round(minDays / 365 * 10) / 10,
        max: Math.round(maxDays / 365 * 10) / 10,
        typical: Math.round(typicalDays / 365 * 10) / 10,
        unit: 'years'
      };
    } else if (maxDays > 90) {
      return {
        min: Math.round(minDays / 30),
        max: Math.round(maxDays / 30),
        typical: Math.round(typicalDays / 30),
        unit: 'months'
      };
    } else {
      return {
        min: Math.round(minDays / 7),
        max: Math.round(maxDays / 7),
        typical: Math.round(typicalDays / 7),
        unit: 'weeks'
      };
    }
  }

  private calculateTotalCost(phases: TimelinePhase[]): {
    min: number;
    max: number;
    typical: number;
  } {
    const min = phases.reduce((sum, phase) => sum + phase.costRange.min, 0);
    const max = phases.reduce((sum, phase) => sum + phase.costRange.max, 0);
    const typical = Math.round((min + max) / 2);

    return { min, max, typical };
  }

  private generateADROptions(
    caseType: CaseType,
    complexity: ComplexityAssessment
  ): ADROption[] {
    const options: ADROption[] = [];

    // Mediation is almost always an option
    options.push({
      type: 'mediation',
      description: 'Neutral third party helps parties reach agreement',
      estimatedCost: complexity.level === 'simple' ? '$500-$2,000' : 
                     complexity.level === 'complex' ? '$2,000-$10,000' : '$1,000-$5,000',
      estimatedDuration: '1-2 days',
      successRate: 0.7,
      whenToConsider: 'After initial discovery, before major litigation expenses'
    });

    // Arbitration for contract disputes
    if (caseType === 'contract_dispute' || caseType === 'business_litigation') {
      options.push({
        type: 'arbitration',
        description: 'Binding decision by neutral arbitrator',
        estimatedCost: '$5,000-$25,000',
        estimatedDuration: '3-6 months',
        successRate: 1.0, // Always results in decision
        whenToConsider: 'When contract requires arbitration or parties want faster resolution'
      });
    }

    // Direct negotiation for simpler cases
    if (complexity.level !== 'complex') {
      options.push({
        type: 'direct_negotiation',
        description: 'Attorneys negotiate directly without third party',
        estimatedCost: '$1,000-$5,000',
        estimatedDuration: '2-4 weeks',
        successRate: 0.5,
        whenToConsider: 'Early in case when parties are willing to compromise'
      });
    }

    return options;
  }

  private generateCriticalDeadlines(
    caseType: CaseType,
    jurisdiction?: string
  ): Deadline[] {
    const deadlines: Deadline[] = [];

    // Statute of limitations by case type
    const statuteOfLimitations: Record<CaseType, number> = {
      personal_injury: 730, // 2 years
      contract_dispute: 1460, // 4 years
      employment: 180, // 180 days for EEOC
      landlord_tenant: 365, // 1 year
      consumer_protection: 1095, // 3 years
      business_litigation: 1460, // 4 years
      family_law: 180, // Varies
      criminal: 0, // N/A
      other: 730 // 2 years default
    };

    if (statuteOfLimitations[caseType] > 0) {
      deadlines.push({
        id: uuidv4(),
        description: 'Statute of limitations expires',
        daysFromNow: statuteOfLimitations[caseType],
        type: 'statute_of_limitations',
        isCritical: true
      });
    }

    // Add case-specific deadlines
    if (caseType === 'employment') {
      deadlines.push({
        id: uuidv4(),
        description: 'EEOC charge filing deadline',
        daysFromNow: 180,
        type: 'filing',
        isCritical: true
      });
    }

    if (caseType === 'landlord_tenant') {
      deadlines.push({
        id: uuidv4(),
        description: 'Notice to landlord deadline',
        daysFromNow: 30,
        type: 'other',
        isCritical: false
      });
    }

    return deadlines;
  }

  private generateNextSteps(
    caseType: CaseType,
    classification: CaseTypeClassification
  ): NextSteps {
    const immediate: Action[] = [];
    const shortTerm: Action[] = [];
    const preparation: Action[] = [];

    // Universal immediate actions
    immediate.push({
      id: uuidv4(),
      title: 'Document everything',
      description: 'Start keeping detailed records of all incidents, communications, and damages',
      priority: 'immediate',
      category: 'documentation',
      estimatedTime: 'Ongoing'
    });

    immediate.push({
      id: uuidv4(),
      title: 'Preserve evidence',
      description: 'Save all relevant documents, emails, texts, photos, and videos',
      priority: 'immediate',
      category: 'documentation',
      estimatedTime: '1-2 hours'
    });

    // Case-specific actions
    switch (caseType) {
      case 'personal_injury':
        immediate.push({
          id: uuidv4(),
          title: 'Seek medical treatment',
          description: 'Get necessary medical care and follow all treatment recommendations',
          priority: 'immediate',
          category: 'documentation',
          estimatedTime: 'As needed'
        });
        shortTerm.push({
          id: uuidv4(),
          title: 'Contact insurance companies',
          description: 'Notify your insurance company but avoid giving recorded statements',
          priority: 'short_term',
          category: 'communication',
          estimatedTime: '1-2 hours'
        });
        break;

      case 'employment':
        immediate.push({
          id: uuidv4(),
          title: 'File for unemployment',
          description: 'If terminated, file for unemployment benefits immediately',
          priority: 'immediate',
          category: 'financial',
          estimatedTime: '2-3 hours'
        });
        shortTerm.push({
          id: uuidv4(),
          title: 'Request personnel file',
          description: 'Request copy of your complete personnel file from HR',
          priority: 'short_term',
          category: 'documentation',
          estimatedTime: '30 minutes'
        });
        break;

      case 'landlord_tenant':
        immediate.push({
          id: uuidv4(),
          title: 'Written notice to landlord',
          description: 'Send written notice of all issues via certified mail',
          priority: 'immediate',
          category: 'communication',
          estimatedTime: '1 hour'
        });
        immediate.push({
          id: uuidv4(),
          title: 'Contact local health department',
          description: 'Report habitability issues to local code enforcement',
          priority: 'immediate',
          category: 'legal',
          estimatedTime: '1 hour'
        });
        break;

      case 'contract_dispute':
        immediate.push({
          id: uuidv4(),
          title: 'Review contract thoroughly',
          description: 'Read entire contract including all amendments and exhibits',
          priority: 'immediate',
          category: 'documentation',
          estimatedTime: '2-3 hours'
        });
        shortTerm.push({
          id: uuidv4(),
          title: 'Gather performance documentation',
          description: 'Collect evidence of your performance under the contract',
          priority: 'short_term',
          category: 'documentation',
          estimatedTime: '3-4 hours'
        });
        break;
    }

    // Universal short-term actions
    shortTerm.push({
      id: uuidv4(),
      title: 'Consult with attorney',
      description: 'Schedule consultation with experienced attorney in this area',
      priority: 'short_term',
      category: 'legal',
      estimatedTime: '1-2 hours'
    });

    // Universal preparation actions
    preparation.push({
      id: uuidv4(),
      title: 'Create case timeline',
      description: 'Create detailed chronology of all relevant events',
      priority: 'preparation',
      category: 'documentation',
      estimatedTime: '2-3 hours'
    });

    preparation.push({
      id: uuidv4(),
      title: 'Identify witnesses',
      description: 'List all potential witnesses with contact information',
      priority: 'preparation',
      category: 'legal',
      estimatedTime: '1-2 hours'
    });

    preparation.push({
      id: uuidv4(),
      title: 'Calculate damages',
      description: 'Itemize all economic and non-economic damages',
      priority: 'preparation',
      category: 'financial',
      estimatedTime: '2-3 hours'
    });

    return { immediate, shortTerm, preparation };
  }

  private generateRiskFactors(
    complexity: ComplexityAssessment,
    classification: CaseTypeClassification
  ): Risk[] {
    const risks: Risk[] = [];

    // Complexity-based risks
    if (complexity.level === 'complex') {
      risks.push({
        id: uuidv4(),
        type: 'high',
        description: 'Complex litigation with uncertain outcome',
        impact: 'Significantly higher costs and longer timeline',
        mitigation: 'Consider early settlement negotiations or ADR'
      });
    }

    if (complexity.multipleDefendants) {
      risks.push({
        id: uuidv4(),
        type: 'high',
        description: 'Multiple defendants increase complexity',
        impact: 'Longer discovery, higher costs, coordination challenges',
        mitigation: 'Develop clear strategy for dealing with each defendant'
      });
    }

    // Case type specific risks
    if (classification.primaryType === 'employment') {
      risks.push({
        id: uuidv4(),
        type: 'medium',
        description: 'Potential counterclaims from employer',
        impact: 'Could face claims for breach of confidentiality or non-compete',
        mitigation: 'Review all employment agreements before proceeding'
      });
    }

    // General litigation risks
    risks.push({
      id: uuidv4(),
      type: 'medium',
      description: 'Discovery may reveal unfavorable facts',
      impact: 'Could weaken case or lead to counterclaims',
      mitigation: 'Thoroughly assess case strengths and weaknesses early'
    });

    if (complexity.estimatedValue && complexity.estimatedValue > 50000) {
      risks.push({
        id: uuidv4(),
        type: 'high',
        description: 'High-value case attracts aggressive defense',
        impact: 'Defendant likely to vigorously contest with top attorneys',
        mitigation: 'Ensure adequate resources and experienced counsel'
      });
    }

    return risks;
  }

  private createExecutiveSummary(
    caseType: CaseType,
    totalDuration: { min: number; max: number; typical: number; unit: string },
    totalCost: { min: number; max: number; typical: number },
    complexity: ComplexityAssessment,
    classification: CaseTypeClassification
  ): ExecutiveSummary {
    const caseTypeNames: Record<CaseType, string> = {
      personal_injury: 'Personal Injury',
      contract_dispute: 'Contract Dispute',
      employment: 'Employment Law',
      landlord_tenant: 'Landlord/Tenant',
      consumer_protection: 'Consumer Protection',
      business_litigation: 'Business Litigation',
      family_law: 'Family Law',
      criminal: 'Criminal Defense',
      other: 'General Litigation'
    };

    const durationStr = `${totalDuration.typical} ${totalDuration.unit}`;
    const costStr = `$${totalCost.min.toLocaleString()} - $${totalCost.max.toLocaleString()}`;

    // Assess case strength based on various factors
    let strengthAssessment: 'strong' | 'moderate' | 'weak' | 'uncertain' = 'moderate';
    let confidence = classification.confidence;

    if (confidence > 0.8 && complexity.level === 'simple') {
      strengthAssessment = 'strong';
    } else if (confidence < 0.5 || complexity.level === 'complex') {
      strengthAssessment = 'uncertain';
    }

    // Generate recommendation based on case analysis
    let primaryRecommendation = 'Proceed with caution and seek legal counsel';
    const alternativeOptions: string[] = [];

    if (totalCost.min < 10000 && complexity.level === 'simple') {
      primaryRecommendation = 'Consider demand letter and negotiation before filing suit';
      alternativeOptions.push('Small claims court may be appropriate');
    } else if (complexity.level === 'complex' || totalCost.max > 50000) {
      primaryRecommendation = 'Strongly recommend experienced counsel and consider early mediation';
      alternativeOptions.push('Explore settlement options early to control costs');
    }

    // Add ADR recommendations
    alternativeOptions.push('Mediation could resolve matter in 1-2 months');
    
    if (caseType === 'contract_dispute') {
      alternativeOptions.push('Check contract for mandatory arbitration clause');
    }

    return {
      caseType: caseTypeNames[caseType],
      estimatedDuration: durationStr,
      totalCostRange: costStr,
      strengthAssessment,
      confidence,
      primaryRecommendation,
      alternativeOptions
    };
  }
}