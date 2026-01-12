/**
 * Schema validation tests
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { verifyWorkflow } from '../src/kernel/verify';
import { validateWorkflowStructure, getSchemaErrors } from '../src/kernel/schema-validator';
import { ViolationCode } from '../src/kernel/types';

test('Valid workflow passes schema validation', () => {
  const workflow = {
    version: '1.0',
    agents: [
      {
        name: 'test_agent',
        role: 'executor',
        allowed_actions: ['execute'],
      },
    ],
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [
        {
          granted_to: 'test_agent',
          scope: ['execute'],
          granted_by: 'human_root',
        },
      ],
    },
    operations: [
      {
        id: 'op1',
        type: 'execute',
        executor: 'test_agent',
        requires_approval: true,
        approved_by: 'admin@example.com',
      },
    ],
    constraints: ['Test constraint'],
    timestamps: {
      created: '2026-01-12T10:00:00Z',
    },
  };

  const violations = validateWorkflowStructure(workflow);
  assert.strictEqual(violations.length, 0, 'Valid workflow should have no schema violations');
});

test('Missing required field triggers schema violation', () => {
  const workflow = {
    version: '1.0',
    agents: [],
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [],
    },
    operations: [],
    // Missing 'constraints' field
    timestamps: {
      created: '2026-01-12T10:00:00Z',
    },
  };

  const violations = validateWorkflowStructure(workflow);
  assert.ok(violations.length > 0, 'Should detect missing required field');
  assert.strictEqual(
    violations[0].code,
    ViolationCode.SCHEMA_VALIDATION_ERROR,
    'Should be schema validation error'
  );
});

test('Invalid field type triggers schema violation', () => {
  const workflow = {
    version: '1.0',
    agents: 'not an array', // Should be array
    tools: [],
    authority_map: {
      root: 'human_root',
      delegations: [],
    },
    operations: [],
    constraints: [],
    timestamps: {
      created: '2026-01-12T10:00:00Z',
    },
  };

  const violations = validateWorkflowStructure(workflow);
  assert.ok(violations.length > 0, 'Should detect invalid field type');
  assert.strictEqual(
    violations[0].code,
    ViolationCode.SCHEMA_VALIDATION_ERROR,
    'Should be schema validation error'
  );
});

test('Schema validation runs before invariant checks', () => {
  const invalidWorkflow = {
    version: '1.0',
    // Missing many required fields
    agents: [],
  };

  const result = verifyWorkflow(invalidWorkflow as any);

  assert.strictEqual(result.valid, false, 'Should be invalid');
  assert.ok(
    result.violations.some((v) => v.code === ViolationCode.SCHEMA_VALIDATION_ERROR),
    'Should have schema validation errors'
  );
  assert.ok(
    result.summary.includes('Schema validation errors'),
    'Summary should mention schema errors'
  );
});

test('getSchemaErrors returns readable error messages', () => {
  const workflow = {
    version: '1.0',
    agents: [],
    // Missing required fields
  };

  const errors = getSchemaErrors(workflow);
  assert.ok(errors.length > 0, 'Should have error messages');
  assert.ok(typeof errors[0] === 'string', 'Errors should be strings');
});

test('Complex workflow with all fields validates', () => {
  const workflow = {
    version: '1.0',
    agents: [
      {
        name: 'agent',
        role: 'executor',
        allowed_actions: ['*'],
      },
    ],
    tools: [
      {
        name: 'deploy_tool',
        irreversible: true,
        requires_human_signoff: true,
      },
    ],
    data_sources: [
      {
        name: 'metrics_db',
        trust_level: 'high' as const,
      },
    ],
    definitions: [
      {
        term: 'success',
        meaning: 'System achieves goals',
        locked: true,
        version: 'v1',
      },
    ],
    authority_map: {
      root: 'human_root',
      delegations: [
        {
          granted_to: 'agent',
          scope: ['*'],
          granted_by: 'human_root',
          valid_until: '2027-01-01T00:00:00Z',
        },
      ],
    },
    operations: [
      {
        id: 'op1',
        type: 'execute',
        executor: 'agent',
        tool: 'deploy_tool',
        requires_approval: true,
        approved_by: 'admin@example.com',
        changes_state: true,
        modifies_definitions: false,
        is_decision: false,
      },
    ],
    constraints: ['Safety first'],
    optimization_goals: ['Maximize throughput'],
    timestamps: {
      created: '2026-01-12T10:00:00Z',
      valid_until: '2027-01-12T10:00:00Z',
    },
    unfreeze_token: 'test-token-123',
  };

  const violations = validateWorkflowStructure(workflow);
  assert.strictEqual(violations.length, 0, 'Complex workflow should pass schema validation');
});
