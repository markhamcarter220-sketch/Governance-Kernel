/**
 * Coherence validation logic (CPT-1) - HARDENED
 * Definition immutability and hash-based drift detection
 */

import { Workflow, Violation, ViolationCode, Severity, Definition, OperationType } from './types';
import { createHash } from 'crypto';
import { classifyOperation } from './classifier';

export function validateCoherence(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  // Goal Invariant (GI): Check for goal-constraint conflicts
  violations.push(...checkGoalConstraintConflict(workflow));

  // Semantic Invariant (SI): Check for definition modifications
  violations.push(...checkSemanticDrift(workflow));

  // Semantic Invariant (SI): Validate definition hashes
  violations.push(...validateDefinitionHashes(workflow));

  // Semantic Invariant (SI): Check undefined terms in DEC/EIN operations
  violations.push(...checkUndefinedTermsInCriticalOps(workflow));

  // Temporal Invariant (TI): Check for stale timestamps
  violations.push(...checkTemporalValidity(workflow));

  // Constraint Invariant (CI): Validate constraint consistency
  violations.push(...checkConstraintConsistency(workflow));

  return violations;
}

function checkGoalConstraintConflict(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  if (!workflow.optimization_goals || workflow.optimization_goals.length === 0) {
    return violations;
  }

  // Simple heuristic: check for obvious conflicts in text
  const constraints = workflow.constraints.map((c) => c.toLowerCase());
  const goals = workflow.optimization_goals.map((g) => g.toLowerCase());

  goals.forEach((goal, goalIndex) => {
    constraints.forEach((constraint, constraintIndex) => {
      // Check for negation conflicts (e.g., "minimize X" vs "X must be maximized")
      if (
        (goal.includes('minimize') && constraint.includes('maximi')) ||
        (goal.includes('maximize') && constraint.includes('minimi')) ||
        (goal.includes('reduce') && constraint.includes('increase')) ||
        (goal.includes('increase') && constraint.includes('reduce'))
      ) {
        const sharedTerms = findSharedTerms(goal, constraint);
        if (sharedTerms.length > 0) {
          violations.push({
            code: ViolationCode.CPT1_GOAL_CONSTRAINT_CONFLICT,
            severity: Severity.FREEZE,
            message: 'Goal and constraint appear to conflict',
            path: `/optimization_goals/${goalIndex}`,
            evidence: {
              goal: workflow.optimization_goals![goalIndex],
              constraint: workflow.constraints[constraintIndex],
              shared_terms: sharedTerms,
            },
            remediation:
              'Resolve conflict between optimization goal and constraint, or clarify their relationship',
          });
        }
      }
    });
  });

  return violations;
}

function checkSemanticDrift(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  if (!workflow.definitions) {
    return violations;
  }

  // Check if any locked definitions are being modified by operations
  workflow.operations.forEach((op, opIndex) => {
    if (op.modifies_definitions) {
      const lockedDefs = workflow.definitions!.filter((d) => d.locked);
      if (lockedDefs.length > 0) {
        violations.push({
          code: ViolationCode.CPT1_SEMANTIC_DRIFT,
          severity: Severity.FREEZE,
          message: `Operation "${op.id}" attempts to modify definitions, but locked definitions exist`,
          path: `/operations/${opIndex}/modifies_definitions`,
          evidence: {
            operation_id: op.id,
            locked_definitions: lockedDefs.map((d) => d.term),
          },
          remediation: 'Remove modifies_definitions flag or unlock definitions before modification',
        });
      }
    }
  });

  return violations;
}

/**
 * Validate definition hashes for drift detection
 * Compute hash if not present, verify if present
 */
function validateDefinitionHashes(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  if (!workflow.definitions || workflow.definitions.length === 0) {
    return violations;
  }

  workflow.definitions.forEach((def, index) => {
    const computedHash = hashDefinition(def);

    if (def.hash) {
      // Hash provided - verify it matches
      if (def.hash !== computedHash) {
        violations.push({
          code: ViolationCode.CPT1_DEFINITION_HASH_MISMATCH,
          severity: Severity.FREEZE,
          message: `Definition "${def.term}" hash mismatch - content changed without version update`,
          path: `/definitions/${index}/hash`,
          evidence: {
            term: def.term,
            expected_hash: def.hash,
            computed_hash: computedHash,
            locked: def.locked,
            version: def.version,
          },
          remediation: def.locked
            ? `Locked definition cannot be changed. If authorized change is needed, update version field.`
            : `Update hash to ${computedHash} or increment version field for authorized change.`,
        });
      }
    }
    // Note: Not enforcing hash presence for backward compatibility,
    // but hashes are computed on-the-fly during validation
  });

  return violations;
}

/**
 * Check for undefined terms used in DEC/EIN operations
 */
function checkUndefinedTermsInCriticalOps(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  // Build set of defined terms
  const definedTerms = new Set<string>();
  if (workflow.definitions) {
    workflow.definitions.forEach((d) => definedTerms.add(d.term.toLowerCase()));
  }

  // Check DEC/EIN operations for undefined terms
  workflow.operations.forEach((op, opIndex) => {
    const classification = classifyOperation(op, workflow);

    if (classification.type === OperationType.DEC || classification.type === OperationType.EIN) {
      // Extract potential terms from operation ID and type
      // This is heuristic - looking for capitalized words or quoted terms
      const potentialTerms = extractPotentialTerms(op.id + ' ' + op.type);

      const undefinedTerms = potentialTerms.filter(
        (term) => !definedTerms.has(term.toLowerCase())
      );

      if (undefinedTerms.length > 0 && workflow.definitions && workflow.definitions.length > 0) {
        violations.push({
          code: ViolationCode.CPT1_UNDEFINED_TERM_IN_DECISION,
          severity: Severity.WARN,
          message: `Operation "${op.id}" (${classification.type}) uses potentially undefined terms`,
          path: `/operations/${opIndex}`,
          evidence: {
            operation_id: op.id,
            classification: classification.type,
            undefined_terms: undefinedTerms,
            defined_terms: Array.from(definedTerms),
          },
          remediation: `Define terms ${undefinedTerms.join(', ')} or clarify operation naming`,
        });
      }
    }
  });

  return violations;
}

function checkTemporalValidity(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];
  const now = new Date();

  // Check workflow validity
  if (workflow.timestamps.valid_until) {
    const validUntil = new Date(workflow.timestamps.valid_until);
    if (validUntil < now) {
      violations.push({
        code: ViolationCode.CPT1_TEMPORAL_STALE,
        severity: Severity.FAIL,
        message: 'Workflow has expired',
        path: '/timestamps/valid_until',
        evidence: {
          valid_until: workflow.timestamps.valid_until,
          current_time: now.toISOString(),
        },
        remediation: 'Update workflow validity timestamp or create a new workflow',
      });
    }
  }

  // Check creation timestamp sanity (not in future, not too old)
  const created = new Date(workflow.timestamps.created);
  if (created > now) {
    violations.push({
      code: ViolationCode.CPT1_TEMPORAL_STALE,
      severity: Severity.WARN,
      message: 'Workflow creation timestamp is in the future',
      path: '/timestamps/created',
      evidence: {
        created: workflow.timestamps.created,
        current_time: now.toISOString(),
      },
      remediation: 'Correct the creation timestamp',
    });
  }

  return violations;
}

function checkConstraintConsistency(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  // Check for duplicate or contradictory constraints
  const constraints = workflow.constraints;
  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      if (constraints[i] === constraints[j]) {
        violations.push({
          code: ViolationCode.CPT1_GOAL_CONSTRAINT_CONFLICT,
          severity: Severity.WARN,
          message: 'Duplicate constraint detected',
          path: `/constraints/${j}`,
          evidence: {
            constraint: constraints[j],
            first_occurrence: i,
            duplicate_occurrence: j,
          },
          remediation: 'Remove duplicate constraint',
        });
      }
    }
  }

  return violations;
}

/**
 * Hash a definition for drift detection
 * Hash = SHA-256(term + meaning + locked + version)
 */
function hashDefinition(def: Definition): string {
  const canonical = JSON.stringify({
    term: def.term,
    meaning: def.meaning,
    locked: def.locked,
    version: def.version || 'v1',
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Extract potential term references from text
 * Looks for: Capitalized words, quoted text, underscored terms
 */
function extractPotentialTerms(text: string): string[] {
  const terms: string[] = [];

  // Quoted terms: "term"
  const quoted = text.match(/"([^"]+)"/g);
  if (quoted) {
    terms.push(...quoted.map((q) => q.replace(/"/g, '')));
  }

  // Capitalized words (excluding common words)
  const words = text.split(/\s+/);
  const excludeCommon = ['The', 'A', 'An', 'In', 'On', 'At', 'To', 'For', 'Of', 'With'];
  words.forEach((word) => {
    if (/^[A-Z][a-z]+/.test(word) && !excludeCommon.includes(word)) {
      terms.push(word);
    }
  });

  // Underscored terms: term_name
  const underscored = text.match(/\b[a-z_]+_[a-z_]+\b/g);
  if (underscored) {
    terms.push(...underscored);
  }

  return [...new Set(terms)]; // Deduplicate
}

function findSharedTerms(text1: string, text2: string): string[] {
  const words1 = text1.split(/\s+/).filter((w) => w.length > 3);
  const words2 = text2.split(/\s+/).filter((w) => w.length > 3);
  return words1.filter((w) => words2.includes(w));
}
