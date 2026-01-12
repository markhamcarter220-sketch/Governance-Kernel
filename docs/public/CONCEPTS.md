# Core Concepts

## Workflow

A **workflow** is a structured JSON object that describes:

- **Agents**: Named entities that can perform actions (with explicit roles and allowed actions)
- **Tools**: Capabilities available to agents (marked as irreversible or requiring signoff)
- **Data Sources**: External sources of information (with trust levels)
- **Definitions**: Locked definitions for terms used in decision-making
- **Authority Map**: Explicit delegation structure from human root
- **Operations**: Sequence of steps (propose, verify, approve, execute)
- **Constraints**: Hard invariants that must never be violated
- **Optimization Goals**: Soft goals (subordinate to constraints)
- **Timestamps**: Time context for validity

## Authority

**Authority** is the right to execute an operation. Key properties:

- **Explicit**: Must be declared, never assumed
- **Conserved**: Flows from human root through delegations
- **Typed**: Scoped to specific operations or wildcards
- **Temporal**: Can be time-bounded
- **Non-transferable**: Delegations don't create new authority sources

### Authority Path

Every operation must have a valid authority path:

```
human_root → delegation → agent → operation
```

If any link is missing or expired, the operation is rejected.

## Operation Classification (MOC)

Operations are classified into four types:

- **SUP** (Support): Informational, read-only, no side effects
  - Example: "List available options"

- **INT** (Interpretation): Analysis or interpretation of data
  - Example: "Summarize metrics"

- **EIN** (Execution): Changes external state or uses irreversible tools
  - Example: "Deploy to production"
  - **Requires**: Human approval

- **DEC** (Decision): Makes value judgments or selects among options
  - Example: "Approve budget allocation"
  - **Requires**: Human approval

### Gating Rules

- **DEC operations**: Must have `requires_approval=true` and `approved_by` set
- **EIN operations**: Must have `requires_approval=true` and `approved_by` set
- **SUP/INT operations**: No gating required (unless using restricted tools)

## Coherence (CPT-1)

Coherence ensures internal consistency across four dimensions:

### Goal Invariant (GI)
Optimization goals must not contradict each other or hard constraints.

**Example violation**:
- Goal: "Maximize uptime"
- Constraint: "System must be offline for maintenance daily"

### Constraint Invariant (CI)
Hard constraints must be consistent and non-contradictory.

### Semantic Invariant (SI)
Locked definitions cannot be modified. Terms used in decisions must be defined.

**Example violation**:
- Definition: `"critical_metric"` (locked)
- Operation: Attempts to redefine `critical_metric`

### Temporal Invariant (TI)
Workflows and delegations must be within valid time bounds.

**Example violation**:
- Delegation `valid_until: 2026-01-01`
- Current date: `2026-01-12`

## Freeze State

When critical violations occur (severity=FREEZE), the workflow enters **freeze state**:

- Execution is blocked
- Freeze reason is reported
- Human review required
- `unfreeze_token` must be provided to proceed

### What Triggers Freeze?

- Split-brain authority (SBAA violations)
- Semantic drift (modifying locked definitions)
- Goal-constraint conflicts

## Ω-SCAN (Omega Scan)

A pre-check module for text artifacts (policies, prompts, documentation).

### Detected Patterns

**Implicit Authority**:
- "AI decides..."
- "Model approves..."
- "System automatically authorizes..."
- "Agent has permission to..."

**Irreversible Actions Without Signoff**:
- "Delete records..."
- "Deploy to production..."
- "Transfer funds..."
- (without mention of human approval)

**Undefined Terms in Decisions**:
- Using capitalized or quoted terms without definitions
- Making decisions based on undefined metrics

### Artifacts Types

- `policy`: Governance policies and rules
- `prompt`: AI agent system prompts
- `doc`: General documentation

## Violation Severity

- **WARN**: Advisory, doesn't block execution
- **FAIL**: Blocks execution, must be fixed
- **FREEZE**: Critical conflict, requires human review and unfreeze token

## JSON Pointer Paths

Violations reference specific fields using JSON Pointer syntax:

- `/authority_map/root` - The authority root field
- `/operations/0/executor` - The executor of the first operation
- `/definitions/2/locked` - The locked field of the third definition

This allows precise remediation guidance.
