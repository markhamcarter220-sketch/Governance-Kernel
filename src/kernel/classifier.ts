/**
 * Operation classifier (MOC - MAP Operation Classifier)
 */

import {
  Operation,
  OperationType,
  Classification,
  Workflow,
  Violation,
  ViolationCode,
  Severity,
} from './types';

export function classifyOperation(operation: Operation, workflow: Workflow): Classification {
  let type: OperationType;
  let reason: string;
  let requires_gating = false;

  // Rule 1: If changes_state or uses irreversible tool -> EIN
  const tool = operation.tool ? workflow.tools.find((t) => t.name === operation.tool) : null;
  if (operation.changes_state || (tool && tool.irreversible)) {
    type = OperationType.EIN;
    reason = operation.changes_state
      ? 'Operation changes external state'
      : 'Operation uses irreversible tool';
    requires_gating = true;
  }
  // Rule 2: If modifies_definitions or is_decision -> DEC
  else if (operation.modifies_definitions || operation.is_decision) {
    type = OperationType.DEC;
    reason = operation.modifies_definitions
      ? 'Operation modifies definitions or authority'
      : 'Operation makes a decision with value judgment';
    requires_gating = true;
  }
  // Rule 3: If type suggests interpretation -> INT
  else if (
    operation.type === 'verify' ||
    operation.type === 'analyze' ||
    operation.type === 'interpret'
  ) {
    type = OperationType.INT;
    reason = 'Operation interprets or analyzes data';
    requires_gating = false;
  }
  // Rule 4: Default -> SUP (support/info)
  else {
    type = OperationType.SUP;
    reason = 'Operation provides information or support';
    requires_gating = false;
  }

  return {
    operation_id: operation.id,
    type,
    reason,
    requires_gating,
  };
}

export function validateOperationGating(workflow: Workflow): Violation[] {
  const violations: Violation[] = [];

  workflow.operations.forEach((op, index) => {
    const classification = classifyOperation(op, workflow);

    // DEC operations must be gated
    if (classification.type === OperationType.DEC) {
      if (!op.requires_approval || !op.approved_by) {
        violations.push({
          code: ViolationCode.MOC_DECISION_NOT_GATED,
          severity: Severity.FAIL,
          message: `Decision operation "${op.id}" is not properly gated by human approval`,
          path: `/operations/${index}`,
          evidence: {
            operation_id: op.id,
            classification: classification.type,
            requires_approval: op.requires_approval,
            approved_by: op.approved_by,
          },
          remediation: `Set requires_approval=true and provide approved_by field for operation "${op.id}"`,
        });
      }
    }

    // EIN operations must be gated
    if (classification.type === OperationType.EIN) {
      if (!op.requires_approval || !op.approved_by) {
        violations.push({
          code: ViolationCode.MOC_EXECUTION_NOT_GATED,
          severity: Severity.FAIL,
          message: `Execution operation "${op.id}" with irreversible effects is not gated by human approval`,
          path: `/operations/${index}`,
          evidence: {
            operation_id: op.id,
            classification: classification.type,
            changes_state: op.changes_state,
            tool: op.tool,
            requires_approval: op.requires_approval,
            approved_by: op.approved_by,
          },
          remediation: `Set requires_approval=true and provide approved_by field for operation "${op.id}"`,
        });
      }
    }

    // Check if tool requires human signoff
    if (op.tool) {
      const tool = workflow.tools.find((t) => t.name === op.tool);
      if (tool && tool.requires_human_signoff && !op.approved_by) {
        violations.push({
          code: ViolationCode.OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF,
          severity: Severity.FAIL,
          message: `Operation "${op.id}" uses tool "${tool.name}" which requires human signoff`,
          path: `/operations/${index}/approved_by`,
          evidence: {
            operation_id: op.id,
            tool: tool.name,
            approved_by: op.approved_by,
          },
          remediation: `Provide approved_by field for operation "${op.id}"`,
        });
      }
    }
  });

  return violations;
}
