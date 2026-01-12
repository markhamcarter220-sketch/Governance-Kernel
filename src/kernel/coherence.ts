/**
 * Coherence validation logic (CPT-1)
 */

import { Workflow, Violation, ViolationCode, Severity } from './types';

export function validateCoherence(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  // Goal Invariant (GI): Check for goal-constraint conflicts
  violations.push(...checkGoalConstraintConflict(workflow));

  // Semantic Invariant (SI): Check for definition modifications
  violations.push(...checkSemanticDrift(workflow));

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

function findSharedTerms(text1: string, text2: string): string[] {
  const words1 = text1.split(/\s+/).filter((w) => w.length > 3);
  const words2 = text2.split(/\s+/).filter((w) => w.length > 3);
  return words1.filter((w) => words2.includes(w));
}
