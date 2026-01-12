# JSON Schemas

## Workflow Schema

Location: `schemas/workflow.schema.json`

### Required Fields

```typescript
{
  version: string
  agents: Agent[]
  tools: Tool[]
  authority_map: AuthorityMap
  operations: Operation[]
  constraints: string[]
  timestamps: {
    created: string (ISO 8601)
    valid_until?: string (ISO 8601)
  }
}
```

### Optional Fields

- `data_sources`: Array of data source definitions
- `definitions`: Array of locked term definitions
- `optimization_goals`: Array of soft goals
- `unfreeze_token`: Token for unfreezing after human review

### Agent

```typescript
{
  name: string
  role: string
  allowed_actions: string[]
}
```

### Tool

```typescript
{
  name: string
  irreversible: boolean
  requires_human_signoff: boolean
}
```

### AuthorityMap

```typescript
{
  root: string // "human_root" or human identifier
  delegations: AuthorityGrant[]
}
```

### AuthorityGrant

```typescript
{
  granted_to: string // agent name
  scope: string[] // actions or ["*"]
  granted_by: string // "human_root" or grantor
  valid_until?: string // ISO 8601 optional expiry
}
```

### Operation

```typescript
{
  id: string
  type: string // "propose" | "verify" | "approve" | "execute" | custom
  executor: string // agent name
  tool?: string // tool name
  requires_approval?: boolean
  approved_by?: string // human identifier
  changes_state?: boolean
  modifies_definitions?: boolean
  is_decision?: boolean
}
```

### Definition

```typescript
{
  term: string
  meaning: string
  locked: boolean
}
```

---

## Report Schema

Location: `schemas/report.schema.json`

### VerificationResult

```typescript
{
  valid: boolean
  violations: Violation[]
  freeze?: FreezeState
  summary: string
}
```

### Violation

```typescript
{
  code: ViolationCode // enum
  severity: "warn" | "fail" | "freeze"
  message: string
  path: string // JSON pointer
  evidence: Record<string, any>
  remediation: string
}
```

### FreezeState

```typescript
{
  frozen: boolean
  reason?: string
  violations: Violation[]
}
```

### ViolationCode Enum

```typescript
enum ViolationCode {
  AIT1_IMPLICIT_AUTHORITY
  AIT1_MISSING_DELEGATION_PATH
  MOC_DECISION_NOT_GATED
  MOC_EXECUTION_NOT_GATED
  CPT1_SEMANTIC_DRIFT
  CPT1_TEMPORAL_STALE
  CPT1_GOAL_CONSTRAINT_CONFLICT
  SBAA_SPLIT_BRAIN
  OMEGA_UNDEFINED_TERM_USED_IN_DECISION
  OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF
  OMEGA_IMPLICIT_AUTHORITY_IN_TEXT
  SCHEMA_VALIDATION_ERROR
}
```

---

## ScanResult

```typescript
{
  artifact_type: string
  violations: Violation[]
  clean: boolean
  summary: string
}
```

---

## Validation Notes

- All timestamps must be ISO 8601 format
- JSON Pointers follow RFC 6901
- Scopes can be specific actions or `["*"]` for wildcard
- Empty arrays are allowed for `delegations` but will likely cause validation failures
- `unfreeze_token` is freeform string (in production would be cryptographic)
