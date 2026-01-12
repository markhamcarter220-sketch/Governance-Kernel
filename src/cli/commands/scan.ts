/**
 * CLI scan command
 */

import { readFileSync } from 'fs';
import { scanArtifact } from '../../kernel/scan';
import { formatScanReport } from '../../kernel/report';

export function scanCommand(
  filePath: string,
  options: { type?: string; json?: boolean } = {}
): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const artifactType = options.type || 'unknown';

    const result = scanArtifact(content, artifactType);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatScanReport(result));
    }

    // Exit codes: 0 = clean, 2 = violations found
    return result.clean ? 0 : 2;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error occurred');
    }
    return 1;
  }
}
