/**
 * Artifact scanning logic (Ω-SCAN)
 */

import { ScanResult, Violation, ViolationCode, Severity } from './types';

const IMPLICIT_AUTHORITY_PATTERNS = [
  /\b(AI|model|agent|system)\s+(decides?|approves?|determines?|authorizes?)\b/gi,
  /\b(automatically|autonomously)\s+(approve|decide|authorize|execute)\b/gi,
  /\bwithout\s+human\s+(approval|oversight|review)\b/gi,
  /\b(model|AI|agent)\s+has\s+(authority|permission)\s+to\b/gi,
  /\b(self|auto)[-\s]?(approve|authorize)\b/gi,
];

const IRREVERSIBLE_ACTION_PATTERNS = [
  /\b(delete|remove|drop|destroy|terminate|kill)\b/gi,
  /\b(deploy|publish|release|ship)\b.*\bproduction\b/gi,
  /\b(transfer|send|pay|charge|bill)\b.*\b(money|funds|payment)\b/gi,
  /\b(irreversible|permanent|cannot\s+be\s+undone)\b/gi,
];

const DECISION_KEYWORDS = [
  'decide',
  'choose',
  'select',
  'determine',
  'pick',
  'prioritize',
  'approve',
  'reject',
];

export function scanArtifact(text: string, artifactType: string): ScanResult {
  const violations: Violation[] = [];

  // Scan 1: Check for implicit authority claims
  violations.push(...scanImplicitAuthority(text));

  // Scan 2: Check for irreversible actions without signoff
  violations.push(...scanIrreversibleWithoutSignoff(text));

  // Scan 3: Check for undefined terms in decision context
  violations.push(...scanUndefinedTerms(text));

  const summary =
    violations.length === 0
      ? `Artifact (${artifactType}) passed Ω-SCAN validation`
      : `Artifact (${artifactType}) has ${violations.length} violation(s)`;

  return {
    artifact_type: artifactType,
    violations,
    clean: violations.length === 0,
    summary,
  };
}

function scanImplicitAuthority(text: string): Violation[] {
  const violations: Violation[] = [];
  const lines = text.split('\n');

  IMPLICIT_AUTHORITY_PATTERNS.forEach((pattern) => {
    lines.forEach((line, lineNum) => {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        violations.push({
          code: ViolationCode.OMEGA_IMPLICIT_AUTHORITY_IN_TEXT,
          severity: Severity.FAIL,
          message: 'Artifact contains implicit authority claim',
          path: `line:${lineNum + 1}`,
          evidence: {
            line_number: lineNum + 1,
            matched_text: match[0],
            context: line.trim(),
          },
          remediation:
            'Replace implicit authority with explicit human delegation or approval requirement',
        });
      }
    });
  });

  return violations;
}

function scanIrreversibleWithoutSignoff(text: string): Violation[] {
  const violations: Violation[] = [];
  const lines = text.split('\n');

  // Look for irreversible actions
  const irreversibleLines: Array<{ lineNum: number; line: string; match: string }> = [];
  IRREVERSIBLE_ACTION_PATTERNS.forEach((pattern) => {
    lines.forEach((line, lineNum) => {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        irreversibleLines.push({ lineNum, line, match: match[0] });
      }
    });
  });

  // Check if these lines mention human signoff
  irreversibleLines.forEach(({ lineNum, line, match }) => {
    const contextStart = Math.max(0, lineNum - 2);
    const contextEnd = Math.min(lines.length, lineNum + 3);
    const context = lines.slice(contextStart, contextEnd).join(' ');

    const hasSignoff =
      /\b(human|manual|require[sd]?\s+approval|signoff|authorize[sd]?\s+by)\b/i.test(context);

    if (!hasSignoff) {
      violations.push({
        code: ViolationCode.OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF,
        severity: Severity.FAIL,
        message: 'Irreversible action mentioned without human signoff requirement',
        path: `line:${lineNum + 1}`,
        evidence: {
          line_number: lineNum + 1,
          matched_action: match,
          context: line.trim(),
        },
        remediation: 'Add explicit human signoff requirement for irreversible action',
      });
    }
  });

  return violations;
}

function scanUndefinedTerms(text: string): Violation[] {
  const violations: Violation[] = [];
  const lines = text.split('\n');

  // Look for decision-making context
  const decisionLines: Array<{ lineNum: number; line: string }> = [];
  lines.forEach((line, lineNum) => {
    const lowerLine = line.toLowerCase();
    if (DECISION_KEYWORDS.some((keyword) => lowerLine.includes(keyword))) {
      decisionLines.push({ lineNum, line });
    }
  });

  // Check if document has a definitions section
  const hasDefinitions =
    /\b(definitions?|glossary|terms?)\b/gi.test(text) ||
    text.includes('define:') ||
    text.includes('means:');

  if (!hasDefinitions && decisionLines.length > 0) {
    // Look for capitalized terms or quoted terms that might be undefined
    decisionLines.forEach(({ lineNum, line }) => {
      const capitalizedTerms = line.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
      const quotedTerms = line.match(/"([^"]+)"/g) || [];

      if (capitalizedTerms.length > 2 || quotedTerms.length > 0) {
        violations.push({
          code: ViolationCode.OMEGA_UNDEFINED_TERM_USED_IN_DECISION,
          severity: Severity.WARN,
          message: 'Decision context uses potentially undefined terms without definitions section',
          path: `line:${lineNum + 1}`,
          evidence: {
            line_number: lineNum + 1,
            context: line.trim(),
            potential_undefined_terms: [...capitalizedTerms, ...quotedTerms].slice(0, 5),
          },
          remediation: 'Add a definitions section or clarify terms used in decision-making',
        });
      }
    });
  }

  return violations;
}
