import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getDefaultChatModel } from '@/lib/providers';
import { 
  CaseTypeClassification, 
  ComplexityAssessment, 
  LegalEntities,
  CaseType,
  LegalParty 
} from './types';

export class TimelineNLPProcessor {
  private llm: BaseChatModel | null = null;
  private strParser = new StringOutputParser();

  constructor() {
    this.initializeLLM();
  }

  private async initializeLLM() {
    try {
      this.llm = await getDefaultChatModel();
      if (this.llm && 'temperature' in this.llm) {
        (this.llm as any).temperature = 0.1; // Low temperature for consistent classification
      }
    } catch (error) {
      console.error('Failed to initialize LLM for TimelineNLPProcessor:', error);
    }
  }

  async classifyCaseType(input: string): Promise<CaseTypeClassification> {
    if (!this.llm) {
      return this.fallbackClassification(input);
    }

    const classificationPrompt = PromptTemplate.fromTemplate(`
You are a legal case classifier. Analyze this description and identify the legal issue type.

Description: {input}

Classify the case into one of these primary types:
- personal_injury: Slip/fall, car accidents, medical malpractice, product liability
- contract_dispute: Breach of contract, construction defects, service disputes
- employment: Wrongful termination, discrimination, wage theft, harassment
- landlord_tenant: Habitability issues, security deposits, evictions, lease disputes
- consumer_protection: Fraud, defective products, unfair billing, false advertising
- business_litigation: Partnership disputes, intellectual property, commercial disputes
- family_law: Divorce, custody, support, domestic relations
- criminal: Criminal charges, defense matters
- other: Doesn't fit above categories

Also extract:
1. Confidence level (0-1)
2. Any related case types that might apply
3. Special circumstances (disability, senior citizen, minors involved, class action potential)
4. Jurisdiction indicators (state mentions, federal issues)
5. All parties involved with their roles

Return ONLY a valid JSON object with this structure:
{{
  "primaryType": "case_type_here",
  "subType": "specific subtype if applicable",
  "confidence": 0.95,
  "relatedTypes": ["other_relevant_types"],
  "specialCircumstances": ["any special factors"],
  "jurisdiction": "state or federal indicator",
  "parties": [
    {{"role": "plaintiff", "type": "individual", "name": "if mentioned"}},
    {{"role": "defendant", "type": "business", "name": "if mentioned"}}
  ]
}}
`);

    try {
      const chain = classificationPrompt.pipe(this.llm).pipe(this.strParser);
      const response = await chain.invoke({ input });
      
      // Parse and validate the JSON response
      const cleanResponse = response.replace(/```json\n?|```/g, '').trim();
      const parsed = JSON.parse(cleanResponse);
      
      // Ensure valid case type
      const validTypes: CaseType[] = [
        'personal_injury', 'contract_dispute', 'employment', 
        'landlord_tenant', 'consumer_protection', 'business_litigation',
        'family_law', 'criminal', 'other'
      ];
      
      if (!validTypes.includes(parsed.primaryType)) {
        parsed.primaryType = 'other';
      }
      
      return {
        primaryType: parsed.primaryType,
        subType: parsed.subType,
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        relatedTypes: parsed.relatedTypes || [],
        specialCircumstances: parsed.specialCircumstances || [],
        jurisdiction: parsed.jurisdiction,
        parties: parsed.parties || []
      };
      
    } catch (error) {
      console.error('Case classification failed:', error);
      return this.fallbackClassification(input);
    }
  }

  async assessComplexity(
    input: string, 
    classification: CaseTypeClassification
  ): Promise<ComplexityAssessment> {
    if (!this.llm) {
      return this.fallbackComplexity(input, classification);
    }

    const complexityPrompt = PromptTemplate.fromTemplate(`
Assess the complexity of this legal case.

Case Description: {input}
Case Type: {caseType}
Parties: {parties}

Consider these factors:
1. Number of parties (multiple defendants = more complex)
2. Estimated damages/value (under $25K = simple, $25K-100K = moderate, over $100K = complex)
3. Legal issues involved (constitutional questions, novel legal theories = complex)
4. Jurisdictional issues (federal vs state, multi-state = complex)
5. Evidence requirements (extensive discovery, expert witnesses = complex)
6. Class action potential

Return ONLY a valid JSON object:
{{
  "level": "simple|moderate|complex",
  "factors": ["list of complexity factors"],
  "estimatedValue": null,
  "multipleDefendants": false,
  "classActionPotential": false,
  "federalJurisdiction": false
}}
`);

    try {
      const chain = complexityPrompt.pipe(this.llm).pipe(this.strParser);
      const response = await chain.invoke({
        input,
        caseType: classification.primaryType,
        parties: JSON.stringify(classification.parties)
      });
      
      const cleanResponse = response.replace(/```json\n?|```/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Complexity assessment failed:', error);
      return this.fallbackComplexity(input, classification);
    }
  }

  async extractEntities(input: string): Promise<LegalEntities> {
    if (!this.llm) {
      return this.fallbackEntities(input);
    }

    const entityPrompt = PromptTemplate.fromTemplate(`
Extract legal entities and key information from this case description.

Description: {input}

Extract:
1. All parties (plaintiffs, defendants, third parties) with their types
2. Jurisdiction indicators (state, county, federal court mentions)
3. Damage amounts and types (economic, non-economic, punitive)
4. Important dates (incident date, discovery date)
5. Special factors (statute of limitations concerns, emergency injunctions)

Return ONLY a valid JSON object:
{{
  "parties": [
    {{"role": "plaintiff", "type": "individual", "name": null, "characteristics": []}}
  ],
  "jurisdiction": {{
    "state": null,
    "federal": false,
    "county": null
  }},
  "damages": {{
    "economic": null,
    "nonEconomic": null,
    "punitive": false,
    "types": []
  }},
  "dates": {{
    "incidentDate": null,
    "discoveryDate": null,
    "filingDeadline": null
  }},
  "specialFactors": []
}}
`);

    try {
      const chain = entityPrompt.pipe(this.llm).pipe(this.strParser);
      const response = await chain.invoke({ input });
      
      const cleanResponse = response.replace(/```json\n?|```/g, '').trim();
      const parsed = JSON.parse(cleanResponse);
      
      // Clean up dates
      if (parsed.dates) {
        for (const key in parsed.dates) {
          if (parsed.dates[key]) {
            parsed.dates[key] = new Date(parsed.dates[key]);
          }
        }
      }
      
      return parsed;
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return this.fallbackEntities(input);
    }
  }

  async assessUrgency(input: string, entities: LegalEntities): Promise<{
    level: 'critical' | 'high' | 'moderate' | 'low';
    factors: string[];
  }> {
    const urgencyKeywords = {
      critical: ['eviction', 'emergency', 'injunction', 'restraining order', 'immediate'],
      high: ['deadline', 'statute of limitations', 'termination', 'foreclosure'],
      moderate: ['dispute', 'breach', 'claim', 'damage'],
      low: ['inquiry', 'question', 'considering', 'thinking about']
    };

    const factors: string[] = [];
    let level: 'critical' | 'high' | 'moderate' | 'low' = 'moderate';

    const lowerInput = input.toLowerCase();

    // Check for urgent keywords
    for (const [urgencyLevel, keywords] of Object.entries(urgencyKeywords)) {
      for (const keyword of keywords) {
        if (lowerInput.includes(keyword)) {
          factors.push(`Contains "${keyword}"`);
          if (urgencyLevel === 'critical' || (urgencyLevel === 'high' && level !== 'critical')) {
            level = urgencyLevel as any;
          }
        }
      }
    }

    // Check dates
    if (entities.dates?.filingDeadline) {
      const daysUntilDeadline = Math.floor(
        (entities.dates.filingDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilDeadline < 30) {
        level = 'critical';
        factors.push(`Filing deadline in ${daysUntilDeadline} days`);
      } else if (daysUntilDeadline < 90) {
        level = level === 'critical' ? 'critical' : 'high';
        factors.push(`Filing deadline approaching`);
      }
    }

    return { level, factors };
  }

  async identifyCustomFactors(input: string): Promise<string[]> {
    const customFactors: string[] = [];
    const lowerInput = input.toLowerCase();

    // Check for vulnerable parties
    if (lowerInput.includes('elderly') || lowerInput.includes('senior')) {
      customFactors.push('Elderly party involved');
    }
    if (lowerInput.includes('minor') || lowerInput.includes('child')) {
      customFactors.push('Minor involved');
    }
    if (lowerInput.includes('disabled') || lowerInput.includes('disability')) {
      customFactors.push('Disability considerations');
    }

    // Check for regulatory issues
    if (lowerInput.includes('osha') || lowerInput.includes('safety violation')) {
      customFactors.push('Regulatory compliance issues');
    }
    if (lowerInput.includes('environmental') || lowerInput.includes('epa')) {
      customFactors.push('Environmental regulations involved');
    }

    // Check for insurance
    if (lowerInput.includes('insurance') || lowerInput.includes('coverage')) {
      customFactors.push('Insurance coverage issues');
    }

    // Check for criminal overlap
    if (lowerInput.includes('police') || lowerInput.includes('criminal')) {
      customFactors.push('Potential criminal law overlap');
    }

    return customFactors;
  }

  // Fallback methods when LLM is unavailable
  private fallbackClassification(input: string): CaseTypeClassification {
    const lowerInput = input.toLowerCase();
    let primaryType: CaseType = 'other';
    const parties: LegalParty[] = [];

    // Simple keyword matching
    if (lowerInput.includes('landlord') || lowerInput.includes('tenant') || lowerInput.includes('rent')) {
      primaryType = 'landlord_tenant';
    } else if (lowerInput.includes('fired') || lowerInput.includes('terminated') || lowerInput.includes('employer')) {
      primaryType = 'employment';
    } else if (lowerInput.includes('contract') || lowerInput.includes('breach') || lowerInput.includes('agreement')) {
      primaryType = 'contract_dispute';
    } else if (lowerInput.includes('injury') || lowerInput.includes('accident') || lowerInput.includes('malpractice')) {
      primaryType = 'personal_injury';
    } else if (lowerInput.includes('consumer') || lowerInput.includes('fraud') || lowerInput.includes('scam')) {
      primaryType = 'consumer_protection';
    }

    // Extract basic parties
    if (lowerInput.includes('company') || lowerInput.includes('corporation')) {
      parties.push({ role: 'defendant', type: 'business' });
    }
    parties.push({ role: 'plaintiff', type: 'individual' });

    return {
      primaryType,
      confidence: 0.6,
      relatedTypes: [],
      specialCircumstances: [],
      parties
    };
  }

  private fallbackComplexity(
    input: string, 
    classification: CaseTypeClassification
  ): ComplexityAssessment {
    const lowerInput = input.toLowerCase();
    const factors: string[] = [];
    let level: 'simple' | 'moderate' | 'complex' = 'moderate';

    // Check for amount mentions
    const amountMatch = input.match(/\$[\d,]+/);
    let estimatedValue = null;
    
    if (amountMatch) {
      estimatedValue = parseInt(amountMatch[0].replace(/[$,]/g, ''));
      if (estimatedValue < 25000) {
        level = 'simple';
        factors.push('Low damage amount');
      } else if (estimatedValue > 100000) {
        level = 'complex';
        factors.push('High damage amount');
      }
    }

    // Check for multiple parties
    const multipleDefendants = lowerInput.includes('companies') || 
                              lowerInput.includes('defendants') ||
                              (input.match(/and/g) || []).length > 2;

    if (multipleDefendants) {
      level = 'complex';
      factors.push('Multiple parties involved');
    }

    return {
      level,
      factors,
      estimatedValue: estimatedValue || undefined,
      multipleDefendants,
      classActionPotential: lowerInput.includes('class action') || lowerInput.includes('others'),
      federalJurisdiction: lowerInput.includes('federal') || lowerInput.includes('constitutional')
    };
  }

  private fallbackEntities(input: string): LegalEntities {
    const lowerInput = input.toLowerCase();
    const entities: LegalEntities = {
      parties: [{ role: 'plaintiff', type: 'individual' }],
      jurisdiction: {
        federal: lowerInput.includes('federal'),
        state: null,
        county: null
      },
      damages: {
        economic: null,
        nonEconomic: null,
        punitive: false,
        types: []
      },
      dates: {},
      specialFactors: []
    };

    // Extract damage types
    if (lowerInput.includes('medical')) entities.damages.types.push('medical bills');
    if (lowerInput.includes('wage') || lowerInput.includes('salary')) entities.damages.types.push('lost wages');
    if (lowerInput.includes('property')) entities.damages.types.push('property damage');

    return entities;
  }
}