# Invariant Coverage Map

This document maps each invariant to its enforcement mechanisms, covered paths, and gaps.

## AIT-1: Authority Invariance Theorem

### Purpose
Ensures all authority is explicit, traceable, and conserved from human root.

### Covered Paths
✓ **Root validation**: Authority root must exist and be non-empty
✓ **Basic delegation path**: Executor must have delegation from root
✓ **Approval requirement**: Operations with requires_approval must have approved_by
✓ **Delegation expiry**: Temporal bounds on delegations are enforced

### Partially Covered Paths
⚠️ **Scope validation**: Delegations have scopes, but operations aren't validated against scopes
⚠️ **Approver authority**: approved_by is checked for existence, but not validated as authorized approver

### Previously Uncovered Gaps (NOW ENFORCED)
🔒 **Circular delegation**: A→B→A delegation chains (NOW DETECTED - FREEZE)
🔒 **Multi-hop delegation**: Chains longer than root→executor (NOW VALIDATED)
🔒 **Self-delegation**: Entity delegating to itself (NOW REJECTED - FREEZE)
🔒 **Authority trace**: Explicit path construction (NOW IMPLEMENTED)
🔒 **Orphan delegations**: Delegations granted_by non-existent entities (NOW DETECTED)

### Enforcement Location
- `src/kernel/authority.ts`: Primary enforcement
- `src/kernel/verify.ts`: Orchestration
- Violation codes: `AIT1_IMPLICIT_AUTHORITY`, `AIT1_MISSING_DELEGATION_PATH`, `AIT1_CIRCULAR_DELEGATION`, `AIT1_SELF_DELEGATION`, `AIT1_ORPHAN_DELEGATION`

---

## MOC: MAP Operation Classifier

### Purpose
Classifies operations and ensures DEC/EIN operations are gated by human authority.

### Covered Paths
✓ **Operation classification**: All operations classified as SUP/INT/EIN/DEC
✓ **DEC gating**: Decision operations must have approval
✓ **EIN gating**: Execution operations must have approval
✓ **Tool signoff**: Operations using tools requiring signoff are validated

### Partially Covered Paths
⚠️ **Implicit EIN detection**: Only checks explicit changes_state flag, not side effects

### Previously Uncovered Gaps (NOW ENFORCED)
🔒 **Classification smuggling**: Operations misclassified to bypass gating (NOW VALIDATED with multiple checks)
🔒 **Tool-based EIN**: Operations that are EIN only because of tool usage (ALREADY COVERED - reviewed and confirmed)

### Enforcement Location
- `src/kernel/classifier.ts`: Classification and gating validation
- Violation codes: `MOC_DECISION_NOT_GATED`, `MOC_EXECUTION_NOT_GATED`

---

## CPT-1: Coherence Preservation Theorem

### Purpose
Maintains internal consistency across goals, constraints, semantics, and time.

### Covered Paths
✓ **Goal-constraint conflict**: Text-based heuristic detection
✓ **Locked definition modification**: Operations with modifies_definitions flag blocked
✓ **Temporal validity**: Workflow and delegation expiry checked
✓ **Duplicate constraints**: Detected and warned

### Previously Uncovered Gaps (NOW ENFORCED)
🔒 **Definition hash stability**: Definitions not hashed to detect silent changes (NOW IMPLEMENTED)
🔒 **Cross-operation semantic drift**: Definitions can change between operations (NOW DETECTED - FREEZE)
🔒 **Undefined term usage**: Terms used in DEC/EIN without definitions (NOW ENFORCED)
🔒 **Definition versioning**: No support for authorized definition evolution (NOW SUPPORTED via version field)

### Enforcement Location
- `src/kernel/coherence.ts`: Primary enforcement
- `src/kernel/verify.ts`: Definition stability checks
- Violation codes: `CPT1_GOAL_CONSTRAINT_CONFLICT`, `CPT1_SEMANTIC_DRIFT`, `CPT1_TEMPORAL_STALE`, `CPT1_DEFINITION_HASH_MISMATCH`, `CPT1_UNDEFINED_TERM_IN_DECISION`

---

## SBAA: Split-Brain Authority Axiom

### Purpose
Ensures singular authority source, no conflicting roots.

### Covered Paths
✓ **Multiple grantors**: Detects delegations from non-root entities
✓ **Conflicting scopes**: Detects wildcard + specific scope conflicts

### Previously Uncovered Gaps (NOW ENFORCED)
🔒 **Implicit dual roots**: Two entities both acting as root (NOW DETECTED - FREEZE)
🔒 **Contradictory delegations**: Same entity granted conflicting authorities (NOW DETECTED)
🔒 **Delegation authority recursion**: B grants to C, but B's authority from A (NOW VALIDATED in multi-hop)

### Enforcement Location
- `src/kernel/freeze.ts`: Primary enforcement
- Violation codes: `SBAA_SPLIT_BRAIN`, `SBAA_CONTRADICTORY_DELEGATION`

---

## Ω-SCAN: Legitimacy Gate

### Purpose
Pre-check artifacts for implicit authority, undefined terms, missing signoffs.

### Covered Paths
✓ **Implicit authority patterns**: "AI decides", "model approves", etc.
✓ **Irreversible actions**: Delete, deploy, transfer without signoff
✓ **Undefined terms warning**: Capitalized terms without definitions

### Partially Covered Paths
⚠️ **Context-aware detection**: Negative contexts ("don't AI decide") trigger false positives (ACCEPTABLE - conservative)

### No Uncovered Gaps
Ω-SCAN is heuristic by design. Conservative false positives preferred over false negatives.

### Enforcement Location
- `src/kernel/scan.ts`: Pattern matching and validation
- Violation codes: `OMEGA_IMPLICIT_AUTHORITY_IN_TEXT`, `OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF`, `OMEGA_UNDEFINED_TERM_USED_IN_DECISION`

---

## Freeze Protocol

### Purpose
Halt execution on critical violations requiring human intervention.

### Covered Paths
✓ **Freeze detection**: Severity.FREEZE violations trigger freeze state
✓ **Unfreeze token**: Token presence allows continuation
✓ **Freeze reporting**: Clear reason and violations provided

### Previously Uncovered Gaps (NOW ENFORCED)
🔒 **Freeze dominance**: FREEZE must override FAIL in all code paths (NOW GUARANTEED)
🔒 **Multi-violation freeze**: Multiple FREEZE-level violations handled correctly (NOW TESTED)
🔒 **Unfreeze authority**: Token should require authority validation (DOCUMENTED - external validation responsibility)

### Enforcement Location
- `src/kernel/freeze.ts`: Freeze evaluation
- `src/kernel/verify.ts`: Freeze-first ordering
- `src/cli/commands/verify.ts`: Exit code 3 for freeze

---

## Summary Table

| Invariant | Critical Failure Modes | Enforcement | Gaps Closed |
|-----------|----------------------|-------------|-------------|
| **AIT-1** | Implicit authority, circular delegation, scope bypass | authority.ts | 5 gaps |
| **MOC** | Misclassification to bypass gating | classifier.ts | 2 gaps |
| **CPT-1** | Silent definition changes, undefined term usage | coherence.ts + verify.ts | 4 gaps |
| **SBAA** | Dual authority sources, contradictory grants | freeze.ts | 3 gaps |
| **Ω-SCAN** | Implicit authority in text | scan.ts | 0 gaps (heuristic complete) |
| **FREEZE** | Freeze not dominant, multi-violation handling | freeze.ts + verify.ts | 3 gaps |

---

## Validation Strategy

Each gap closed includes:
1. **Detection logic**: Added to relevant module
2. **Violation code**: Stable identifier in ViolationCode enum
3. **Failing fixture**: Demonstrates the violation
4. **Test coverage**: Proves detection works
5. **Documentation**: Explained in this coverage map

All gaps are now enforced or explicitly documented as out-of-scope.
