#!/usr/bin/env node

/**
 * Governance Kernel CLI
 */

import { verifyCommand } from './commands/verify';
import { scanCommand } from './commands/scan';
import { explainCommand } from './commands/explain';

function printHelp() {
  console.log(`
Governance Kernel - Authority Firewall for AI/agent workflows

Usage:
  gk <command> [options]

Commands:
  verify <file>              Verify a workflow JSON file
    --json                   Output results as JSON

  scan <file>                Scan an artifact (policy, prompt, etc.)
    --type <type>            Artifact type (policy, prompt, doc)
    --json                   Output results as JSON

  explain [code]             Explain a violation code or list all codes

  help                       Show this help message

Exit Codes:
  0 - Success/Pass
  1 - Error (file not found, parse error, etc.)
  2 - Violations found
  3 - Freeze state (critical violations)

Examples:
  gk verify fixtures/workflows/pass_minimal.json
  gk scan fixtures/docs/sample_policy.md --type policy
  gk explain AIT1_IMPLICIT_AUTHORITY
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const restArgs = args.slice(1);

  try {
    let exitCode = 0;

    switch (command) {
      case 'verify': {
        const filePath = restArgs[0];
        if (!filePath) {
          console.error('Error: Missing file path');
          console.log('Usage: gk verify <file> [--json]');
          process.exit(1);
        }
        const json = restArgs.includes('--json');
        exitCode = verifyCommand(filePath, { json });
        break;
      }

      case 'scan': {
        const filePath = restArgs[0];
        if (!filePath) {
          console.error('Error: Missing file path');
          console.log('Usage: gk scan <file> [--type <type>] [--json]');
          process.exit(1);
        }
        const typeIndex = restArgs.indexOf('--type');
        const type = typeIndex !== -1 ? restArgs[typeIndex + 1] : undefined;
        const json = restArgs.includes('--json');
        exitCode = scanCommand(filePath, { type, json });
        break;
      }

      case 'explain': {
        const code = restArgs[0];
        exitCode = explainCommand(code);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "gk help" for usage information');
        process.exit(1);
    }

    process.exit(exitCode);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Fatal error: ${error.message}`);
    } else {
      console.error('Unknown fatal error');
    }
    process.exit(1);
  }
}

main();
