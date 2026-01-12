/**
 * CLI verify command
 */

import { readFileSync } from 'fs';
import { verifyWorkflow } from '../../kernel/verify';
import { formatVerificationReport } from '../../kernel/report';
import { Workflow, Severity } from '../../kernel/types';

export function verifyCommand(filePath: string, options: { json?: boolean } = {}): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const workflow: Workflow = JSON.parse(content);

    const result = verifyWorkflow(workflow);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatVerificationReport(result));
    }

    // Exit codes: 0 = pass, 2 = violations, 3 = freeze
    if (result.freeze?.frozen) {
      return 3;
    }
    if (!result.valid) {
      return 2;
    }
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error occurred');
    }
    return 1;
  }
}
