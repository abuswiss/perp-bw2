export interface AgentInput {
  matterId: string | null;
  query: string;
  context?: Record<string, any>;
  documents?: string[];
  parameters?: Record<string, any>;
}

export interface AgentOutput {
  success: boolean;
  result: any;
  citations?: Citation[];
  metadata?: Record<string, any>;
  error?: string;
  executionTime?: number;
}

export interface Citation {
  id: string;
  type: 'case' | 'statute' | 'document' | 'web' | 'regulation';
  title: string;
  url?: string;
  citation?: string;
  court?: string;
  date?: string;
  relevance?: number;
}

export interface AgentCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  estimatedDuration: number; // in seconds
}

export interface AgentTask {
  id: string;
  matterId: string | null;
  agentType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: AgentInput;
  output?: AgentOutput;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
  currentStep?: string;
  error?: string;
}

export interface LegalAgent {
  id: string;
  type: 'research' | 'writing' | 'analysis' | 'review' | 'discovery';
  name: string;
  description: string;
  capabilities: AgentCapability[];
  requiredContext: string[];
  
  execute(input: AgentInput): Promise<AgentOutput>;
  validateInput(input: AgentInput): boolean;
  estimateDuration(input: AgentInput): number;
  getRequiredPermissions(): string[];
}

export interface AgentExecution {
  id: string;
  taskId: string;
  agentType: string;
  status: 'running' | 'completed' | 'failed';
  inputData: AgentInput;
  outputData?: AgentOutput;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  progress: number;
  currentStep: string;
}

export interface AgentOrchestrationPlan {
  id: string;
  matterId: string;
  userQuery: string;
  agents: Array<{
    agentType: string;
    dependencies: string[];
    priority: number;
    estimatedDuration: number;
  }>;
  totalEstimatedDuration: number;
  status: 'planned' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
}