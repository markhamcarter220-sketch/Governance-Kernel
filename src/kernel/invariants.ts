/**
 * Invariant definitions and violation explanations
 */

import { ViolationCode } from './types';

export const INVARIANT_EXPLANATIONS: Record<ViolationCode, string> = {
  [ViolationCode.AIT1_IMPLICIT_AUTHORITY]:
    'AIT-1 Violation: Operation assumes authority without explicit delegation. Authority must be explicitly granted through a delegation chain from human_root.',

  [ViolationCode.AIT1_MISSING_DELEGATION_PATH]:
    'AIT-1 Violation: No valid delegation path exists from human_root to the executor. All authority must trace back to a human root through explicit delegations.',

  [ViolationCode.AIT1_CIRCULAR_DELEGATION]:
    'AIT-1 Violation: Circular delegation detected. Entity A delegates to B which delegates back to A (directly or indirectly). Authority chains must be acyclic.',

  [ViolationCode.AIT1_SELF_DELEGATION]:
    'AIT-1 Violation: Entity attempting to delegate authority to itself. Self-delegation is prohibited as it creates authority from nothing.',

  [ViolationCode.AIT1_ORPHAN_DELEGATION]:
    'AIT-1 Violation: Delegation granted by an entity that is not the authority root and has no delegation itself. All delegations must trace to root.',

  [ViolationCode.AIT1_SCOPE_VIOLATION]:
    'AIT-1 Violation: Operation type is outside the scope granted to the executor. Delegation scope must cover all operations performed.',

  [ViolationCode.MOC_DECISION_NOT_GATED]:
    'MOC Violation: Decision operation (DEC) is not gated by human approval. Operations that make value judgments or select among options must have explicit human signoff.',

  [ViolationCode.MOC_EXECUTION_NOT_GATED]:
    'MOC Violation: Execution operation (EIN) with irreversible effects is not gated by human approval. Irreversible operations must have requires_approval=true and an approved_by field.',

  [ViolationCode.CPT1_SEMANTIC_DRIFT]:
    'CPT-1 Violation: Semantic Invariant violated. A locked definition is being modified or an undefined term is being used in decision-making context.',

  [ViolationCode.CPT1_TEMPORAL_STALE]:
    'CPT-1 Violation: Temporal Invariant violated. Workflow timestamp is stale or a delegation has expired.',

  [ViolationCode.CPT1_GOAL_CONSTRAINT_CONFLICT]:
    'CPT-1 Violation: Goal and Constraint Invariant conflict detected. Optimization goals contradict hard constraints.',

  [ViolationCode.CPT1_DEFINITION_HASH_MISMATCH]:
    'CPT-1 Violation: Definition content has changed without version update. Definitions used in DEC/EIN operations must remain stable or be explicitly versioned.',

  [ViolationCode.CPT1_UNDEFINED_TERM_IN_DECISION]:
    'CPT-1 Violation: Decision or execution operation uses undefined terms. All terms used in critical operations must be explicitly defined.',

  [ViolationCode.SBAA_SPLIT_BRAIN]:
    'SBAA Violation: Split-Brain Authority detected. Multiple conflicting authority roots or decision sources exist. System must freeze until single authority is restored.',

  [ViolationCode.SBAA_CONTRADICTORY_DELEGATION]:
    'SBAA Violation: Contradictory delegations detected. Same entity has conflicting authority grants that cannot be reconciled.',

  [ViolationCode.OMEGA_UNDEFINED_TERM_USED_IN_DECISION]:
    'Ω-SCAN Violation: Artifact uses undefined terms in decision-making context. All terms used for decisions must be explicitly defined.',

  [ViolationCode.OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF]:
    'Ω-SCAN Violation: Artifact describes irreversible actions without human signoff requirement. All irreversible operations must require explicit human approval.',

  [ViolationCode.OMEGA_IMPLICIT_AUTHORITY_IN_TEXT]:
    'Ω-SCAN Violation: Artifact contains implicit authority claims (e.g., "AI decides", "model approves"). All authority must be explicit.',

  [ViolationCode.SCHEMA_VALIDATION_ERROR]:
    'Schema Validation Error: Input does not conform to expected JSON schema.',
};

export function explainViolation(code: ViolationCode): string {
  return INVARIANT_EXPLANATIONS[code] || 'Unknown violation code';
}

export const INVARIANT_RULES = {
  AIT1: {
    name: 'Authority Invariance Theorem',
    description:
      'Authority is explicit, typed, and conserved. No operation may execute without a valid authority path from human_root.',
  },
  MOC: {
    name: 'MAP Operation Classifier',
    description:
      'Operations are classified as SUP/INT/EIN/DEC. DEC and EIN operations must be gated by explicit human authority.',
  },
  CPT1: {
    name: 'Coherence Preservation Theorem',
    description:
      'Enforces Goal, Constraint, Semantic, and Temporal invariants. Contradictions trigger freeze.',
  },
  SBAA: {
    name: 'Split-Brain Authority Axiom',
    description:
      'Authority must be singular. Conflicting authority sources trigger immediate freeze.',
  },
  OMEGA: {
    name: 'Legitimacy Gate (Ω-SCAN)',
    description:
      'Pre-check for artifacts: rejects implicit authority, undefined terms in decisions, and missing signoff for irreversibles.',
  },
};
