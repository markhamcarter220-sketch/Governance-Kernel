/**
 * JSON Schema validation using AJV
 * Validates workflow and report structures at runtime
 */

import Ajv from 'ajv';
import { Workflow, VerificationResult, ViolationCode, Severity, Violation } from './types';
import workflowSchema from '../../schemas/workflow.schema.json';
import reportSchema from '../../schemas/report.schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });

// Compile schemas once at module load
const validateWorkflowSchema = ajv.compile(workflowSchema);
const validateReportSchema = ajv.compile(reportSchema);

/**
 * Validate workflow against JSON schema
 * Returns violations if schema validation fails
 */
export function validateWorkflowStructure(workflow: any): Violation[] {
  const valid = validateWorkflowSchema(workflow);

  if (valid) {
    return [];
  }

  const violations: Violation[] = [];

  if (validateWorkflowSchema.errors) {
    validateWorkflowSchema.errors.forEach((error, index) => {
      violations.push({
        code: ViolationCode.SCHEMA_VALIDATION_ERROR,
        severity: Severity.FAIL,
        message: `Schema validation failed: ${error.message || 'Unknown error'}`,
        path: error.instancePath || '/unknown',
        evidence: {
          keyword: error.keyword,
          params: error.params,
          schemaPath: error.schemaPath,
          data: error.data,
        },
        remediation: `Fix schema violation at ${error.instancePath || 'root'}: ${error.message}`,
      });
    });
  }

  return violations;
}

/**
 * Validate verification result against JSON schema
 * Used for testing and API responses
 */
export function validateReportStructure(report: any): boolean {
  return validateReportSchema(report);
}

/**
 * Get detailed schema errors for debugging
 */
export function getSchemaErrors(workflow: any): string[] {
  validateWorkflowSchema(workflow);

  if (!validateWorkflowSchema.errors) {
    return [];
  }

  return validateWorkflowSchema.errors.map(
    (error) =>
      `${error.instancePath || '/'}: ${error.message} (${error.keyword})`
  );
}
