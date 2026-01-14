# MAG-1 Implementation: Multi-Agent Governance Strengthening

## Status

This document describes how the Governance Kernel **satisfies** the MAG-1 property defined in the White Paper Library. This is implementation documentation, not theory. For formal definitions and proofs, see the canonical White Paper Library.

---

## What is MAG-1?

**MAG-1** (Multi-Agent Governance Strengthening) is a formally defined property stating that:

> Adding agents to a workflow does not weaken safety guarantees. An N-agent system with authority A is at least as safe as a 1-agent system with authority A.

**Informal statement:** More agents = more scrutiny, not more risk.

---

## Required Assumptions

For the kernel to satisfy MAG-1, the following must hold:

### 1. Authority Conservation (MAG-1A)
**Assumption:** Total authority in the system equals the authority explicitly delegated by human root.

**Implementation:**
- Enforced by `validateAuthority()` in `src/kernel/authority.ts`
- All delegations trace to `human_root` via `buildAuthorityTraces()`
- Orphan delegations (authority created from nothing) trigger `AIT1_ORPHAN_DELEGATION`
- Self-delegations (authority self-created) trigger `AIT1_SELF_DELEGATION` (FREEZE)

**Code reference:** `src/kernel/authority.ts:199-256`

### 2. Signals ≠ Permission
**Assumption:** Agent outputs (recommendations, proposals, votes) are informational and do not grant execution authority.

**Implementation:**
- Operations require explicit `approved_by` field pointing to human authority
- Classification into SUP/INT/DEC/EIN is independent of agent count
- DEC and EIN operations MUST have human approval regardless of agent consensus
- No "N-of-M agent approval" mechanism exists (intentionally)

**Code reference:** `src/kernel/classifier.ts:40-89`

### 3. Freeze on Disagreement
**Assumption:** Conflicting authority claims or semantic disagreements trigger freeze, not algorithmic resolution.

**Implementation:**
- Split-brain authority (multiple roots) triggers `SBAA_SPLIT_BRAIN` (FREEZE)
- Contradictory delegations trigger `SBAA_CONTRADICTORY_DELEGATION` (FREEZE)
- Definition conflicts trigger `CPT1_SEMANTIC_DRIFT` (FREEZE)
- No voting, consensus, or conflict resolution mechanisms exist (intentionally)

**Code reference:** `src/kernel/freeze.ts:20-167`

### 4. Interface Enforcement
**Assumption:** All agents interact through the same validated interface (the workflow JSON).

**Implementation:**
- JSON Schema validation enforces structural constraints (`src/kernel/schema-validator.ts`)
- All agents are `Agent` objects with explicit `allowed_actions`
- No privileged agent types or backdoor interfaces

**Code reference:** `src/kernel/schema-validator.ts:14-65`

---

## What the Kernel Guarantees (MAG-1 Properties)

### G1: Authority Non-Amplification
**Property:** N agents with authority A cannot collectively perform actions requiring authority > A.

**Enforcement:**
- Each operation validated independently against its executor's authority trace
- Multi-agent "teams" are not a primitive (no collective authority)
- `validateOperationScope()` checks each operation's scope against delegation

**Test:** `test/adversarial/hardening.test.ts:296` (scope violation)

### G2: Violation Detection Non-Decreasing
**Property:** Adding agents does not reduce the probability of detecting violations.

**Enforcement:**
- Each agent's operations are independently validated
- Violations accumulate (more agents = more potential violation sources)
- Validation is deterministic and exhaustive

**Implication:** More agents → more potential violation detectors (e.g., if agent B proposes an invalid operation that agent A wouldn't, it gets detected).

### G3: Silent Failure Non-Increasing
**Property:** Adding agents does not increase silent failure rate (violations that pass validation).

**Enforcement:**
- Validation is agent-count-agnostic
- All invariants (AIT-1, MOC, CPT-1, SBAA, Ω-SCAN) apply to every operation
- No "trusted agent" exemptions

**Test:** Schema validation + all invariant tests apply to N-agent workflows

### G4: Freeze Triggering
**Property:** Disagreement or ambiguity between agents triggers freeze.

**Enforcement:**
- If two agents have conflicting delegations → `SBAA_CONTRADICTORY_DELEGATION` (FREEZE)
- If definitions differ between operations → `CPT1_SEMANTIC_DRIFT` (FREEZE)
- If circular delegation exists → `AIT1_CIRCULAR_DELEGATION` (FREEZE)

**Test:** `test/adversarial/hardening.test.ts:257` (contradictory delegations)

---

## What the Kernel Does NOT Guarantee

### ✗ Agent Coordination Optimality
The kernel does not optimize agent coordination, task allocation, or workflow efficiency. It only validates safety constraints.

### ✗ Adversarial Agent Detection
The kernel does not detect which agent is adversarial. It detects **violations**, not **adversaries**.

### ✗ Liveness Under Adversarial Agents
If adversarial agents repeatedly propose invalid workflows, the system may freeze repeatedly. This is correct behavior (safety over liveness).

### ✗ Multi-Agent Consensus
The kernel does not implement voting, quorum, or consensus mechanisms. Agent agreement is informational, not authoritative.

### ✗ Runtime Behavior Monitoring
The kernel validates workflow **structures**. It does not monitor agent behavior at execution time.

---

## Adversarial Agent Threat Model

**Allowed adversarial behaviors:**
- Proposing operations outside granted scope (detected via `AIT1_SCOPE_VIOLATION`)
- Attempting self-delegation (detected via `AIT1_SELF_DELEGATION`, frozen)
- Attempting circular delegation (detected via `AIT1_CIRCULAR_DELEGATION`, frozen)
- Proposing definition changes (detected via `CPT1_SEMANTIC_DRIFT`, frozen)
- Omitting required approvals (detected via `MOC_DECISION_NOT_GATED` or `MOC_EXECUTION_NOT_GATED`)

**Prohibited (assumed prevented by external system):**
- Modifying the workflow JSON directly (external integrity required)
- Tampering with the kernel itself (code integrity required)
- Impersonating human approvers (external authentication required)

**Degradation mode:** If adversarial activity detected → freeze, not silent failure.

---

## Implementation Checklist

To satisfy MAG-1, an implementation must:

- ✅ Validate all operations independently of agent count
- ✅ Enforce authority conservation (no authority creation)
- ✅ Treat agent signals as informational (not authoritative)
- ✅ Freeze on conflicting authority or definitions
- ✅ Validate each agent's operations against its specific delegation
- ✅ Reject self-delegation and circular delegation
- ✅ Require human approval for DEC/EIN operations regardless of agent count
- ✅ Apply same invariants (AIT-1, MOC, CPT-1, SBAA, Ω-SCAN) to all agents

**Status:** This implementation satisfies all requirements. See test suite for validation.

---

## Metrics (Test Harness)

The following metrics validate MAG-1 properties across agent counts:

### IAR: Illegal Action Rate
**Definition:** Proportion of invalid operations that pass validation.

**Expected:** IAR ≈ 0 for all N (no invalid operations pass validation).

**Test location:** `test/multi_agent/mag1_metrics.test.ts` (see test scaffold).

### SFR: Silent Failure Rate
**Definition:** Proportion of violations undetected by validation.

**Expected:** SFR non-increasing with N (more agents → more potential detection).

**Test location:** `test/multi_agent/mag1_metrics.test.ts` (see test scaffold).

### CDR: Conflict Detection Rate
**Definition:** Proportion of conflicting proposals that trigger freeze.

**Expected:** CDR ≈ 1.0 for all N (all conflicts detected and frozen).

**Test location:** `test/multi_agent/mag1_metrics.test.ts` (see test scaffold).

---

## Validation Strategy

### Single-Agent Baseline
Validate that a 1-agent workflow with authority A correctly rejects violations.

### N-Agent Extension
For N ∈ {2, 4, 8, 16}:
1. Replicate authority A across N agents
2. Ensure same violations are detected
3. Ensure no new violations introduced by agent count
4. Ensure freeze triggered on agent conflicts

### Adversarial Injection
For N ∈ {2, 4, 8, 16}:
1. Inject 1 adversarial agent into an (N-1)-agent workflow
2. Ensure adversarial operations rejected
3. Ensure system freezes (not fails silently)

**Test scaffold:** `test/multi_agent/mag1_metrics.test.ts`

---

## References

**Canonical Theory:**
- White Paper Library: MAG-1 (Multi-Agent Governance Strengthening)
- White Paper Library: MAG-1A (Authority Conservation)

**Implementation:**
- `src/kernel/authority.ts` - Authority conservation enforcement
- `src/kernel/freeze.ts` - Freeze-on-conflict enforcement
- `src/kernel/classifier.ts` - Signals ≠ permission enforcement
- `test/adversarial/hardening.test.ts` - Adversarial agent tests

**Related Documentation:**
- `docs/public/AUTHORITY_FLOW.md` - Authority tracing
- `docs/public/INVARIANT_COVERAGE.md` - Invariant enforcement
- `docs/public/CONCEPTS.md` - Core concepts

---

## Summary

This implementation satisfies MAG-1 by:
1. **Conserving authority** (no creation, only delegation)
2. **Treating agent signals as informational** (not authoritative)
3. **Freezing on disagreement** (not resolving algorithmically)
4. **Enforcing uniform interface** (JSON Schema + invariants)

The system is **safe under agent scaling**: adding agents does not weaken safety guarantees.

**Limitations:** The kernel validates structures, not runtime behavior. Execution-time monitoring is the responsibility of the integrating system.
