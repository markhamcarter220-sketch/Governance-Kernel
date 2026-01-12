/**
 * Kernel verification tests
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { verifyWorkflow } from '../src/kernel/verify';
import { Workflow, ViolationCode } from '../src/kernel/types';

function loadFixture(name: string): Workflow {
  const path = join(__dirname, '..', '..', 'fixtures', 'workflows', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

test('pass_minimal workflow should pass validation', () => {
  const workflow = loadFixture('pass_minimal');
  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, true, 'Workflow should be valid');
  assert.strictEqual(result.violations.length, 0, 'Should have no violations');
  assert.strictEqual(result.freeze, undefined, 'Should not be frozen');
});

test('fail_authority_leak workflow should fail with MOC violations', () => {
  const workflow = loadFixture('fail_authority_leak');
  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Workflow should be invalid');
  assert.ok(result.violations.length > 0, 'Should have violations');

  // Should have MOC violations for ungated decision and execution
  const mocViolations = result.violations.filter(
    (v) =>
      v.code === ViolationCode.MOC_DECISION_NOT_GATED ||
      v.code === ViolationCode.MOC_EXECUTION_NOT_GATED
  );
  assert.ok(mocViolations.length > 0, 'Should have MOC gating violations');
});

test('fail_split_brain workflow should freeze with SBAA violation', () => {
  const workflow = loadFixture('fail_split_brain');
  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Workflow should be invalid');

  // Should have split-brain violation
  const sbaaViolations = result.violations.filter(
    (v) => v.code === ViolationCode.SBAA_SPLIT_BRAIN
  );
  assert.ok(sbaaViolations.length > 0, 'Should have SBAA split-brain violation');

  // Should trigger freeze
  assert.ok(result.freeze, 'Should have freeze state');
  if (result.freeze) {
    assert.strictEqual(result.freeze.frozen, true, 'Should be frozen');
  }
});

test('fail_meaning_decoherence workflow should freeze with CPT1 violations', () => {
  const workflow = loadFixture('fail_meaning_decoherence');
  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false, 'Workflow should be invalid');

  // Should have semantic drift violation (locked definition being modified)
  const semanticViolations = result.violations.filter(
    (v) => v.code === ViolationCode.CPT1_SEMANTIC_DRIFT
  );
  assert.ok(semanticViolations.length > 0, 'Should have semantic drift violation');

  // Should have goal-constraint conflict (minimize vs maximize)
  const conflictViolations = result.violations.filter(
    (v) => v.code === ViolationCode.CPT1_GOAL_CONSTRAINT_CONFLICT
  );
  assert.ok(conflictViolations.length > 0, 'Should have goal-constraint conflict');

  // Should trigger freeze
  assert.ok(result.freeze, 'Should have freeze state');
  if (result.freeze) {
    assert.strictEqual(result.freeze.frozen, true, 'Should be frozen');
  }
});

test('workflow with missing delegation path should fail with AIT1 violation', () => {
  const workflow: Workflow = {
    version: '1.0',
    agents: [{ name: 'agent1', role: 'worker', allowed_actions: ['work'] }],
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [],
    },
    operations: [{ id: 'op1', type: 'work', executor: 'agent1' }],
    constraints: [],
    timestamps: { created: new Date().toISOString() },
  };

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false);
  const aitViolations = result.violations.filter(
    (v) => v.code === ViolationCode.AIT1_MISSING_DELEGATION_PATH
  );
  assert.ok(aitViolations.length > 0, 'Should have missing delegation path violation');
});

test('workflow with requires_approval but no approved_by should fail', () => {
  const workflow: Workflow = {
    version: '1.0',
    agents: [{ name: 'agent1', role: 'worker', allowed_actions: ['work'] }],
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [
        { granted_to: 'agent1', scope: ['*'], granted_by: 'human_root' },
      ],
    },
    operations: [
      {
        id: 'op1',
        type: 'execute',
        executor: 'agent1',
        requires_approval: true,
        changes_state: true,
      },
    ],
    constraints: [],
    timestamps: { created: new Date().toISOString() },
  };

  const result = verifyWorkflow(workflow);

  assert.strictEqual(result.valid, false);
  const implicitAuthViolations = result.violations.filter(
    (v) => v.code === ViolationCode.AIT1_IMPLICIT_AUTHORITY
  );
  assert.ok(implicitAuthViolations.length > 0, 'Should have implicit authority violation');
});

test('workflow with unfreeze_token should not be frozen', () => {
  const workflow = loadFixture('fail_split_brain');
  workflow.unfreeze_token = 'human-reviewed-and-approved-xyz';

  const result = verifyWorkflow(workflow);

  // Still has violations but not frozen due to token
  assert.ok(result.violations.length > 0, 'Should still have violations');
  if (result.freeze) {
    assert.strictEqual(result.freeze.frozen, false, 'Should not be frozen with token');
  }
});
