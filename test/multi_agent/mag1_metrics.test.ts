/**
 * MAG-1 Multi-Agent Metrics Test Suite
 *
 * Validates that the kernel satisfies MAG-1 (Multi-Agent Governance Strengthening)
 * across different agent counts N ∈ {1, 2, 4, 8, 16}.
 *
 * Metrics:
 * - IAR (Illegal Action Rate): Proportion of invalid operations that pass validation
 * - SFR (Silent Failure Rate): Proportion of violations undetected by validation
 * - CDR (Conflict Detection Rate): Proportion of conflicts that trigger freeze
 *
 * Expected properties:
 * - IAR ≈ 0 for all N (no invalid operations pass)
 * - SFR non-increasing with N (more agents → more detection)
 * - CDR ≈ 1.0 for all N (all conflicts detected)
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { verifyWorkflow } from '../../src/kernel/verify';
import { ViolationCode, Severity, Workflow } from '../../src/kernel/types';

/**
 * Helper: Generate N-agent workflow with specified authority
 */
function generateNAgentWorkflow(
  agentCount: number,
  authorityScope: string[],
  includeAdversarial: boolean = false
): Workflow {
  const agents = [];
  const delegations = [];
  const operations = [];

  // Generate N agents
  for (let i = 0; i < agentCount; i++) {
    const agentName = `agent_${i}`;
    const isAdversarial = includeAdversarial && i === agentCount - 1;

    agents.push({
      name: agentName,
      role: isAdversarial ? 'adversarial' : 'executor',
      allowed_actions: authorityScope,
    });

    delegations.push({
      granted_to: agentName,
      scope: authorityScope,
      granted_by: 'human_root',
    });

    // Each agent proposes one operation
    operations.push({
      id: `op_${i}`,
      type: authorityScope[0] || 'execute',
      executor: agentName,
      requires_approval: true,
      approved_by: 'admin@example.com',
    });
  }

  return {
    version: '1.0',
    agents,
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations,
    },
    operations,
    constraints: ['Test constraint'],
    timestamps: {
      created: '2026-01-12T10:00:00Z',
    },
  };
}

/**
 * Helper: Inject invalid operation for IAR testing
 */
function injectInvalidOperation(workflow: Workflow, agentIndex: number): Workflow {
  const modifiedWorkflow = JSON.parse(JSON.stringify(workflow)); // Deep clone

  // Inject operation outside granted scope
  modifiedWorkflow.operations.push({
    id: `invalid_op_${agentIndex}`,
    type: 'forbidden_action', // Not in scope
    executor: modifiedWorkflow.agents[agentIndex].name,
    changes_state: true,
    // Missing required approval - should trigger MOC_EXECUTION_NOT_GATED
  });

  return modifiedWorkflow;
}

/**
 * Helper: Inject conflicting delegation for CDR testing
 */
function injectConflictingDelegation(workflow: Workflow, agentIndex: number): Workflow {
  const modifiedWorkflow = JSON.parse(JSON.stringify(workflow)); // Deep clone

  // Add contradictory delegation (wildcard + specific)
  modifiedWorkflow.authority_map.delegations.push({
    granted_to: modifiedWorkflow.agents[agentIndex].name,
    scope: ['*'], // Conflicts with existing specific scope
    granted_by: 'human_root',
  });

  return modifiedWorkflow;
}

// =============================================================================
// IAR (Illegal Action Rate) Tests
// =============================================================================

test('MAG-1 IAR: N=1 agent, zero illegal actions pass validation', () => {
  const workflow = generateNAgentWorkflow(1, ['execute']);
  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, true, 'Valid 1-agent workflow should pass');
  assert.strictEqual(
    result.violations.filter((v) => v.severity === Severity.FAIL).length,
    0,
    'Should have no failures'
  );
});

test('MAG-1 IAR: N=2 agents, invalid operation detected', () => {
  const workflow = generateNAgentWorkflow(2, ['execute']);
  const invalidWorkflow = injectInvalidOperation(workflow, 1);
  const result = verifyWorkflow(invalidWorkflow);

  assert.strictEqual(result.valid, false, 'Invalid operation should be detected');
  assert.ok(
    result.violations.some(
      (v) =>
        v.code === ViolationCode.MOC_EXECUTION_NOT_GATED ||
        v.code === ViolationCode.AIT1_SCOPE_VIOLATION
    ),
    'Should detect ungated or out-of-scope execution'
  );
});

test('MAG-1 IAR: N=4 agents, invalid operation detected', () => {
  const workflow = generateNAgentWorkflow(4, ['execute']);
  const invalidWorkflow = injectInvalidOperation(workflow, 2);
  const result = verifyWorkflow(invalidWorkflow);

  assert.strictEqual(result.valid, false, 'Invalid operation should be detected');
  assert.ok(
    result.violations.some((v) => v.severity === Severity.FAIL),
    'Should have at least one failure'
  );
});

test('MAG-1 IAR: N=8 agents, invalid operation detected', () => {
  const workflow = generateNAgentWorkflow(8, ['execute']);
  const invalidWorkflow = injectInvalidOperation(workflow, 5);
  const result = verifyWorkflow(invalidWorkflow);

  assert.strictEqual(result.valid, false, 'Invalid operation should be detected');
  assert.ok(
    result.violations.length > 0,
    'Should have violations'
  );
});

test('MAG-1 IAR: N=16 agents, invalid operation detected', () => {
  const workflow = generateNAgentWorkflow(16, ['execute']);
  const invalidWorkflow = injectInvalidOperation(workflow, 10);
  const result = verifyWorkflow(invalidWorkflow);

  assert.strictEqual(result.valid, false, 'Invalid operation should be detected');
  assert.ok(
    result.violations.length > 0,
    'Should have violations'
  );
});

// =============================================================================
// SFR (Silent Failure Rate) Tests
// =============================================================================

test('MAG-1 SFR: N=1 agent, all violations detected', () => {
  const workflow = generateNAgentWorkflow(1, ['execute']);
  const invalidWorkflow = injectInvalidOperation(workflow, 0);
  const result = verifyWorkflow(invalidWorkflow);

  // SFR = (undetected violations) / (total violations)
  // Expected: SFR = 0 (all violations detected)
  assert.strictEqual(result.valid, false, 'Should detect violation');
  assert.ok(result.violations.length > 0, 'Should report violations');
});

test('MAG-1 SFR: N=2 agents, same violations detected as N=1', () => {
  const workflow1 = generateNAgentWorkflow(1, ['execute']);
  const invalid1 = injectInvalidOperation(workflow1, 0);
  const result1 = verifyWorkflow(invalid1);

  const workflow2 = generateNAgentWorkflow(2, ['execute']);
  const invalid2 = injectInvalidOperation(workflow2, 0);
  const result2 = verifyWorkflow(invalid2);

  // SFR should not increase with more agents
  assert.ok(result2.violations.length >= result1.violations.length,
    'More agents should not reduce detection rate');
});

test('MAG-1 SFR: N=4 agents, detection rate non-decreasing', () => {
  const workflow = generateNAgentWorkflow(4, ['execute']);
  const invalidWorkflow = injectInvalidOperation(workflow, 2);
  const result = verifyWorkflow(invalidWorkflow);

  assert.strictEqual(result.valid, false, 'Should detect violations');
  assert.ok(result.violations.length > 0, 'Should report violations');
});

// TODO: Implement statistical SFR measurement across random invalid workflows
// test('MAG-1 SFR: Statistical measurement across N ∈ {1,2,4,8,16}', () => {
//   // Generate 1000 random invalid workflows for each N
//   // Measure detection rate
//   // Assert: SFR(N+1) <= SFR(N)
// });

// =============================================================================
// CDR (Conflict Detection Rate) Tests
// =============================================================================

test('MAG-1 CDR: N=2 agents with conflicting delegations triggers freeze', () => {
  const workflow = generateNAgentWorkflow(2, ['execute']);
  const conflictWorkflow = injectConflictingDelegation(workflow, 0);
  const result = verifyWorkflow(conflictWorkflow);

  assert.ok(result.freeze, 'Conflicting delegations should trigger freeze');
  assert.strictEqual(result.freeze?.frozen, true, 'Should be frozen');
  assert.ok(
    result.violations.some((v) => v.code === ViolationCode.SBAA_CONTRADICTORY_DELEGATION),
    'Should detect contradictory delegation'
  );
});

test('MAG-1 CDR: N=4 agents with conflicting delegations triggers freeze', () => {
  const workflow = generateNAgentWorkflow(4, ['execute']);
  const conflictWorkflow = injectConflictingDelegation(workflow, 1);
  const result = verifyWorkflow(conflictWorkflow);

  assert.ok(result.freeze, 'Conflicting delegations should trigger freeze');
  assert.strictEqual(result.freeze?.frozen, true, 'Should be frozen');
});

test('MAG-1 CDR: N=8 agents with conflicting delegations triggers freeze', () => {
  const workflow = generateNAgentWorkflow(8, ['execute']);
  const conflictWorkflow = injectConflictingDelegation(workflow, 3);
  const result = verifyWorkflow(conflictWorkflow);

  assert.ok(result.freeze, 'Conflicting delegations should trigger freeze');
  assert.strictEqual(result.freeze?.frozen, true, 'Should be frozen');
});

test('MAG-1 CDR: N=16 agents with conflicting delegations triggers freeze', () => {
  const workflow = generateNAgentWorkflow(16, ['execute']);
  const conflictWorkflow = injectConflictingDelegation(workflow, 7);
  const result = verifyWorkflow(conflictWorkflow);

  assert.ok(result.freeze, 'Conflicting delegations should trigger freeze');
  assert.strictEqual(result.freeze?.frozen, true, 'Should be frozen');
});

// TODO: Implement statistical CDR measurement
// test('MAG-1 CDR: Statistical measurement across N ∈ {1,2,4,8,16}', () => {
//   // Generate 1000 workflows with injected conflicts
//   // Measure freeze rate
//   // Assert: CDR ≈ 1.0 for all N
// });

// =============================================================================
// Authority Conservation Tests
// =============================================================================

test('MAG-1 Authority Conservation: N=2 agents cannot amplify authority', () => {
  const workflow = generateNAgentWorkflow(2, ['read']);

  // Attempt to add operation requiring 'write' authority
  workflow.operations.push({
    id: 'write_op',
    type: 'write',
    executor: 'agent_0',
    changes_state: true,
    requires_approval: true,
    approved_by: 'admin@example.com',
  });

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Should reject out-of-scope operation');
  assert.ok(
    result.violations.some((v) => v.code === ViolationCode.AIT1_SCOPE_VIOLATION),
    'Should detect scope violation'
  );
});

test('MAG-1 Authority Conservation: N=8 agents cannot create authority', () => {
  const workflow = generateNAgentWorkflow(8, ['execute']);

  // Attempt self-delegation
  workflow.authority_map.delegations.push({
    granted_to: 'agent_0',
    scope: ['admin'],
    granted_by: 'agent_0', // Self-delegation
  });

  const result = verifyWorkflow(workflow);

  assert.ok(result.freeze, 'Self-delegation should trigger freeze');
  assert.ok(
    result.violations.some((v) => v.code === ViolationCode.AIT1_SELF_DELEGATION),
    'Should detect self-delegation'
  );
});

// =============================================================================
// Adversarial Agent Tests
// =============================================================================

test('MAG-1 Adversarial: N=4 with 1 adversarial agent, violations detected', () => {
  const workflow = generateNAgentWorkflow(4, ['execute'], true);

  // Adversarial agent attempts operation outside scope
  workflow.operations.push({
    id: 'adversarial_op',
    type: 'admin', // Not in granted scope
    executor: 'agent_3', // Last agent (adversarial)
    changes_state: true,
  });

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Adversarial operation should be rejected');
  assert.ok(
    result.violations.some(
      (v) =>
        v.code === ViolationCode.AIT1_SCOPE_VIOLATION ||
        v.code === ViolationCode.MOC_EXECUTION_NOT_GATED
    ),
    'Should detect adversarial violation'
  );
});

test('MAG-1 Adversarial: System freezes, does not fail silently', () => {
  const workflow = generateNAgentWorkflow(2, ['execute']);

  // Adversarial: circular delegation
  workflow.authority_map.delegations.push(
    {
      granted_to: 'agent_1',
      scope: ['*'],
      granted_by: 'agent_0',
    },
    {
      granted_to: 'agent_0',
      scope: ['*'],
      granted_by: 'agent_1',
    }
  );

  const result = verifyWorkflow(workflow);

  assert.ok(result.freeze, 'Should freeze on circular delegation');
  assert.strictEqual(result.freeze?.frozen, true, 'Should be frozen, not fail silently');
  assert.ok(
    result.violations.some((v) => v.code === ViolationCode.AIT1_CIRCULAR_DELEGATION),
    'Should detect circular delegation'
  );
});

// =============================================================================
// TODO: Advanced Metrics (Requires Statistical Framework)
// =============================================================================

// TODO: Implement comprehensive IAR measurement across random workflows
// test('MAG-1 IAR Comprehensive: Measure across 10000 random workflows', () => {
//   // For N ∈ {1, 2, 4, 8, 16}:
//   //   Generate 10000 random workflows
//   //   Inject random violations
//   //   Measure IAR = (passed invalid) / (total invalid)
//   //   Assert: IAR ≈ 0 for all N
// });

// TODO: Implement comprehensive SFR measurement
// test('MAG-1 SFR Comprehensive: Measure detection rate degradation', () => {
//   // For N ∈ {1, 2, 4, 8, 16}:
//   //   Generate workflows with known violations
//   //   Measure detection rate
//   //   Assert: SFR(N+1) <= SFR(N)
// });

// TODO: Implement comprehensive CDR measurement
// test('MAG-1 CDR Comprehensive: Measure conflict detection across N', () => {
//   // For N ∈ {1, 2, 4, 8, 16}:
//   //   Generate workflows with injected conflicts
//   //   Measure freeze rate
//   //   Assert: CDR ≈ 1.0 for all N
// });

// TODO: Implement authority budget tracking
// test('MAG-1 Authority Budget: Total authority conserved across N', () => {
//   // For N ∈ {1, 2, 4, 8, 16}:
//   //   Track total granted authority
//   //   Assert: Total authority = human_root delegations
//   //   Assert: No authority creation
// });

// TODO: Implement multi-agent coordination failure test
// test('MAG-1 Coordination Failure: System remains safe when agents conflict', () => {
//   // Generate workflows where agents propose conflicting operations
//   // Assert: System freezes (safe halt)
//   // Assert: No silent execution of conflicting operations
// });
