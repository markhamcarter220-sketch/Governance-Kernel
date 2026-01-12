/**
 * Main workflow verification orchestrator
 */

import { Workflow, VerificationResult, Violation, Severity } from './types';
import { validateAuthority } from './authority';
import { validateOperationGating } from './classifier';
import { validateCoherence } from './coherence';
import { evaluateFreeze, checkSplitBrain } from './freeze';

export function verifyWorkflow(workflow: Workflow): VerificationResult {
  const violations: Violation[] = [];

  // Run all validation checks
  violations.push(...validateAuthority(workflow));
  violations.push(...validateOperationGating(workflow));
  violations.push(...validateCoherence(workflow));
  violations.push(...checkSplitBrain(workflow));

  // Evaluate freeze state
  const freezeState = evaluateFreeze(workflow, violations);

  // Determine overall validity
  const hasFailures = violations.some(
    (v) => v.severity === Severity.FAIL || v.severity === Severity.FREEZE
  );
  const valid = !hasFailures && (!freezeState || !freezeState.frozen);

  // Generate summary
  const summary = generateSummary(violations, freezeState);

  return {
    valid,
    violations,
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
