/**
 * Authority validation logic (AIT-1)
 */

import {
  Workflow,
  Operation,
  AuthorityGrant,
  Violation,
  ViolationCode,
  Severity,
} from './types';

export function validateAuthority(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  // Check 1: Authority root must be human_root or a specific human
  if (!workflow.authority_map.root || workflow.authority_map.root.trim() === '') {
    violations.push({
      code: ViolationCode.AIT1_IMPLICIT_AUTHORITY,
      severity: Severity.FAIL,
      message: 'Authority root is missing or empty',
      path: '/authority_map/root',
      evidence: { root: workflow.authority_map.root },
      remediation: 'Set authority_map.root to "human_root" or a specific human identifier',
    });
  }

  // Check 2: All operations must have valid delegation path
  const delegationMap = buildDelegationMap(workflow.authority_map.delegations);

  workflow.operations.forEach((op, index) => {
    if (!hasValidDelegation(op.executor, delegationMap, workflow.authority_map.root)) {
      violations.push({
        code: ViolationCode.AIT1_MISSING_DELEGATION_PATH,
        severity: Severity.FAIL,
        message: `Operation executor "${op.executor}" has no valid delegation path from authority root`,
        path: `/operations/${index}/executor`,
        evidence: {
          executor: op.executor,
          operation_id: op.id,
          available_delegations: workflow.authority_map.delegations.map((d) => d.granted_to),
        },
        remediation: `Add a delegation in authority_map.delegations granting authority to "${op.executor}"`,
      });
    }

    // Check 3: Operations with requires_approval must have approved_by
    if (op.requires_approval && !op.approved_by) {
      violations.push({
        code: ViolationCode.AIT1_IMPLICIT_AUTHORITY,
        severity: Severity.FAIL,
        message: `Operation "${op.id}" requires approval but has no approved_by field`,
        path: `/operations/${index}/approved_by`,
        evidence: {
          operation_id: op.id,
          requires_approval: true,
          approved_by: op.approved_by,
        },
        remediation: `Set approved_by to a human identifier for operation "${op.id}"`,
      });
    }
  });

  // Check 4: Validate temporal bounds on delegations
  const now = new Date();
  workflow.authority_map.delegations.forEach((delegation, index) => {
    if (delegation.valid_until) {
      const validUntil = new Date(delegation.valid_until);
      if (validUntil < now) {
        violations.push({
          code: ViolationCode.CPT1_TEMPORAL_STALE,
          severity: Severity.FAIL,
          message: `Delegation to "${delegation.granted_to}" has expired`,
          path: `/authority_map/delegations/${index}/valid_until`,
          evidence: {
            granted_to: delegation.granted_to,
            valid_until: delegation.valid_until,
            current_time: now.toISOString(),
          },
          remediation: 'Update valid_until to a future timestamp or remove expired delegations',
        });
      }
    }
  });

  return violations;
}

function buildDelegationMap(
  delegations: AuthorityGrant[]
): Map<string, AuthorityGrant[]> {
  const map = new Map<string, AuthorityGrant[]>();
  for (const delegation of delegations) {
    const existing = map.get(delegation.granted_to) || [];
    existing.push(delegation);
    map.set(delegation.granted_to, existing);
  }
  return map;
}

function hasValidDelegation(
  executor: string,
  delegationMap: Map<string, AuthorityGrant[]>,
  root: string
): boolean {
  // If executor is the root itself, it's valid
  if (executor === root) {
    return true;
  }

  // Check if there's a delegation to this executor
  const grants = delegationMap.get(executor);
  if (!grants || grants.length === 0) {
    return false;
  }

  // Check if any grant is from human_root or a valid authority
  return grants.some((grant) => {
    return grant.granted_by === root || grant.granted_by === 'human_root';
  });
}
