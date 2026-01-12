/**
 * Core types for the Governance Kernel
 */

export enum ViolationCode {
  AIT1_IMPLICIT_AUTHORITY = 'AIT1_IMPLICIT_AUTHORITY',
  AIT1_MISSING_DELEGATION_PATH = 'AIT1_MISSING_DELEGATION_PATH',
  MOC_DECISION_NOT_GATED = 'MOC_DECISION_NOT_GATED',
  MOC_EXECUTION_NOT_GATED = 'MOC_EXECUTION_NOT_GATED',
  CPT1_SEMANTIC_DRIFT = 'CPT1_SEMANTIC_DRIFT',
  CPT1_TEMPORAL_STALE = 'CPT1_TEMPORAL_STALE',
  CPT1_GOAL_CONSTRAINT_CONFLICT = 'CPT1_GOAL_CONSTRAINT_CONFLICT',
  SBAA_SPLIT_BRAIN = 'SBAA_SPLIT_BRAIN',
  OMEGA_UNDEFINED_TERM_USED_IN_DECISION = 'OMEGA_UNDEFINED_TERM_USED_IN_DECISION',
  OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF = 'OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF',
  OMEGA_IMPLICIT_AUTHORITY_IN_TEXT = 'OMEGA_IMPLICIT_AUTHORITY_IN_TEXT',
  SCHEMA_VALIDATION_ERROR = 'SCHEMA_VALIDATION_ERROR',
}

export enum Severity {
  WARN = 'warn',
  FAIL = 'fail',
  FREEZE = 'freeze',
}

export enum OperationType {
  SUP = 'SUP', // Support/Information
  INT = 'INT', // Interpretation
  EIN = 'EIN', // Execution/Irreversible
  DEC = 'DEC', // Decision/Authority
}

export interface Agent {
  name: string;
  role: string;
  allowed_actions: string[];
}

export interface Tool {
  name: string;
  irreversible: boolean;
  requires_human_signoff: boolean;
}

export interface DataSource {
  name: string;
  trust_level: 'high' | 'medium' | 'low';
}

export interface Definition {
  term: string;
  meaning: string;
  locked: boolean;
}

export interface AuthorityGrant {
  granted_to: string; // agent/role name
  scope: string[]; // specific operations or '*'
  valid_until?: string; // ISO timestamp
  granted_by: string; // human identifier or 'human_root'
}

export interface AuthorityMap {
  root: string; // must be 'human_root' or specific human identifier
  delegations: AuthorityGrant[];
}

export interface Operation {
  id: string;
  type: string; // 'propose' | 'verify' | 'approve' | 'execute' | custom
  executor: string; // agent name
  tool?: string; // tool name if applicable
  requires_approval?: boolean;
  approved_by?: string; // human identifier
  changes_state?: boolean;
  modifies_definitions?: boolean;
  is_decision?: boolean;
}

export interface Workflow {
  version: string;
  agents: Agent[];
  tools: Tool[];
  data_sources?: DataSource[];
  definitions?: Definition[];
  authority_map: AuthorityMap;
  operations: Operation[];
  constraints: string[];
  optimization_goals?: string[];
  timestamps: {
    created: string;
    valid_until?: string;
  };
  unfreeze_token?: string;
}

export interface Violation {
  code: ViolationCode;
  severity: Severity;
  message: string;
  path: string; // JSON pointer
  evidence: Record<string, any>;
  remediation: string;
}

export interface FreezeState {
  frozen: boolean;
  reason?: string;
  violations: Violation[];
}

export interface VerificationResult {
  valid: boolean;
  violations: Violation[];
  freeze?: FreezeState;
  summary: string;
}

export interface Classification {
  operation_id: string;
  type: OperationType;
  reason: string;
  requires_gating: boolean;
}

export interface ScanResult {
  artifact_type: string;
  violations: Violation[];
  clean: boolean;
  summary: string;
}
