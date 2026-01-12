/**
 * Main workflow verification orchestrator
 */

import { Workflow, VerificationResult, Violation, Severity } from './types';
import { validateAuthority } from './authority';
import { validateOperationGating } from './classifier';
import { validateCoherence } from './coherence';
import { evaluateFreeze, checkSplitBrain } from './freeze';
import { validateWorkflowStructure } from './schema-validator';

export function verifyWorkflow(workflow: Workflow): VerificationResult {
  const violations: Violation[] = [];

  // FIRST: Validate JSON schema structure
  // If schema is invalid, structural checks may fail
  const schemaViolations = validateWorkflowStructure(workflow);
  violations.push(...schemaViolations);

  // If schema validation fails critically, short-circuit
  // (But still return results for debugging)
  if (schemaViolations.length > 0) {
    const summary = `Workflow validation FAILED: Schema validation errors (${schemaViolations.length} issue(s))`;
    return {
      valid: false,
      violations,
      summary,
    };
  }

  // Run all invariant validation checks
  violations.push(...validateAuthority(workflow));
  violations.push(...validateOperationGating(workflow));
  violations.push(...validateCoherence(workflow));
  violations.push(...checkSplitBrain(workflow));

  // CRITICAL: Sort violations to ensure FREEZE dominance
  // FREEZE violations are evaluated first and take precedence over FAIL
  const sortedViolations = violations.sort((a, b) => {
    if (a.severity === Severity.FREEZE && b.severity !== Severity.FREEZE) return -1;
    if (a.severity !== Severity.FREEZE && b.severity === Severity.FREEZE) return 1;
    if (a.severity === Severity.FAIL && b.severity === Severity.WARN) return -1;
    if (a.severity === Severity.WARN && b.severity === Severity.FAIL) return 1;
    return 0;
  });

  // Evaluate freeze state - this ALWAYS runs first
  const freezeState = evaluateFreeze(workflow, sortedViolations);

  // Determine overall validity
  // FREEZE DOMINATES: If frozen, workflow is invalid regardless of other violations
  const hasFreezeOrFail = sortedViolations.some(
    (v) => v.severity === Severity.FAIL || v.severity === Severity.FREEZE
  );
  const valid = !hasFreezeOrFail && (!freezeState || !freezeState.frozen);

  // Generate summary
  const summary = generateSummary(sortedViolations, freezeState);

  return {
    valid,
    violations: sortedViolations,
    freeze: freezeState,
    summary,
  };
}

function generateSummary(violations: Violation[], freezeState?: any): string {
  if (freezeState?.frozen) {
    return `Workflow FROZEN due to critical violations. ${freezeState.violations.length} freeze-level issue(s) detected.`;
  }

  const failCount = violations.filter((v) => v.severity === Severity.FAIL).length;
  const warnCount = violations.filter((v) => v.severity === Severity.WARN).length;

  if (failCount > 0) {
    return `Workflow validation FAILED with ${failCount} critical violation(s) and ${warnCount} warning(s).`;
  }

  if (warnCount > 0) {
    return `Workflow validation PASSED with ${warnCount} warning(s).`;
  }

  return 'Workflow validation PASSED. All invariants satisfied.';
}
