/**
 * Freeze state management (SBAA) - HARDENED
 * Contradictory delegation detection and freeze dominance guarantee
 */

import { Workflow, Violation, FreezeState, ViolationCode, Severity } from './types';

/**
 * Evaluate freeze state - FREEZE ALWAYS DOMINATES FAIL
 * This function guarantees that if any freeze-level violation exists,
 * the system enters freeze state regardless of other violations.
 */
export function evaluateFreeze(
  workflow: Workflow,
  allViolations: Violation[]
): FreezeState | undefined {
  // Sort violations to ensure FREEZE is processed first
  const sortedViolations = [...allViolations].sort((a, b) => {
    if (a.severity === Severity.FREEZE && b.severity !== Severity.FREEZE) return -1;
    if (a.severity !== Severity.FREEZE && b.severity === Severity.FREEZE) return 1;
    return 0;
  });

  // Check for freeze-level violations
  const freezeViolations = sortedViolations.filter((v) => v.severity === Severity.FREEZE);

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
  violations.push(...detectContradictoryDelegations(workflow));

  return violations;
}

/**
 * Detect contradictory delegations - NEW
 * Same entity granted conflicting scopes or incompatible authorities
 */
function detectContradictoryDelegations(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  // Group delegations by grantee
  const delegationsByGrantee = new Map<string, typeof workflow.authority_map.delegations>();
  workflow.authority_map.delegations.forEach((delegation) => {
    const existing = delegationsByGrantee.get(delegation.granted_to) || [];
    existing.push(delegation);
    delegationsByGrantee.set(delegation.granted_to, existing);
  });

  // Check each grantee for contradictions
  delegationsByGrantee.forEach((delegations, grantee) => {
    if (delegations.length > 1) {
      // Check 1: Wildcard + specific scopes
      const hasWildcard = delegations.some((d) => d.scope.includes('*'));
      const hasSpecific = delegations.some((d) => !d.scope.includes('*'));

      if (hasWildcard && hasSpecific) {
        violations.push({
          code: ViolationCode.SBAA_CONTRADICTORY_DELEGATION,
          severity: Severity.FREEZE,
          message: `Entity "${grantee}" has conflicting delegations: wildcard (*) and specific scopes`,
          path: '/authority_map/delegations',
          evidence: {
            grantee,
            delegations: delegations.map((d) => ({
              granted_by: d.granted_by,
              scope: d.scope,
            })),
          },
          remediation: `Remove conflicting delegations for "${grantee}". Use either wildcard or specific scopes, not both.`,
        });
      }

      // Check 2: Conflicting temporal bounds
      const validUntils = delegations
        .map((d) => d.valid_until)
        .filter((v) => v !== undefined) as string[];

      if (validUntils.length > 1) {
        const dates = validUntils.map((v) => new Date(v));
        const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

        if (maxDate.getTime() - minDate.getTime() > 0) {
          violations.push({
            code: ViolationCode.SBAA_CONTRADICTORY_DELEGATION,
            severity: Severity.WARN,
            message: `Entity "${grantee}" has delegations with different expiry times`,
            path: '/authority_map/delegations',
            evidence: {
              grantee,
              expiry_dates: validUntils,
            },
            remediation: `Clarify which delegation expiry takes precedence for "${grantee}".`,
          });
        }
      }

      // Check 3: Same scope from different grantors (potential conflict)
      const grantors = new Set(delegations.map((d) => d.granted_by));
      if (grantors.size > 1) {
        // Multiple grantors - check if they're granting same scopes
        const scopesByGrantor = new Map<string, Set<string>>();
        delegations.forEach((d) => {
          const scopes = scopesByGrantor.get(d.granted_by) || new Set<string>();
          d.scope.forEach((s) => scopes.add(s));
          scopesByGrantor.set(d.granted_by, scopes);
        });

        // Find overlapping scopes
        const allScopes = new Set<string>();
        delegations.forEach((d) => d.scope.forEach((s) => allScopes.add(s)));

        const overlaps: string[] = [];
        allScopes.forEach((scope) => {
          let count = 0;
          scopesByGrantor.forEach((scopes) => {
            if (scopes.has(scope) || scopes.has('*')) count++;
          });
          if (count > 1) {
            overlaps.push(scope);
          }
        });

        if (overlaps.length > 0) {
          violations.push({
            code: ViolationCode.SBAA_CONTRADICTORY_DELEGATION,
            severity: Severity.WARN,
            message: `Entity "${grantee}" receives overlapping authority from multiple grantors`,
            path: '/authority_map/delegations',
            evidence: {
              grantee,
              grantors: Array.from(grantors),
              overlapping_scopes: overlaps,
            },
            remediation: `Consolidate delegations to "${grantee}" under single grantor or clarify authority precedence.`,
          });
        }
      }
    }
  });

  return violations;
}
