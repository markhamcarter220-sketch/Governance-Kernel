/**
 * CLI explain command
 */

import { ViolationCode } from '../../kernel/types';
import { explainViolation, INVARIANT_RULES } from '../../kernel/invariants';

export function explainCommand(code?: string): number {
  if (!code) {
    console.log('Usage: gk explain <VIOLATION_CODE>');
    console.log('\nAvailable violation codes:');
    Object.values(ViolationCode).forEach((c) => {
      console.log(`  - ${c}`);
    });
    console.log('\nInvariant rules:');
    Object.entries(INVARIANT_RULES).forEach(([key, rule]) => {
      console.log(`  ${key}: ${rule.name}`);
      console.log(`    ${rule.description}`);
    });
    return 0;
  }

  const upperCode = code.toUpperCase() as ViolationCode;
  if (Object.values(ViolationCode).includes(upperCode)) {
    console.log(`${upperCode}:`);
    console.log(explainViolation(upperCode));
    return 0;
  } else {
    console.error(`Unknown violation code: ${code}`);
    console.log('\nAvailable codes:');
    Object.values(ViolationCode).forEach((c) => {
      console.log(`  - ${c}`);
    });
    return 1;
  }
}
