/**
 * Freeze state management (SBAA)
 */

import { Workflow, Violation, FreezeState, ViolationCode, Severity } from './types';

export function evaluateFreeze(
  workflow: Workflow,
  allViolations: Violation[]
): FreezeState | undefined {
  // Check for freeze-level violations
  const freezeViolations = allViolations.filter((v) => v.severity === Severity.FREEZE);

  if (freezeViolations.length === 0) {
    return undefined;
  }

  // If unfreeze token is present and system is already aware of freeze, allow continuation
  // (In a real system, this would verify the token cryptographically)
  if (workflow.unfreeze_token) {
    // Token present means human has acknowledged and authorized proceeding despite freeze
    // For this implementation, we still return freeze state but mark it as acknowledged
    return {
      frozen: false, // Unfrozen by token
      reason: 'Freeze acknowledged by unfreeze_token',
      violations: freezeViolations,
    };
  }

  const reasons = freezeViolations.map((v) => `${v.code}: ${v.message}`).join('; ');

  return {
    frozen: true,
    reason: reasons,
    violations: freezeViolations,
  };
}

export function checkSplitBrain(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  // Check 1: Multiple roots
  // This is implicit in our structure (only one root field)
  // But check for conflicting delegations

  const delegationsByGrantor = new Map<string, number>();
  workflow.authority_map.delegations.forEach((delegation) => {
    const count = delegationsByGrantor.get(delegation.granted_by) || 0;
    delegationsByGrantor.set(delegation.granted_by, count + 1);
  });

  // Check if there are multiple "root-like" grantors
  const rootGrantors = Array.from(delegationsByGrantor.keys()).filter(
    (grantor) => grantor !== workflow.authority_map.root && grantor !== 'human_root'
  );

  if (rootGrantors.length > 0) {
    violations.push({
      code: ViolationCode.SBAA_SPLIT_BRAIN,
      severity: Severity.FREEZE,
      message:
        'Multiple authority sources detected: delegations granted by entities other than the declared root',
      path: '/authority_map/delegations',
      evidence: {
        declared_root: workflow.authority_map.root,
        other_grantors: rootGrantors,
      },
      remediation:
        'Ensure all delegations are granted by the declared root or human_root. Remove delegations from other sources.',
    });
  }

  // Check 2: Conflicting delegations for same executor
  const executorDelegations = new Map<string, string[]>();
  workflow.authority_map.delegations.forEach((delegation) => {
    const scopes = executorDelegations.get(delegation.granted_to) || [];
    scopes.push(...delegation.scope);
    executorDelegations.set(delegation.granted_to, scopes);
  });

  executorDelegations.forEach((scopes, executor) => {
    if (scopes.includes('*') && scopes.length > 1) {
      violations.push({
        code: ViolationCode.SBAA_SPLIT_BRAIN,
        severity: Severity.FREEZE,
        message: `Executor "${executor}" has conflicting delegations: wildcard (*) and specific scopes`,
        path: '/authority_map/delegations',
        evidence: {
          executor,
          scopes,
        },
        remediation: `Remove conflicting delegations for executor "${executor}"`,
      });
    }
  });

  return violations;
}
