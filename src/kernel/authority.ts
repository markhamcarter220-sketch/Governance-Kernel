/**
 * Authority validation logic (AIT-1) - HARDENED
 * Explicit authority-flow tracing with circular delegation detection
 */

import {
  Workflow,
  Operation,
  AuthorityGrant,
  Violation,
  ViolationCode,
  Severity,
  AuthorityTrace,
  AuthorityTraceNode,
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
    return violations; // Fatal - cannot proceed with other checks
  }

  // Check 2: Detect self-delegations (FREEZE)
  violations.push(...detectSelfDelegations(workflow));

  // Check 3: Detect circular delegations (FREEZE)
  violations.push(...detectCircularDelegations(workflow));

  // Check 4: Detect orphan delegations (entities granting without authority)
  violations.push(...detectOrphanDelegations(workflow));

  // Check 5: Build authority traces for all operations
  const traces = buildAuthorityTraces(workflow);

  workflow.operations.forEach((op, index) => {
    const trace = traces.find((t) => t.operation_id === op.id);

    if (!trace || !trace.valid) {
      violations.push({
        code: ViolationCode.AIT1_MISSING_DELEGATION_PATH,
        severity: Severity.FAIL,
        message: `Operation executor "${op.executor}" has no valid authority path from root`,
        path: `/operations/${index}/executor`,
        evidence: {
          executor: op.executor,
          operation_id: op.id,
          authority_trace: trace?.path || [],
          failure_reason: trace?.failure_reason,
        },
        remediation: `Add valid delegation chain from root to "${op.executor}"`,
      });
    }

    // Check 6: Validate scope coverage
    if (trace && trace.valid) {
      const scopeViolation = validateOperationScope(op, trace, workflow);
      if (scopeViolation) {
        violations.push(scopeViolation);
      }
    }

    // Check 7: Operations with requires_approval must have approved_by
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

  // Check 8: Validate temporal bounds on delegations
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

/**
 * Detect self-delegations (entity delegating to itself) - FREEZE
 */
function detectSelfDelegations(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  workflow.authority_map.delegations.forEach((delegation, index) => {
    if (delegation.granted_to === delegation.granted_by) {
      violations.push({
        code: ViolationCode.AIT1_SELF_DELEGATION,
        severity: Severity.FREEZE,
        message: `Self-delegation detected: "${delegation.granted_to}" delegates to itself`,
        path: `/authority_map/delegations/${index}`,
        evidence: {
          entity: delegation.granted_to,
          granted_by: delegation.granted_by,
        },
        remediation: 'Remove self-delegation. Authority cannot be self-granted.',
      });
    }
  });

  return violations;
}

/**
 * Detect circular delegations (A→B→A) - FREEZE
 */
function detectCircularDelegations(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];
  const delegationGraph = buildDelegationGraph(workflow.authority_map.delegations);

  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(entity: string, path: string[]): boolean {
    visited.add(entity);
    recursionStack.add(entity);
    path.push(entity);

    const delegates = delegationGraph.get(entity) || [];
    for (const delegate of delegates) {
      if (!visited.has(delegate.granted_to)) {
        if (hasCycle(delegate.granted_to, [...path])) {
          return true;
        }
      } else if (recursionStack.has(delegate.granted_to)) {
        // Cycle detected
        const cycleStart = path.indexOf(delegate.granted_to);
        const cycle = [...path.slice(cycleStart), delegate.granted_to];
        violations.push({
          code: ViolationCode.AIT1_CIRCULAR_DELEGATION,
          severity: Severity.FREEZE,
          message: `Circular delegation detected: ${cycle.join(' → ')}`,
          path: '/authority_map/delegations',
          evidence: {
            cycle,
            entities_involved: cycle,
          },
          remediation: 'Break the circular delegation chain. Authority paths must be acyclic.',
        });
        return true;
      }
    }

    recursionStack.delete(entity);
    return false;
  }

  // Check from all possible starting points
  const allEntities = new Set<string>();
  workflow.authority_map.delegations.forEach((d) => {
    allEntities.add(d.granted_by);
    allEntities.add(d.granted_to);
  });

  allEntities.forEach((entity) => {
    if (!visited.has(entity)) {
      hasCycle(entity, []);
    }
  });

  return violations;
}

/**
 * Detect orphan delegations (granted by non-existent authority)
 */
function detectOrphanDelegations(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];
  const root = workflow.authority_map.root;

  // Build set of entities with authority (root + all grantees)
  const authorizedEntities = new Set<string>([root, 'human_root']);
  workflow.authority_map.delegations.forEach((d) => {
    if (d.granted_by === root || d.granted_by === 'human_root') {
      authorizedEntities.add(d.granted_to);
    }
  });

  // Multi-pass to handle transitive delegations
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    workflow.authority_map.delegations.forEach((d) => {
      if (authorizedEntities.has(d.granted_by) && !authorizedEntities.has(d.granted_to)) {
        authorizedEntities.add(d.granted_to);
        changed = true;
      }
    });
  }

  // Check for delegations granted by unauthorized entities
  workflow.authority_map.delegations.forEach((delegation, index) => {
    if (!authorizedEntities.has(delegation.granted_by)) {
      violations.push({
        code: ViolationCode.AIT1_ORPHAN_DELEGATION,
        severity: Severity.FAIL,
        message: `Delegation granted by "${delegation.granted_by}" who has no authority`,
        path: `/authority_map/delegations/${index}/granted_by`,
        evidence: {
          granted_by: delegation.granted_by,
          granted_to: delegation.granted_to,
          authorized_entities: Array.from(authorizedEntities),
        },
        remediation: `Ensure "${delegation.granted_by}" has a delegation from root before granting to others`,
      });
    }
  });

  return violations;
}

/**
 * Build explicit authority traces for all operations
 */
export function buildAuthorityTraces(workflow: Workflow): AuthorityTrace[] {
  const traces: AuthorityTrace[] = [];
  const delegationGraph = buildDelegationGraph(workflow.authority_map.delegations);

  workflow.operations.forEach((op) => {
    const trace = buildTraceForExecutor(
      op.executor,
      workflow.authority_map.root,
      delegationGraph,
      []
    );
    traces.push({
      operation_id: op.id,
      executor: op.executor,
      path: trace.path,
      valid: trace.valid,
      failure_reason: trace.failure_reason,
    });
  });

  return traces;
}

function buildTraceForExecutor(
  executor: string,
  root: string,
  delegationGraph: Map<string, AuthorityGrant[]>,
  visited: string[]
): { path: AuthorityTraceNode[]; valid: boolean; failure_reason?: string } {
  // If executor is root, valid with empty path
  if (executor === root || executor === 'human_root') {
    return {
      path: [{ entity: root, scope: ['*'] }],
      valid: true,
    };
  }

  // Check for cycle
  if (visited.includes(executor)) {
    return {
      path: [],
      valid: false,
      failure_reason: `Circular delegation involving "${executor}"`,
    };
  }

  // Find delegations TO this executor
  const grants: AuthorityGrant[] = [];
  delegationGraph.forEach((delegations) => {
    delegations.forEach((d) => {
      if (d.granted_to === executor) {
        grants.push(d);
      }
    });
  });

  if (grants.length === 0) {
    return {
      path: [],
      valid: false,
      failure_reason: `No delegation found for "${executor}"`,
    };
  }

  // Try to find a valid path through any grant
  for (const grant of grants) {
    const parentTrace = buildTraceForExecutor(
      grant.granted_by,
      root,
      delegationGraph,
      [...visited, executor]
    );

    if (parentTrace.valid) {
      return {
        path: [
          ...parentTrace.path,
          {
            entity: executor,
            granted_by: grant.granted_by,
            scope: grant.scope,
            valid_until: grant.valid_until,
          },
        ],
        valid: true,
      };
    }
  }

  return {
    path: [],
    valid: false,
    failure_reason: `No valid authority path from root to "${executor}"`,
  };
}

function buildDelegationGraph(
  delegations: AuthorityGrant[]
): Map<string, AuthorityGrant[]> {
  const graph = new Map<string, AuthorityGrant[]>();
  for (const delegation of delegations) {
    const existing = graph.get(delegation.granted_by) || [];
    existing.push(delegation);
    graph.set(delegation.granted_by, existing);
  }
  return graph;
}

/**
 * Validate that operation type is within granted scope
 */
function validateOperationScope(
  operation: Operation,
  trace: AuthorityTrace,
  workflow: Workflow
): Violation | null {
  // Find the executor node in the trace
  const executorNode = trace.path.find((node) => node.entity === operation.executor);
  if (!executorNode) {
    return null; // Already handled by missing delegation path
  }

  // Wildcard scope allows everything
  if (executorNode.scope.includes('*')) {
    return null;
  }

  // Check if operation type is in scope
  if (!executorNode.scope.includes(operation.type)) {
    return {
      code: ViolationCode.AIT1_SCOPE_VIOLATION,
      severity: Severity.FAIL,
      message: `Operation type "${operation.type}" not in granted scope for "${operation.executor}"`,
      path: `/operations/${workflow.operations.indexOf(operation)}/type`,
      evidence: {
        operation_id: operation.id,
        operation_type: operation.type,
        granted_scope: executorNode.scope,
        executor: operation.executor,
      },
      remediation: `Add "${operation.type}" to delegation scope for "${operation.executor}" or use wildcard "*"`,
    };
  }

  return null;
}
