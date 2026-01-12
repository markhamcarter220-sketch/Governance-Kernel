/**
 * Report formatting utilities
 */

import { VerificationResult, ScanResult, Violation, Severity } from './types';
import { explainViolation } from './invariants';

export function formatVerificationReport(result: VerificationResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('GOVERNANCE KERNEL VERIFICATION REPORT');
  lines.push('='.repeat(60));
  lines.push('');

  if (result.freeze?.frozen) {
    lines.push('⚠️  SYSTEM FROZEN ⚠️');
    lines.push('');
    lines.push(`Reason: ${result.freeze.reason}`);
    lines.push('');
    lines.push('Freeze-level violations must be resolved before execution.');
    lines.push('Provide an unfreeze_token after human review to proceed.');
    lines.push('');
  }

  lines.push(`Status: ${result.valid ? '✓ PASS' : '✗ FAIL'}`);
  lines.push(`Summary: ${result.summary}`);
  lines.push(`Total Violations: ${result.violations.length}`);
  lines.push('');

  if (result.violations.length > 0) {
    const bySeverity = groupBySeverity(result.violations);

    if (bySeverity[Severity.FREEZE]?.length > 0) {
      lines.push(`FREEZE: ${bySeverity[Severity.FREEZE].length}`);
    }
    if (bySeverity[Severity.FAIL]?.length > 0) {
      lines.push(`FAIL: ${bySeverity[Severity.FAIL].length}`);
    }
    if (bySeverity[Severity.WARN]?.length > 0) {
      lines.push(`WARN: ${bySeverity[Severity.WARN].length}`);
    }
    lines.push('');

    lines.push('-'.repeat(60));
    lines.push('VIOLATIONS');
    lines.push('-'.repeat(60));
    lines.push('');

    result.violations.forEach((violation, index) => {
      lines.push(`[${index + 1}] ${violation.severity.toUpperCase()}: ${violation.code}`);
      lines.push(`    Message: ${violation.message}`);
      lines.push(`    Path: ${violation.path}`);
      lines.push(`    Remediation: ${violation.remediation}`);
      if (Object.keys(violation.evidence).length > 0) {
        lines.push(`    Evidence: ${JSON.stringify(violation.evidence, null, 2).replace(/\n/g, '\n    ')}`);
      }
      lines.push('');
    });
  }

  lines.push('='.repeat(60));
  return lines.join('\n');
}

export function formatScanReport(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('Ω-SCAN ARTIFACT REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Artifact Type: ${result.artifact_type}`);
  lines.push(`Status: ${result.clean ? '✓ CLEAN' : '✗ VIOLATIONS FOUND'}`);
  lines.push(`Summary: ${result.summary}`);
  lines.push('');

  if (result.violations.length > 0) {
    lines.push('-'.repeat(60));
    lines.push('VIOLATIONS');
    lines.push('-'.repeat(60));
    lines.push('');

    result.violations.forEach((violation, index) => {
      lines.push(`[${index + 1}] ${violation.severity.toUpperCase()}: ${violation.code}`);
      lines.push(`    Message: ${violation.message}`);
      lines.push(`    Location: ${violation.path}`);
      lines.push(`    Remediation: ${violation.remediation}`);
      if (Object.keys(violation.evidence).length > 0) {
        lines.push(`    Evidence: ${JSON.stringify(violation.evidence, null, 2).replace(/\n/g, '\n    ')}`);
      }
      lines.push('');
    });
  }

  lines.push('='.repeat(60));
  return lines.join('\n');
}

function groupBySeverity(violations: Violation[]): Record<Severity, Violation[]> {
  const groups: Record<Severity, Violation[]> = {
    [Severity.FREEZE]: [],
    [Severity.FAIL]: [],
    [Severity.WARN]: [],
  };

  violations.forEach((v) => {
    groups[v.severity].push(v);
  });

  return groups;
}
