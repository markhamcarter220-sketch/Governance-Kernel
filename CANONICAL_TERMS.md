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

### Scope Semantics

**Wildcard scope (`["*"]`):** Grants authority for all operation types. The wildcard matches any operation the executor performs.

**Specific scopes (`["read", "write"]`):** Grants authority only for the listed operation types. Operations outside the scope are rejected.

**Scope validation:** When an operation is executed, its type (e.g., `"deploy"`, `"execute"`, `"propose"`) must either:
- Be explicitly listed in the executor's delegation scope, OR
- Be covered by a wildcard `"*"` in the scope

**Multi-hop delegation scope:** When authority is delegated across multiple hops (A→B→C), the effective scope is the **intersection** of all scopes in the chain. If A delegates `["*"]` to B and B delegates `["read"]` to C, then C has `["read"]` authority, not `["*"]`.

**Contradictory scopes:** If an entity has multiple delegations with conflicting scopes (e.g., one grants `["*"]` and another grants specific actions), this triggers a FREEZE violation (`SBAA_CONTRADICTORY_DELEGATION`).

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

### Signal vs. Operation (Architectural Distinction)

**Signals are agent outputs.** When an agent runs, it produces signals: recommendations, analysis results, confidence scores, proposed actions. These are informational outputs.

**Operations are workflow structures.** The workflow JSON contains Operations, which are validated by the kernel. Operations specify an executor, type, and required approvals.

**The kernel validates Operations, not signals.** The kernel does not see or validate agent outputs directly. It validates the structural definition of what operations are permitted and whether they have proper authority.

**Workflow creation:** Signals may inform the creation of workflow Operations (e.g., an agent recommends an action, a human translates that into an Operation with approval), but signals do not directly become Operations. The translation from signal to Operation is external to the kernel.

**Example:**
- Agent outputs signal: `{"recommendation": "deploy v2.0", "confidence": 0.95}`
- Human or system creates Operation: `{"id": "op1", "type": "deploy", "executor": "deploy_agent", "approved_by": "admin@example.com"}`
- Kernel validates Operation structure and authority

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

## System Boundary & Trust Model

**Definition:** The System Boundary defines what the kernel validates versus what external systems must provide or verify.

### What the Kernel Validates (In Scope)

The kernel mechanically validates:
- **Authority path existence:** Does a delegation chain exist from human root to executor?
- **Authority path validity:** Is the chain acyclic, non-self-referential, and non-orphaned?
- **Scope coverage:** Does the delegation scope cover the operation type?
- **Temporal validity:** Are all delegations and the workflow itself within valid time bounds?
- **Operation gating:** Do DEC/EIN operations have required approval flags set?
- **Coherence:** Are goals, constraints, and definitions internally consistent?
- **Structural integrity:** Does the workflow conform to JSON schema?

### What External Systems Must Provide (Out of Scope)

The kernel **does not** validate:
- **Human identity or authentication:** `approved_by` fields are checked for presence, not authenticity
- **Token authenticity:** `unfreeze_token` values are checked for presence, not cryptographic validity
- **Tool correctness:** Tool definitions (`irreversible`, `requires_human_signoff`) are trusted at face value
- **Agent behavior:** Agent actions at runtime are not monitored
- **Workflow provenance:** Who created the workflow or when it was submitted
- **Execution enforcement:** Whether operations actually respect authority at runtime

### Trust Assumptions

The kernel operates under these trust assumptions:

1. **Workflow JSON integrity:** The workflow structure has not been tampered with between submission and validation
2. **Tool definitions are accurate:** Tools marked `irreversible=true` are actually irreversible
3. **Human approvers are authenticated externally:** The system presenting the workflow has verified `approved_by` identities
4. **Unfreeze tokens are issued by authorized humans:** Token generation is handled by an external authority system
5. **Execution layer respects validation:** Systems that execute workflows will not bypass validation results

**Threat model:** The kernel assumes adversarial agents within the workflow but trusted infrastructure (workflow storage, validation invocation, execution layer). If infrastructure is compromised, kernel guarantees do not hold.

---

## External Validation Responsibilities

**Definition:** Certain validation steps are explicitly external to the kernel and must be performed by integrating systems.

### approved_by Field Validation

**What the kernel checks:**
- `approved_by` field is present when `requires_approval=true`
- `approved_by` is a non-empty string

**What the kernel does NOT check:**
- Whether `approved_by` is a real human identifier
- Whether the approver has authority to approve this specific operation
- Whether the approval was given recently or is stale
- Whether the approval includes a cryptographic signature

**External responsibility:** The system integrating the kernel must:
- Authenticate the identity in `approved_by` before accepting the workflow
- Verify the approver has authority to grant approval (e.g., matches `authority_map.root` or is an authorized delegate)
- Optionally require cryptographic signatures or timestamps for approvals

### unfreeze_token Validation

**What the kernel checks:**
- `unfreeze_token` field is present (allows frozen workflows to pass validation)

**What the kernel does NOT check:**
- Whether the token is a valid secret, signature, or human identifier
- Whether the token was issued by an authorized human
- Whether the token is expired or has been revoked

**External responsibility:** The system integrating the kernel must:
- Generate `unfreeze_token` values through a secure process (e.g., human review portal)
- Validate tokens before adding them to frozen workflows
- Maintain a registry of valid/revoked tokens
- Optionally include signatures or expiry metadata in tokens

### Tool Definition Validation

**What the kernel checks:**
- Tools referenced by operations exist in `workflow.tools`
- Tools marked `requires_human_signoff=true` have corresponding operation approvals

**What the kernel does NOT check:**
- Whether a tool is actually irreversible
- Whether a tool's side effects match its declaration
- Whether a tool has been backdoored or compromised

**External responsibility:** The system integrating the kernel must:
- Maintain a curated, audited registry of tool definitions
- Verify tool behavior matches declarations before adding to registry
- Monitor tools for behavioral changes or supply chain attacks

**Recommendation:** Use a separate tool validation layer before tools are added to workflows.

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
