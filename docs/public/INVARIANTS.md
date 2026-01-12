# Invariants Reference

## AIT-1: Authority Invariance Theorem

### Principle
Authority is explicit, typed, and conserved. No operation may execute without a valid authority path from human root.

### Rules

1. **Explicit Root**: Every workflow must have `authority_map.root` set to `human_root` or a specific human identifier
2. **Delegation Path**: Every operation executor must have a delegation granting them authority
3. **Conservation**: Authority cannot be created, only delegated from existing authority
4. **Temporal Bounds**: Delegations can expire; expired delegations are invalid

### Violations

- `AIT1_IMPLICIT_AUTHORITY`: Operation assumes authority without explicit grant
- `AIT1_MISSING_DELEGATION_PATH`: No valid delegation from root to executor

### Example (PASS)

```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "agent1",
        "scope": ["read", "analyze"],
        "granted_by": "human_root"
      }
    ]
  },
  "operations": [
    {
      "id": "op1",
      "type": "analyze",
      "executor": "agent1"
    }
  ]
}
```

### Example (FAIL)

```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": []
  },
  "operations": [
    {
      "id": "op1",
      "type": "execute",
      "executor": "agent1"
    }
  ]
}
```

**Violation**: `agent1` has no delegation from `human_root`.

---

## MOC: MAP Operation Classifier

### Principle
Operations are classified based on their effects. Decision and execution operations must be gated by explicit human approval.

### Classification Rules

| Type | Description | Gating Required |
|------|-------------|-----------------|
| SUP  | Support/Information | No |
| INT  | Interpretation/Analysis | No |
| EIN  | Execution/Irreversible | **Yes** |
| DEC  | Decision/Authority | **Yes** |

### Classification Logic

1. If `changes_state=true` OR tool is `irreversible=true` → **EIN**
2. If `modifies_definitions=true` OR `is_decision=true` → **DEC**
3. If type is `verify`, `analyze`, `interpret` → **INT**
4. Otherwise → **SUP**

### Violations

- `MOC_DECISION_NOT_GATED`: DEC operation lacks `approved_by`
- `MOC_EXECUTION_NOT_GATED`: EIN operation lacks `approved_by`

### Example (PASS)

```json
{
  "tools": [
    { "name": "deploy", "irreversible": true, "requires_human_signoff": true }
  ],
  "operations": [
    {
      "id": "op1",
      "type": "execute",
      "executor": "agent1",
      "tool": "deploy",
      "changes_state": true,
      "requires_approval": true,
      "approved_by": "human_operator_alice"
    }
  ]
}
```

### Example (FAIL)

```json
{
  "operations": [
    {
      "id": "op1",
      "type": "approve",
      "executor": "agent1",
      "is_decision": true
    }
  ]
}
```

**Violation**: DEC operation (decision) without `approved_by`.

---

## CPT-1: Coherence Preservation Theorem

### Principle
Workflows must maintain internal consistency across goals, constraints, semantics, and time.

### Four Invariants

#### 1. Goal Invariant (GI)
Optimization goals must not contradict hard constraints.

**Example violation**:
```json
{
  "constraints": ["Minimize costs"],
  "optimization_goals": ["Maximize spending on infrastructure"]
}
```

#### 2. Constraint Invariant (CI)
Constraints must be consistent and non-duplicative.

#### 3. Semantic Invariant (SI)
Locked definitions cannot be modified.

**Example violation**:
```json
{
  "definitions": [
    { "term": "success_rate", "meaning": "99.9% uptime", "locked": true }
  ],
  "operations": [
    { "id": "op1", "type": "redefine", "modifies_definitions": true }
  ]
}
```

#### 4. Temporal Invariant (TI)
Timestamps must be valid and non-stale.

**Example violation**:
```json
{
  "timestamps": {
    "created": "2026-01-01T00:00:00Z",
    "valid_until": "2026-01-10T00:00:00Z"
  }
}
```
If current date is 2026-01-12, workflow is expired.

### Violations

- `CPT1_SEMANTIC_DRIFT`: Locked definition modified
- `CPT1_TEMPORAL_STALE`: Expired timestamp
- `CPT1_GOAL_CONSTRAINT_CONFLICT`: Goal contradicts constraint

---

## SBAA: Split-Brain Authority Axiom

### Principle
Authority must be singular. Multiple conflicting authority sources trigger freeze.

### Detection Rules

1. **Multiple Grantors**: Delegations granted by entities other than the declared root
2. **Conflicting Scopes**: Same executor with both wildcard and specific scopes

### Violations

- `SBAA_SPLIT_BRAIN`: Multiple authority roots detected

### Example (FREEZE)

```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      { "granted_to": "agent1", "scope": ["*"], "granted_by": "human_root" },
      { "granted_to": "agent1", "scope": ["execute"], "granted_by": "agent2" }
    ]
  }
}
```

**Violation**: `agent2` granting authority creates split-brain.

---

## Ω-SCAN: Legitimacy Gate

### Principle
Text artifacts must not contain implicit authority, undefined terms in decisions, or ungated irreversible actions.

### Pattern Detection

#### Implicit Authority Patterns
- `(AI|model|agent) decides`
- `automatically approve`
- `system authorizes`
- `without human approval`
- `self-approve`

#### Irreversible Action Patterns
- `delete`, `remove`, `destroy`
- `deploy to production`
- `transfer funds`
- `irreversible`, `permanent`

### Violations

- `OMEGA_IMPLICIT_AUTHORITY_IN_TEXT`: Artifact claims AI has authority
- `OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF`: Irreversible action without human signoff mention
- `OMEGA_UNDEFINED_TERM_USED_IN_DECISION`: Undefined terms in decision context

### Example (FAIL)

```
The AI decides whether to approve user requests based on risk score.
If approved, the system will delete the old data permanently.
```

**Violations**:
1. "AI decides" - implicit authority
2. "delete...permanently" - irreversible without signoff mention

### Example (PASS)

```
The system presents options to the human operator.
The operator decides whether to approve requests.
Before deleting data, the operator must provide explicit approval.
```
