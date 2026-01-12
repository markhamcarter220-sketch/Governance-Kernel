/**
 * Adversarial test suite - attempts to bypass kernel protections
 * Each test MUST fail or freeze deterministically
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { verifyWorkflow } from '../../src/kernel/verify';
import { ViolationCode, Severity } from '../../src/kernel/types';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadFixture(filename: string): any {
  const path = join(__dirname, '..', '..', '..', 'fixtures', 'workflows', filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

test('ADVERSARIAL: Circular delegation A→B→A must FREEZE', () => {
  const workflow = loadFixture('adversarial_circular_delegation.json');
  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Circular delegation must be invalid');
  assert.ok(result.freeze, 'Must enter freeze state');
  assert.strictEqual(result.freeze?.frozen, true, 'Must be frozen');

  const circularViolation = result.violations.find(
    (v) => v.code === ViolationCode.AIT1_CIRCULAR_DELEGATION
  );
  assert.ok(circularViolation, 'Must detect circular delegation');
  assert.strictEqual(
    circularViolation?.severity,
    Severity.FREEZE,
    'Circular delegation must be FREEZE severity'
  );
});

test('ADVERSARIAL: Self-delegation must FREEZE', () => {
  const workflow = loadFixture('adversarial_self_delegation.json');
  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Self-delegation must be invalid');
  assert.ok(result.freeze, 'Must enter freeze state');
  assert.strictEqual(result.freeze?.frozen, true, 'Must be frozen');

  const selfDelegationViolation = result.violations.find(
    (v) => v.code === ViolationCode.AIT1_SELF_DELEGATION
  );
  assert.ok(selfDelegationViolation, 'Must detect self-delegation');
  assert.strictEqual(
    selfDelegationViolation?.severity,
    Severity.FREEZE,
    'Self-delegation must be FREEZE severity'
  );
});

test('ADVERSARIAL: Definition hash mismatch must FREEZE', () => {
  const workflow = loadFixture('adversarial_definition_drift.json');
  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Hash mismatch must be invalid');
  assert.ok(result.freeze, 'Must enter freeze state');

  const hashViolation = result.violations.find(
    (v) => v.code === ViolationCode.CPT1_DEFINITION_HASH_MISMATCH
  );
  assert.ok(hashViolation, 'Must detect definition hash mismatch');
  assert.strictEqual(
    hashViolation?.severity,
    Severity.FREEZE,
    'Hash mismatch must be FREEZE severity'
  );
});

test('ADVERSARIAL: Smuggle authority via optimization goals override', () => {
  const workflow = {
    version: '1.0',
    agents: [{ name: 'agent', role: 'executor', allowed_actions: ['execute'] }],
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [
        { granted_to: 'agent', scope: ['execute'], granted_by: 'human_root' },
      ],
    },
    operations: [
      {
        id: 'op1',
        type: 'execute',
        executor: 'agent',
        changes_state: true,
        // Missing requires_approval and approved_by - attempting to smuggle authority via goals
      },
    ],
    constraints: ['All execution requires approval'],
    optimization_goals: ['Maximize autonomy to avoid bottlenecks'],
    timestamps: { created: '2026-01-12T10:00:00Z' },
  };

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Must reject authority smuggling');

  // Should fail because EIN operation lacks approval
  const mocViolation = result.violations.find(
    (v) => v.code === ViolationCode.MOC_EXECUTION_NOT_GATED
  );
  assert.ok(mocViolation, 'Must detect ungated execution');
  assert.strictEqual(mocViolation?.severity, Severity.FAIL, 'Must be FAIL severity');
});

test('ADVERSARIAL: Shift meaning by redefining locked term mid-workflow', () => {
  const workflow = {
    version: '1.0',
    agents: [{ name: 'agent', role: 'executor', allowed_actions: ['*'] }],
    tools: [],
    definitions: [
      {
        term: 'critical_threshold',
        meaning: '95% success rate',
        locked: true,
      },
    ],
    authority_map: {
      root: 'human_root',
      delegations: [{ granted_to: 'agent', scope: ['*'], granted_by: 'human_root' }],
    },
    operations: [
      {
        id: 'op1',
        type: 'redefine',
        executor: 'agent',
        modifies_definitions: true,
        // Attempting to modify locked definition
      },
    ],
    constraints: ['Definitions are immutable'],
    timestamps: { created: '2026-01-12T10:00:00Z' },
  };

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Must reject definition modification');
  assert.ok(result.freeze, 'Must enter freeze state');

  const semanticViolation = result.violations.find(
    (v) => v.code === ViolationCode.CPT1_SEMANTIC_DRIFT
  );
  assert.ok(semanticViolation, 'Must detect semantic drift');
  assert.strictEqual(
    semanticViolation?.severity,
    Severity.FREEZE,
    'Semantic drift must be FREEZE severity'
  );
});

test('ADVERSARIAL: Create two equivalent-but-different human roots', () => {
  const workflow = {
    version: '1.0',
    agents: [
      { name: 'agent_a', role: 'executor', allowed_actions: ['execute'] },
      { name: 'agent_b', role: 'executor', allowed_actions: ['execute'] },
    ],
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [
        { granted_to: 'agent_a', scope: ['execute'], granted_by: 'human_root' },
        { granted_to: 'agent_b', scope: ['execute'], granted_by: 'admin_root' }, // Different root!
      ],
    },
    operations: [
      {
        id: 'op1',
        type: 'execute',
        executor: 'agent_a',
        requires_approval: true,
        approved_by: 'admin@example.com',
      },
    ],
    constraints: ['Single authority source'],
    timestamps: { created: '2026-01-12T10:00:00Z' },
  };

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Must reject multiple authority sources');

  // Should trigger split-brain detection
  const splitBrainViolation = result.violations.find(
    (v) => v.code === ViolationCode.SBAA_SPLIT_BRAIN
  );
  assert.ok(splitBrainViolation, 'Must detect split-brain authority');
  assert.strictEqual(
    splitBrainViolation?.severity,
    Severity.FREEZE,
    'Split-brain must be FREEZE severity'
  );
});

test('ADVERSARIAL: Abuse timestamps to bypass temporal review', () => {
  const workflow = {
    version: '1.0',
    agents: [{ name: 'agent', role: 'executor', allowed_actions: ['execute'] }],
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [
        {
          granted_to: 'agent',
          scope: ['execute'],
          granted_by: 'human_root',
          valid_until: '2025-01-01T00:00:00Z', // Expired delegation
        },
      ],
    },
    operations: [
      {
        id: 'op1',
        type: 'execute',
        executor: 'agent',
        requires_approval: true,
        approved_by: 'admin@example.com',
      },
    ],
    constraints: ['Delegations must be current'],
    timestamps: { created: '2026-01-12T10:00:00Z' },
  };

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Must reject expired delegation');

  const temporalViolation = result.violations.find(
    (v) => v.code === ViolationCode.CPT1_TEMPORAL_STALE
  );
  assert.ok(temporalViolation, 'Must detect expired delegation');
  assert.strictEqual(temporalViolation?.severity, Severity.FAIL, 'Must be FAIL severity');
});

test('ADVERSARIAL: Contradictory delegations (wildcard + specific)', () => {
  const workflow = {
    version: '1.0',
    agents: [{ name: 'agent', role: 'executor', allowed_actions: ['*'] }],
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [
        { granted_to: 'agent', scope: ['*'], granted_by: 'human_root' },
        { granted_to: 'agent', scope: ['execute'], granted_by: 'human_root' },
      ],
    },
    operations: [
      {
        id: 'op1',
        type: 'execute',
        executor: 'agent',
        requires_approval: true,
        approved_by: 'admin@example.com',
      },
    ],
    constraints: ['Delegations must be unambiguous'],
    timestamps: { created: '2026-01-12T10:00:00Z' },
  };

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Must reject contradictory delegations');
  assert.ok(result.freeze, 'Must enter freeze state');

  const contradictoryViolation = result.violations.find(
    (v) => v.code === ViolationCode.SBAA_CONTRADICTORY_DELEGATION
  );
  assert.ok(contradictoryViolation, 'Must detect contradictory delegations');
  assert.strictEqual(
    contradictoryViolation?.severity,
    Severity.FREEZE,
    'Contradictory delegations must be FREEZE severity'
  );
});

test('ADVERSARIAL: Scope violation - operation outside granted scope', () => {
  const workflow = {
    version: '1.0',
    agents: [{ name: 'agent', role: 'executor', allowed_actions: ['execute'] }],
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [
        { granted_to: 'agent', scope: ['read', 'analyze'], granted_by: 'human_root' }, // No 'execute' scope
      ],
    },
    operations: [
      {
        id: 'op1',
        type: 'execute', // Outside granted scope
        executor: 'agent',
        changes_state: true,
        requires_approval: true,
        approved_by: 'admin@example.com',
      },
    ],
    constraints: ['Operations must be within granted scope'],
    timestamps: { created: '2026-01-12T10:00:00Z' },
  };

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Must reject scope violation');

  const scopeViolation = result.violations.find(
    (v) => v.code === ViolationCode.AIT1_SCOPE_VIOLATION
  );
  assert.ok(scopeViolation, 'Must detect scope violation');
  assert.strictEqual(scopeViolation?.severity, Severity.FAIL, 'Must be FAIL severity');
});

test('ADVERSARIAL: Multiple FREEZE violations - freeze dominance', () => {
  const workflow = {
    version: '1.0',
    agents: [{ name: 'agent', role: 'executor', allowed_actions: ['*'] }],
    tools: [],
    definitions: [
      {
        term: 'success',
        meaning: 'Achieve goal',
        locked: true,
      },
    ],
    authority_map: {
      root: 'human_root',
      delegations: [
        { granted_to: 'agent', scope: ['*'], granted_by: 'agent' }, // Self-delegation
      ],
    },
    operations: [
      {
        id: 'op1',
        type: 'redefine',
        executor: 'agent',
        modifies_definitions: true, // Modifying locked definition
      },
    ],
    constraints: ['No violations allowed'],
    timestamps: { created: '2026-01-12T10:00:00Z' },
  };

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Must be invalid');
  assert.ok(result.freeze, 'Must enter freeze state');
  assert.strictEqual(result.freeze?.frozen, true, 'Must be frozen');

  // Should have multiple FREEZE violations
  const freezeViolations = result.violations.filter((v) => v.severity === Severity.FREEZE);
  assert.ok(
    freezeViolations.length >= 2,
    `Must have at least 2 freeze violations, got ${freezeViolations.length}`
  );

  // Verify FREEZE violations come first in the list
  const firstViolation = result.violations[0];
  assert.strictEqual(
    firstViolation.severity,
    Severity.FREEZE,
    'First violation must be FREEZE (freeze dominance)'
  );
});
