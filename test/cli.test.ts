/**
 * CLI tests
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import { join } from 'path';

const CLI_PATH = join(__dirname, '..', 'src', 'cli', 'main.js');

function runCLI(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
    };
  }
}

test('gk help should display help message', () => {
  const result = runCLI(['help']);

  assert.strictEqual(result.exitCode, 0);
  assert.ok(result.stdout.includes('Governance Kernel'), 'Should show governance kernel title');
  assert.ok(result.stdout.includes('Commands:'), 'Should list commands');
});

test('gk verify pass_minimal.json should exit with 0', () => {
  const fixturePath = join(__dirname, '..', '..', 'fixtures', 'workflows', 'pass_minimal.json');
  const result = runCLI(['verify', fixturePath]);

  assert.strictEqual(result.exitCode, 0, 'Should exit with 0 for passing workflow');
  assert.ok(result.stdout.includes('PASS'), 'Should show PASS status');
});

test('gk verify fail_authority_leak.json should exit with 2', () => {
  const fixturePath = join(__dirname, '..', '..', 'fixtures', 'workflows', 'fail_authority_leak.json');
  const result = runCLI(['verify', fixturePath]);

  assert.strictEqual(result.exitCode, 2, 'Should exit with 2 for failing workflow');
  assert.ok(result.stdout.includes('FAIL'), 'Should show FAIL status');
  assert.ok(result.stdout.includes('MOC'), 'Should mention MOC violations');
});

test('gk verify fail_split_brain.json should exit with 3 (freeze)', () => {
  const fixturePath = join(__dirname, '..', '..', 'fixtures', 'workflows', 'fail_split_brain.json');
  const result = runCLI(['verify', fixturePath]);

  assert.strictEqual(result.exitCode, 3, 'Should exit with 3 for frozen workflow');
  assert.ok(result.stdout.includes('FROZEN'), 'Should show FROZEN status');
  assert.ok(result.stdout.includes('SBAA'), 'Should mention SBAA violation');
});

test('gk scan sample_policy.md should exit with 0', () => {
  const fixturePath = join(__dirname, '..', '..', 'fixtures', 'docs', 'sample_policy.md');
  const result = runCLI(['scan', fixturePath, '--type', 'policy']);

  assert.strictEqual(result.exitCode, 0, 'Should exit with 0 for clean artifact');
  assert.ok(result.stdout.includes('CLEAN'), 'Should show CLEAN status');
});

test('gk scan sample_agent_prompt.txt should exit with 2', () => {
  const fixturePath = join(__dirname, '..', '..', 'fixtures', 'docs', 'sample_agent_prompt.txt');
  const result = runCLI(['scan', fixturePath, '--type', 'prompt']);

  assert.strictEqual(result.exitCode, 2, 'Should exit with 2 for violations');
  assert.ok(result.stdout.includes('VIOLATIONS'), 'Should show violations');
});

test('gk explain should list all codes', () => {
  const result = runCLI(['explain']);

  assert.strictEqual(result.exitCode, 0);
  assert.ok(result.stdout.includes('AIT1'), 'Should list AIT1 codes');
  assert.ok(result.stdout.includes('MOC'), 'Should list MOC codes');
  assert.ok(result.stdout.includes('SBAA'), 'Should list SBAA code');
});

test('gk explain AIT1_IMPLICIT_AUTHORITY should show explanation', () => {
  const result = runCLI(['explain', 'AIT1_IMPLICIT_AUTHORITY']);

  assert.strictEqual(result.exitCode, 0);
  assert.ok(result.stdout.includes('AIT-1'), 'Should show AIT-1 explanation');
  assert.ok(result.stdout.includes('authority'), 'Should mention authority');
});

test('gk verify --json should output JSON', () => {
  const fixturePath = join(__dirname, '..', '..', 'fixtures', 'workflows', 'pass_minimal.json');
  const result = runCLI(['verify', fixturePath, '--json']);

  assert.strictEqual(result.exitCode, 0);
  assert.doesNotThrow(() => {
    const json = JSON.parse(result.stdout);
    assert.ok(json.valid !== undefined, 'Should have valid field');
    assert.ok(Array.isArray(json.violations), 'Should have violations array');
  }, 'Output should be valid JSON');
});
