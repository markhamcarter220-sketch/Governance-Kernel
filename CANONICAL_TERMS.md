# Canonical Terms & Definitions

This document defines core terminology for the Governance Kernel and related implementations. These definitions are authoritative and binding within this repository.

## Purpose

This file exists to prevent semantic drift and authority confusion. Terms defined here have precise technical meanings that are mechanically enforced by the kernel.

---

## Authority

**Definition:** Authority is explicit permission to execute an operation.

**Constraints:**
- Authority is never confidence, capability, consensus, or recommendation
- Authority is granted through explicit delegation, not inferred from context
- Authority must trace to a designated human root through a validated path
- Authority is conserved: it can be delegated but not created or amplified
- Authority is scoped: delegations specify permitted actions, not blanket permission
- Authority is temporal: delegations may expire at specified times

**Not authority:**
- An agent's capability to perform an action
- High confidence in a recommendation
- Agreement among multiple agents
- Successful completion of prerequisite tasks

**Mechanical enforcement:** Authority is validated by tracing delegation paths from executor to human root. Operations without valid paths are rejected.

---

## Signal (Sensing)

**Definition:** A signal is an observation, measurement, recommendation, or proposal produced by an agent or system. Signals are informational.

**Constraints:**
- Signals do not grant authority
- Signals do not constitute approval or permission
- Agent consensus on a signal does not authorize execution
- Signals may inform human decisions but do not replace them

**Examples of signals:**
- Agent recommendations ("I suggest deploying version 2.0")
- Confidence scores or probability estimates
- Observations from monitoring systems
- Votes or preferences in multi-agent systems

**Not signals:**
- Human approval or signoff
- Explicit delegation grants
- Authority tokens

**Relationship to authority:** Signals and authority are independent. An agent may signal with high confidence while lacking authority. An agent may have authority but provide no signal.

---

## Authority Validation (Permission Check)

**Definition:** Authority validation is the mechanical process of verifying that an operation has explicit permission to execute.

**Process:**
1. Identify the executor of the operation
2. Trace delegation path from executor to human root
3. Verify the operation type is within the executor's granted scope
4. Check temporal validity of all delegations in the path
5. Confirm required human approvals for gated operation types

**Validation succeeds if:** A valid, non-expired delegation path exists from human root to executor, covering the operation's scope.

**Validation fails if:** Any delegation in the path is missing, expired, out-of-scope, circular, self-referential, or orphaned.

**Mechanical enforcement:** Implemented in `src/kernel/authority.ts` via path tracing and scope checking.

---

## Execution

**Definition:** Execution is the performance of an operation that produces side effects, particularly irreversible side effects.

**Characteristics:**
- Execution changes system state
- Execution may be irreversible (cannot be undone)
- Execution requires authority, not just capability

**Examples:**
- Deploying code to production
- Deleting data
- Transferring funds
- Modifying access control rules

**Gating requirement:** Operations classified as EIN (Execution-Irreversible-Narrow) or DEC (Decision) require human approval before execution.

**Relationship to authority:** Execution is the action; authority is the permission. An agent with execution capability but no authority must not execute.

---

## Freeze

**Definition:** Freeze is a system state triggered by critical violations, halting workflow validation until human review occurs.

**Triggers:**
- Circular delegation (A→B→A)
- Self-delegation (entity delegates to itself)
- Split-brain authority (multiple conflicting roots)
- Definition hash mismatch (locked definition silently changed)
- Contradictory delegations (conflicting scope grants)
- Semantic drift (definition modified without version update)

**Behavior:**
- Workflow validation returns `valid: false` with `freeze` state
- Execution must not proceed
- Human review is required
- An explicit unfreeze token may allow continuation after review

**Freeze is not failure:** Freeze is a correct outcome when ambiguity or conflict exists. The system chooses safety over availability.

**Freeze dominance:** Freeze-level violations take precedence over all other violations. If any freeze trigger is present, the workflow is frozen regardless of other issues.

---

## Governance Kernel

**Definition:** The Governance Kernel is a validation layer that enforces authority, coherence, and operational constraints on workflow definitions.

**What it is:**
- A pre-execution validation system
- A mechanical enforcer of invariants
- A structural constraint checker

**What it is not:**
- Not an AI model or inference system
- Not a runtime execution monitor
- Not a permissions enforcement system
- Not a workflow engine
- Not a decision-making system

**Function:** The kernel validates workflow JSON structures against invariants (AIT-1, MOC, CPT-1, SBAA, Ω-SCAN). It does not execute workflows, monitor behavior, or make decisions.

**Output:** Validation results indicating whether a workflow satisfies all invariants, with specific violation codes and remediation guidance.

---

## The Triad

**Definition:** The Triad is the architectural separation of sensing, authority validation, and execution into distinct, non-overlapping layers.

**Components:**
1. **Sensing layer:** Collects signals, observations, and recommendations (agent outputs)
2. **Authority layer:** Validates permissions and enforces governance constraints (kernel)
3. **Execution layer:** Performs operations with verified authority (external runtime)

**Separation constraints:**
- Sensing does not grant authority
- Authority validation does not execute operations
- Execution requires completed authority validation

**Purpose:** Prevents conflation of capability (can do), permission (may do), and action (did do).

**Governance Kernel role:** The kernel implements the authority layer. Sensing and execution are external responsibilities.

---

## Authority Conservation

**Definition:** Authority Conservation is the principle that total authority in the system equals the authority explicitly delegated by human root, regardless of the number of agents, operations, or system scale.

**Mathematical property:** If human root delegates authority A, then the sum of all executable authority in the system is ≤ A.

**Implications:**
- Adding agents does not increase authority
- Agent consensus does not amplify authority
- Capability scaling does not expand authority
- Multi-hop delegation conserves authority (A→B→C means C has authority from A, not new authority)

**Enforcement:**
- All delegations must trace to human root
- Self-delegation is rejected (authority cannot self-create)
- Circular delegation is rejected (authority cannot loop)
- Orphan delegation is rejected (authority cannot originate from unauthorized entities)

**Violation of conservation:** Any operation that executes with authority not traceable to human root violates conservation.

---

## Multi-Agent Context

**Definition:** Multi-Agent Context refers to workflows involving N > 1 agents with potentially overlapping or distinct authority grants.

**Governance properties:**
- Each agent is validated independently
- Agent signals do not combine to grant authority
- Adding agents does not weaken safety guarantees (MAG-1 property)
- Conflicts between agents trigger freeze, not resolution

**Authority in multi-agent systems:**
- Each agent has an explicit delegation defining its scope
- Operations are attributed to a specific executor (not "the team")
- No collective authority primitive exists
- No voting or consensus mechanisms grant authority

**Disagreement handling:** If agents produce conflicting recommendations or definitions, the system freezes. Algorithmic conflict resolution is not permitted.

**Adversarial tolerance:** The kernel assumes some agents may be adversarial. Adversarial agents cannot bypass authority constraints, self-authorize, or amplify their granted scope.

---

## Non-Claims (Explicit)

This kernel does **not** claim to:

1. **Solve AI alignment:** The kernel enforces structural constraints on workflows, not behavioral alignment of models.

2. **Guarantee runtime safety:** The kernel validates workflow definitions pre-execution. Runtime monitoring is external.

3. **Prevent all risks:** Some risks are inherent to AI systems and cannot be eliminated through structural validation.

4. **Authenticate humans:** The kernel assumes human approvals are legitimate. Authentication is an external responsibility.

5. **Optimize workflows:** The kernel enforces constraints. Workflow efficiency, agent coordination, and task optimization are out of scope.

6. **Detect adversarial agents:** The kernel detects violations, not adversaries. Identifying which agent is malicious is out of scope.

7. **Ensure liveness:** The kernel prioritizes safety over availability. Repeated violations may cause repeated freezes.

8. **Replace human judgment:** The kernel enforces rules defined by humans. It does not make governance decisions.

---

## Canonical Summary Statement

**Authority is permission, not capability, confidence, or consensus. Signals are information, not authority. Execution requires validated authority. Ambiguity triggers freeze, not guessing. The kernel governs workflows, not agents.**

Authority is explicit, conserved, and traceable. Adding agents increases scrutiny without increasing authority. The system halts on conflict rather than resolving algorithmically.

These properties are mechanically enforced through invariants (AIT-1, MOC, CPT-1, SBAA, Ω-SCAN). This is a validation layer, not an AI safety solution.
