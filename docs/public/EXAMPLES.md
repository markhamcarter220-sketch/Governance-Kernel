# Examples

## Example 1: Passing Workflow (Minimal)

**File:** `fixtures/workflows/pass_minimal.json`

```json
{
  "version": "1.0",
  "agents": [
    {
      "name": "assistant",
      "role": "information_provider",
      "allowed_actions": ["read", "summarize", "propose"]
    }
  ],
  "tools": [
    {
      "name": "database_query",
      "irreversible": false,
      "requires_human_signoff": false
    }
  ],
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "assistant",
        "scope": ["read", "summarize", "propose"],
        "granted_by": "human_root"
      }
    ]
  },
  "operations": [
    {
      "id": "op1",
      "type": "propose",
      "executor": "assistant"
    }
  ],
  "constraints": [
    "All data must remain confidential",
    "No external API calls"
  ],
  "optimization_goals": [
    "Provide accurate information quickly"
  ],
  "timestamps": {
    "created": "2026-01-12T10:00:00Z",
    "valid_until": "2026-01-13T10:00:00Z"
  }
}
```

### Why It Passes

1. **AIT-1**: ✓ Root is `human_root`, delegation exists from root to `assistant`
2. **MOC**: ✓ Operation is `propose` (SUP type), no gating required
3. **CPT-1**: ✓ No goal-constraint conflicts, no locked definitions being modified, timestamps valid
4. **SBAA**: ✓ Single authority source

### Verification Report

```
Status: ✓ PASS
Summary: Workflow validation PASSED. All invariants satisfied.
Total Violations: 0
```

---

## Example 2: Failing Workflow (Authority Leak)

**File:** `fixtures/workflows/fail_authority_leak.json`

```json
{
  "version": "1.0",
  "agents": [
    {
      "name": "autonomous_agent",
      "role": "decision_maker",
      "allowed_actions": ["approve", "execute", "deploy"]
    }
  ],
  "tools": [
    {
      "name": "deploy_to_production",
      "irreversible": true,
      "requires_human_signoff": true
    }
  ],
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "autonomous_agent",
        "scope": ["*"],
        "granted_by": "human_root"
      }
    ]
  },
  "operations": [
    {
      "id": "op1",
      "type": "approve",
      "executor": "autonomous_agent",
      "is_decision": true
    },
    {
      "id": "op2",
      "type": "execute",
      "executor": "autonomous_agent",
      "tool": "deploy_to_production",
      "changes_state": true
    }
  ],
  "constraints": [
    "Deployments require human approval"
  ],
  "timestamps": {
    "created": "2026-01-12T10:00:00Z"
  }
}
```

### Why It Fails

1. **MOC Violation (op1)**: Operation is DEC type (is_decision=true) but lacks `approved_by`
2. **MOC Violation (op2)**: Operation is EIN type (changes_state=true, irreversible tool) but lacks `approved_by`
3. **Tool Violation (op2)**: Tool requires human signoff but operation has no `approved_by`

### Verification Report

```
Status: ✗ FAIL
Summary: Workflow validation FAILED with 3 critical violation(s) and 0 warning(s).
Total Violations: 3

FAIL: 3

------------------------------------------------------------
VIOLATIONS
------------------------------------------------------------

[1] FAIL: MOC_DECISION_NOT_GATED
    Message: Decision operation "op1" is not properly gated by human approval
    Path: /operations/0
    Remediation: Set requires_approval=true and provide approved_by field for operation "op1"

[2] FAIL: MOC_EXECUTION_NOT_GATED
    Message: Execution operation "op2" with irreversible effects is not gated by human approval
    Path: /operations/1
    Remediation: Set requires_approval=true and provide approved_by field for operation "op2"

[3] FAIL: OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF
    Message: Operation "op2" uses tool "deploy_to_production" which requires human signoff
    Path: /operations/1/approved_by
    Remediation: Provide approved_by field for operation "op2"
```

### How to Fix

Add human approval:

```json
{
  "operations": [
    {
      "id": "op1",
      "type": "approve",
      "executor": "autonomous_agent",
      "is_decision": true,
      "requires_approval": true,
      "approved_by": "human_operator_alice"
    },
    {
      "id": "op2",
      "type": "execute",
      "executor": "autonomous_agent",
      "tool": "deploy_to_production",
      "changes_state": true,
      "requires_approval": true,
      "approved_by": "human_operator_bob"
    }
  ]
}
```

---

## Example 3: Freeze State (Split Brain)

**File:** `fixtures/workflows/fail_split_brain.json`

```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "agent_a",
        "scope": ["analyze"],
        "granted_by": "human_root"
      },
      {
        "granted_to": "agent_b",
        "scope": ["execute"],
        "granted_by": "agent_a"
      }
    ]
  }
}
```

### Why It Freezes

**SBAA Violation**: `agent_a` is granting authority to `agent_b`, but only `human_root` should grant authority. This creates a split-brain scenario where authority is being created rather than conserved.

### Verification Report

```
⚠️  SYSTEM FROZEN ⚠️

Reason: SBAA_SPLIT_BRAIN: Multiple authority sources detected: delegations granted by entities other than the declared root

Status: ✗ FAIL
Summary: Workflow FROZEN due to critical violations. 1 freeze-level issue(s) detected.
Total Violations: 1

FREEZE: 1

------------------------------------------------------------
VIOLATIONS
------------------------------------------------------------

[1] FREEZE: SBAA_SPLIT_BRAIN
    Message: Multiple authority sources detected: delegations granted by entities other than the declared root
    Path: /authority_map/delegations
    Remediation: Ensure all delegations are granted by the declared root or human_root. Remove delegations from other sources.
    Evidence: {
      "declared_root": "human_root",
      "other_grantors": ["agent_a"]
    }
```

### How to Fix

All delegations must come from `human_root`:

```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "agent_a",
        "scope": ["analyze"],
        "granted_by": "human_root"
      },
      {
        "granted_to": "agent_b",
        "scope": ["execute"],
        "granted_by": "human_root"
      }
    ]
  }
}
```

---

## Example 4: Ω-SCAN Clean Artifact

**File:** `fixtures/docs/sample_policy.md`

**Excerpt:**
```markdown
## Decision-Making Rules

### Rule 1: Human Authority Required
All decisions involving resource allocation, production deployments,
or data schema changes **must** receive human signoff before execution.

### Rule 2: Agent Capabilities
Agents may autonomously:
- Generate reports and summaries
- Propose solutions (subject to human review)
- Query read-only data sources

Agents **must not**:
- Approve their own proposals
- Execute irreversible operations without human authorization
```

### Why It Passes

- No implicit authority claims
- Clear human signoff requirements
- Explicit boundaries for agent capabilities

### Scan Report

```
Status: ✓ CLEAN
Summary: Artifact (policy) passed Ω-SCAN validation
```

---

## Example 5: Ω-SCAN Violations

**File:** `fixtures/docs/sample_agent_prompt.txt`

**Excerpt:**
```
DECISION-MAKING AUTHORITY:
When customers request refunds under $50, you can approve them
automatically and process the refund without human review.

You have the ability to:
- Delete customer data if they request account deletion (permanent action)

Remember: You are empowered to make decisions quickly.
The AI decides the best course of action based on the situation.
```

### Why It Fails

1. "you can approve them automatically" - implicit authority
2. "Delete customer data...permanent action" - irreversible without signoff mention
3. "The AI decides" - implicit authority claim

### Scan Report

```
Status: ✗ VIOLATIONS FOUND
Summary: Artifact (prompt) has 3 violation(s)

[1] FAIL: OMEGA_IMPLICIT_AUTHORITY_IN_TEXT
    Message: Artifact contains implicit authority claim
    Location: line:15
    Evidence: {
      "matched_text": "AI decides",
      "context": "The AI decides the best course of action..."
    }

[2] FAIL: OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF
    Message: Irreversible action mentioned without human signoff requirement
    Location: line:8
    Evidence: {
      "matched_action": "Delete",
      "context": "Delete customer data if they request..."
    }
```

### How to Fix

Rewrite to require explicit human approval:

```
DECISION-MAKING AUTHORITY:
When customers request refunds under $50, create a refund proposal
that requires approval from a human operator before processing.

EXECUTION PERMISSIONS:
You may prepare requests for:
- Customer data deletion (requires explicit human authorization before execution)

Remember: You provide information and proposals.
Human operators make final decisions and authorize irreversible actions.
```
