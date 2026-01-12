# Authority Flow Tracing

## Purpose

This document explains the explicit authority-flow tracing mechanism implemented in the Governance Kernel. Authority traces provide cryptographic-grade proof that every operation has a valid delegation path from human root.

## Core Principle

**Authority flows, it is not assumed.**

Every operation must have an explicit trace showing:
```
human_root → delegation → [intermediate] → executor → operation
```

If any link in this chain is missing, expired, circular, or orphaned, the operation is rejected.

---

## Authority Trace Structure

```typescript
interface AuthorityTrace {
  operation_id: string;         // Operation being validated
  executor: string;              // Entity executing the operation
  path: AuthorityTraceNode[];    // Explicit chain from root to executor
  valid: boolean;                // Whether trace is complete and valid
  failure_reason?: string;       // Why trace is invalid (if applicable)
}

interface AuthorityTraceNode {
  entity: string;                // Entity in the chain
  granted_by?: string;           // Who granted authority to this entity
  scope: string[];               // Allowed operations
  valid_until?: string;          // Temporal bound (ISO 8601)
}
```

---

## Trace Construction Algorithm

### Step 1: Start from Executor

For each operation, begin with the executor and work backwards toward root.

### Step 2: Find Delegation

Look for a delegation where `granted_to == executor`.

If no delegation exists:
- **Trace fails:** `AIT1_MISSING_DELEGATION_PATH`

### Step 3: Validate Grantor

Check that `granted_by` has authority (either is root, or has a delegation itself).

If grantor lacks authority:
- **Trace fails:** `AIT1_ORPHAN_DELEGATION`

### Step 4: Recursively Build Path

Repeat steps 2-3 for the grantor, building the chain backwards until reaching `human_root`.

### Step 5: Detect Cycles

Maintain a `visited` set. If an entity appears twice in the path:
- **FREEZE:** `AIT1_CIRCULAR_DELEGATION`

### Step 6: Detect Self-Delegation

If any delegation has `granted_to == granted_by`:
- **FREEZE:** `AIT1_SELF_DELEGATION`

### Step 7: Validate Scope

Check that the operation's type is within the executor's granted scope.

If operation type not in scope:
- **Trace fails:** `AIT1_SCOPE_VIOLATION`

### Step 8: Validate Temporal Bounds

Check all delegations in the path for expired `valid_until` timestamps.

If any delegation expired:
- **Trace fails:** `CPT1_TEMPORAL_STALE`

---

## Examples

### Example 1: Valid Single-Hop Delegation

**Workflow:**
```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "agent_a",
        "scope": ["execute"],
        "granted_by": "human_root"
      }
    ]
  },
  "operations": [
    {
      "id": "op1",
      "type": "execute",
      "executor": "agent_a"
    }
  ]
}
```

**Authority Trace:**
```
Path: [
  { entity: "human_root", scope: ["*"] },
  { entity: "agent_a", granted_by: "human_root", scope: ["execute"] }
]
Valid: true
```

---

### Example 2: Valid Multi-Hop Delegation

**Workflow:**
```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "supervisor",
        "scope": ["*"],
        "granted_by": "human_root"
      },
      {
        "granted_to": "agent_a",
        "scope": ["execute"],
        "granted_by": "supervisor"
      }
    ]
  },
  "operations": [
    {
      "id": "op1",
      "type": "execute",
      "executor": "agent_a"
    }
  ]
}
```

**Authority Trace:**
```
Path: [
  { entity: "human_root", scope: ["*"] },
  { entity: "supervisor", granted_by: "human_root", scope: ["*"] },
  { entity: "agent_a", granted_by: "supervisor", scope: ["execute"] }
]
Valid: true
```

---

### Example 3: Invalid - Circular Delegation (FREEZE)

**Workflow:**
```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "agent_a",
        "scope": ["*"],
        "granted_by": "human_root"
      },
      {
        "granted_to": "agent_b",
        "scope": ["*"],
        "granted_by": "agent_a"
      },
      {
        "granted_to": "agent_a",
        "scope": ["*"],
        "granted_by": "agent_b"
      }
    ]
  }
}
```

**Authority Trace:**
```
Path: []
Valid: false
Failure Reason: "Circular delegation: agent_a → agent_b → agent_a"
```

**Violation:** `AIT1_CIRCULAR_DELEGATION` (FREEZE)

---

### Example 4: Invalid - Self-Delegation (FREEZE)

**Workflow:**
```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "agent_a",
        "scope": ["*"],
        "granted_by": "agent_a"
      }
    ]
  }
}
```

**Authority Trace:**
```
Path: []
Valid: false
Failure Reason: "Self-delegation detected"
```

**Violation:** `AIT1_SELF_DELEGATION` (FREEZE)

---

### Example 5: Invalid - Orphan Delegation

**Workflow:**
```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "agent_b",
        "scope": ["execute"],
        "granted_by": "agent_a"
      }
    ]
  }
}
```

**Authority Trace:**
```
Path: []
Valid: false
Failure Reason: "agent_a has no authority to grant"
```

**Violation:** `AIT1_ORPHAN_DELEGATION`

---

### Example 6: Invalid - Scope Violation

**Workflow:**
```json
{
  "authority_map": {
    "root": "human_root",
    "delegations": [
      {
        "granted_to": "agent_a",
        "scope": ["read", "analyze"],
        "granted_by": "human_root"
      }
    ]
  },
  "operations": [
    {
      "id": "op1",
      "type": "execute",
      "executor": "agent_a"
    }
  ]
}
```

**Authority Trace:**
```
Path: [
  { entity: "human_root", scope: ["*"] },
  { entity: "agent_a", granted_by: "human_root", scope: ["read", "analyze"] }
]
Valid: true (path is valid)
```

**However:** Scope validation fails because `"execute"` is not in `["read", "analyze"]`.

**Violation:** `AIT1_SCOPE_VIOLATION`

---

## Trace in Violation Evidence

When authority validation fails, the trace is included in the violation evidence:

```json
{
  "code": "AIT1_MISSING_DELEGATION_PATH",
  "severity": "fail",
  "message": "Operation executor \"agent_x\" has no valid authority path from root",
  "evidence": {
    "executor": "agent_x",
    "operation_id": "op1",
    "authority_trace": [],
    "failure_reason": "No delegation found for \"agent_x\""
  }
}
```

This makes debugging authority issues straightforward.

---

## Properties Enforced

### Acyclic

Authority graphs must be directed acyclic graphs (DAGs). Cycles trigger FREEZE.

### Rooted

All authority traces back to exactly one root: `human_root` or a specific human identifier.

### Scoped

Every delegation has explicit scope. Operations outside scope are rejected.

### Temporal

Delegations with `valid_until` are time-bounded. Expired delegations fail.

### Non-Self-Referential

No entity can delegate to itself. Self-delegation triggers FREEZE.

---

## Implementation Location

- **Primary Logic:** `src/kernel/authority.ts`
- **Function:** `buildAuthorityTraces(workflow): AuthorityTrace[]`
- **Detection Functions:**
  - `detectSelfDelegations()`
  - `detectCircularDelegations()`
  - `detectOrphanDelegations()`
  - `validateOperationScope()`

---

## Performance Notes

- **Time Complexity:** O(D × E) where D = delegations, E = operations
- **Cycle Detection:** DFS with recursion stack, O(V + E) where V = entities
- **Caching:** Not implemented (traces are rebuilt on each validation)

For large workflows with hundreds of delegations, caching may be beneficial. However, correctness > performance in governance systems.

---

## Guarantees

The authority tracing system **guarantees**:

1. **No implicit authority:** Every operation has explicit human authorization
2. **No circular authority:** Authority chains are acyclic
3. **No self-granted authority:** Entities cannot authorize themselves
4. **No orphan authority:** All delegations trace to root
5. **Scope enforcement:** Operations must be within granted scope
6. **Temporal enforcement:** Expired delegations are invalid

These guarantees are **mechanically enforced**, not heuristic.

---

## External Validation

The `unfreeze_token` mechanism allows human operators to override freeze states after review. This token should be:

1. Cryptographically signed (external to this kernel)
2. Time-limited
3. Audited and logged
4. Revocable

The kernel itself does not validate token cryptography - that is the responsibility of the integrating system.

---

## Future Enhancements (Out of Scope)

- Multi-signature delegations (require N of M approvers)
- Delegation revocation lists
- Real-time delegation expiry checks (vs. validation-time)
- Capability-based delegation (OCAP model)
- Formal verification of trace construction (TLA+)

These are intentionally out of scope to maintain kernel simplicity.
