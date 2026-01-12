/**
 * Governance Kernel - Public API
 * Authority Firewall for AI/agent workflows
 */

// Export types
export * from './kernel/types';

// Export core functions
export { verifyWorkflow } from './kernel/verify';
export { scanArtifact } from './kernel/scan';
export { classifyOperation } from './kernel/classifier';
export { explainViolation, INVARIANT_RULES } from './kernel/invariants';
export { formatVerificationReport, formatScanReport } from './kernel/report';
export { validateWorkflowStructure, validateReportStructure, getSchemaErrors } from './kernel/schema-validator';
export { buildAuthorityTraces } from './kernel/authority';

// Re-export for convenience
import { verifyWorkflow } from './kernel/verify';
import { scanArtifact } from './kernel/scan';
import { classifyOperation } from './kernel/classifier';
import { explainViolation } from './kernel/invariants';
import { formatVerificationReport, formatScanReport } from './kernel/report';
import { validateWorkflowStructure } from './kernel/schema-validator';
import { buildAuthorityTraces } from './kernel/authority';

export default {
  verifyWorkflow,
  scanArtifact,
  classifyOperation,
  explainViolation,
  formatReport: formatVerificationReport,
  formatScanReport,
  validateWorkflowStructure,
  buildAuthorityTraces,
};
