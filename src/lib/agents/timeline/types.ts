export type CaseType = 
  | 'personal_injury'
  | 'contract_dispute'
  | 'employment'
  | 'landlord_tenant'
  | 'consumer_protection'
  | 'business_litigation'
  | 'family_law'
  | 'criminal'
  | 'other';

export interface TimelinePhase {
  id: string;
  name: string;
  description: string;
  order: number;
  duration: {
    min: number;
    max: number;
    unit: 'days' | 'weeks' | 'months';
    typical: number;
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
  criticalDeadlines?: Deadline[];
}

export interface CostBreakdown {
  attorneyFees: { min: number; max: number };
  courtCosts: { min: number; max: number };
  expertWitnesses?: { min: number; max: number };
  discovery?: { min: number; max: number };
  other?: { min: number; max: number };
}

export interface Action {
  id: string;
  title: string;
  description: string;
  priority: 'immediate' | 'short_term' | 'preparation';
  category: 'documentation' | 'legal' | 'communication' | 'financial';
  estimatedTime?: string;
  resources?: string[];
}

export interface Risk {
  id: string;
  type: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  mitigation: string;
}

export interface Deadline {
  id: string;
  description: string;
  date?: Date;
  daysFromNow?: number;
  type: 'statute_of_limitations' | 'filing' | 'response' | 'discovery' | 'other';
  isCritical: boolean;
}

export interface CaseTypeClassification {
  primaryType: CaseType;
  subType?: string;
  confidence: number;
  relatedTypes: CaseType[];
  specialCircumstances: string[];
  jurisdiction?: string;
  parties: LegalParty[];
}

export interface LegalParty {
  role: 'plaintiff' | 'defendant' | 'third_party';
  type: 'individual' | 'business' | 'government';
  name?: string;
  characteristics?: string[];
}

export interface ComplexityAssessment {
  level: 'simple' | 'moderate' | 'complex';
  factors: string[];
  estimatedValue?: number;
  multipleDefendants: boolean;
  classActionPotential: boolean;
  federalJurisdiction: boolean;
}

export interface LegalEntities {
  parties: LegalParty[];
  jurisdiction: {
    state?: string;
    federal?: boolean;
    county?: string;
  };
  damages: {
    economic: number | null;
    nonEconomic: number | null;
    punitive: boolean;
    types: string[];
  };
  dates: {
    incidentDate?: Date;
    discoveryDate?: Date;
    filingDeadline?: Date;
  };
  specialFactors: string[];
}

export interface ExecutiveSummary {
  caseType: string;
  estimatedDuration: string;
  totalCostRange: string;
  strengthAssessment: 'strong' | 'moderate' | 'weak' | 'uncertain';
  confidence: number;
  primaryRecommendation: string;
  alternativeOptions: string[];
}

export interface ADROption {
  type: 'mediation' | 'arbitration' | 'settlement_conference' | 'direct_negotiation';
  description: string;
  estimatedCost: string;
  estimatedDuration: string;
  successRate: number;
  whenToConsider: string;
}

export interface NextSteps {
  immediate: Action[];
  shortTerm: Action[];
  preparation: Action[];
}

export interface LitigationTimeline {
  id: string;
  summary: ExecutiveSummary;
  classification: CaseTypeClassification;
  complexity: ComplexityAssessment;
  phases: TimelinePhase[];
  totalDuration: {
    min: number;
    max: number;
    typical: number;
    unit: string;
  };
  totalCost: {
    min: number;
    max: number;
    typical: number;
  };
  alternativeDisputes: ADROption[];
  criticalDeadlines: Deadline[];
  nextSteps: NextSteps;
  riskFactors: Risk[];
  metadata: {
    generatedAt: Date;
    jurisdiction: string;
    lastUpdated: Date;
  };
}

export interface TimelineAnalysis {
  classification: CaseTypeClassification;
  entities: LegalEntities;
  complexity: ComplexityAssessment;
  urgency: {
    level: 'critical' | 'high' | 'moderate' | 'low';
    factors: string[];
  };
  customFactors: string[];
}

export interface Recommendations {
  primary: string;
  riskFactors: string[];
  criticalDeadlines: Deadline[];
  costSavingOpportunities: string[];
  alternativeDisputes: ADROption[];
}

export interface JurisdictionRules {
  state: string;
  filingDeadlines: Record<string, number>; // days
  specialRequirements: string[];
  mandatoryProcedures: string[];
  localRules: string[];
  costFactors: {
    filingFees: number;
    serviceFees: number;
    motionFees: number;
  };
}

export interface TimelineTemplate {
  id: string;
  caseType: CaseType;
  jurisdiction?: string;
  phases: TimelinePhase[];
  averageDuration: number; // days
  averageCost: number;
  notes: string[];
}