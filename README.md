# Governance Kernel

**Authority Firewall for AI/Agent Workflows**

## What It Is

Governance Kernel is a validation and governance system for AI/agent workflows. It enforces hard constraints on authority, decision-making, and operation execution through a set of mathematical invariants.

**This is NOT an AI model.** It is a kernel that validates workflows/tools/agents against explicit governance rules.

## What It Isn't

- Not a permissions system (doesn't enforce at runtime)
- Not an AI safety alignment tool (validates structures, not behaviors)
- Not a model wrapper or inference layer
- Not a workflow execution engine

## Canonical Definitions

Core terms (authority, signal, freeze, execution, triad) are formally defined in [`CANONICAL_TERMS.md`](CANONICAL_TERMS.md). These definitions are binding for this repository and all related implementations. Terminology drift is a governance violation.

## Core Principles

1. **Capability ≠ Authority**: Just because an agent *can* do something doesn't mean it has authority to do it
2. **Hard Constraints Override Optimization**: Safety invariants are inviolable
3. **Freeze on Ambiguity**: When conflicts arise, the system freezes rather than guessing
4. **Explicit Authority Paths**: All authority must trace back to human root through explicit delegations

## Quick Start

### Installation

```bash
pnpm install
pnpm build
```

### CLI Usage

```bash
# Verify a workflow
pnpm gk verify fixtures/workflows/pass_minimal.json

# Scan an artifact for governance violations
pnpm gk scan fixtures/docs/sample_policy.md --type policy

# Explain a violation code
pnpm gk explain AIT1_IMPLICIT_AUTHORITY
```

### Library Usage

```typescript
import { verifyWorkflow, scanArtifact } from 'governance-kernel';

const result = verifyWorkflow(workflowJson);
if (!result.valid) {
  console.log(result.violations);
}

const scanResult = scanArtifact(policyText, 'policy');
if (!scanResult.clean) {
  console.log(scanResult.violations);
}
```

### HTTP Server

```bash
pnpm server
# Server runs on http://localhost:3000

# POST /verify - verify a workflow
# POST /scan - scan an artifact
```

## Core Invariants

The kernel enforces these invariants:

### AIT-1: Authority Invariance Theorem
- Authority is explicit, typed, and conserved
- No operation executes without a valid authority path from human root
- Authority must be delegated, not assumed

### MOC: MAP Operation Classifier
- Operations classified as: SUP (Support), INT (Interpretation), EIN (Execution), DEC (Decision)
- DEC and EIN operations must be gated by human approval
- Irreversible operations require explicit signoff

### CPT-1: Coherence Preservation Theorem
- Enforces Goal, Constraint, Semantic, and Temporal invariants
- Detects contradictions between goals and constraints
- Prevents modification of locked definitions
- Validates temporal bounds

### SBAA: Split-Brain Authority Axiom
- Authority must be singular and unambiguous
- Conflicting authority sources trigger freeze
- No circular or redundant authority chains

### Ω-SCAN: Legitimacy Gate
- Pre-checks artifacts (policies, prompts, docs)
- Rejects implicit authority claims
- Flags undefined terms in decision contexts
- Requires signoff for irreversible actions

## What This Kernel Guarantees

The following properties are **mechanically enforced**, not heuristic:

### Authority Guarantees
✓ **No implicit authority**: Every operation has an explicit delegation path from human root
✓ **No circular delegation**: Authority chains are acyclic (A→B→A is impossible)
✓ **No self-delegation**: Entities cannot grant authority to themselves
✓ **No orphan delegation**: All delegations trace to a valid authority source
✓ **Scope enforcement**: Operations must be within granted scope
✓ **Temporal enforcement**: Expired delegations are rejected

### Coherence Guarantees
✓ **No silent definition changes**: Locked definitions cannot be modified without version update
✓ **Definition hash stability**: Definition drift is detected via cryptographic hashing
✓ **Goal-constraint conflict detection**: Contradictory optimization goals and hard constraints trigger freeze
✓ **Temporal validity**: Stale workflows and expired grants are rejected

### Freeze Guarantees
✓ **Freeze dominates fail**: Critical violations always freeze before execution
✓ **Unambiguous conflicts halt execution**: Split-brain authority, circular delegation, and semantic drift freeze the system
✓ **Human review required**: Frozen workflows require explicit `unfreeze_token` to proceed

### Classification Guarantees
✓ **DEC operations require approval**: Decision operations without human signoff are rejected
✓ **EIN operations require approval**: Irreversible execution operations without approval are rejected
✓ **Tool signoff enforcement**: Operations using tools marked `requires_human_signoff` must have approval

### What This Kernel Does NOT Guarantee

✗ **Runtime enforcement**: The kernel validates workflow structures, it does not monitor execution
✗ **Behavioral alignment**: A valid workflow structure does not guarantee aligned behavior
✗ **Security against all attacks**: This is one layer; defense-in-depth requires multiple layers
✗ **Correctness of human decisions**: Human approvals are assumed to be legitimate
✗ **Prevention of all risks**: Some risks are inherent to AI systems and cannot be structurally prevented

The kernel makes certain classes of authority violations **structurally impossible** at the workflow level. It does not solve all AI governance problems.

## Multi-Agent Safety & Scalability (MAG-1)

This kernel satisfies a formally defined property called **MAG-1** (Multi-Agent Governance Strengthening), which establishes that adding agents to a workflow does not weaken safety guarantees.

**Key Properties:**
- **Authority is conserved**: Total authority in the system equals the authority delegated by human root, regardless of the number of agents
- **Signals ≠ permission**: Agent recommendations, proposals, or votes are informational only and do not grant execution authority
- **Disagreement triggers freeze, not resolution**: When agents conflict on authority or definitions, the system freezes rather than attempting algorithmic resolution

**Scalability Guarantee:**
Adding agents increases scrutiny (more potential detectors of violations) without increasing irreversible-action risk. An N-agent workflow is at least as safe as a 1-agent workflow with the same authority grants.

**Adversarial Tolerance:**
Adversarial agents are explicitly allowed in the threat model. A compromised agent cannot:
- Self-authorize operations outside its granted scope
- Delegate authority it does not possess
- Modify locked definitions
- Bypass human approval requirements

The system degrades to freeze (safe halt) rather than degrading to unauthorized execution.

**Reference:** This property is defined in the White Paper Library under MAG-1 (Multi-Agent Governance) and MAG-1A (Authority Conservation). See [`docs/public/MAG1_IMPLEMENTATION.md`](docs/public/MAG1_IMPLEMENTATION.md) for implementation details.

## Exit Codes

- `0` - Pass (validation successful)
- `1` - Error (file not found, parse error, etc.)
- `2` - Violations (validation failed)
- `3` - Freeze (critical conflicts detected)

## Examples

See `docs/public/EXAMPLES.md` for detailed examples and `fixtures/` for sample workflows.

## Documentation

- [Core Concepts](docs/public/CONCEPTS.md)
- [Invariants Reference](docs/public/INVARIANTS.md)
- [Invariant Coverage Map](docs/public/INVARIANT_COVERAGE.md)
- [Authority Flow Tracing](docs/public/AUTHORITY_FLOW.md)
- [MAG-1 Implementation](docs/public/MAG1_IMPLEMENTATION.md)
- [JSON Schemas](docs/public/JSON_SCHEMAS.md)
- [CLI Reference](docs/public/CLI.md)
- [HTTP API](docs/public/HTTP_API.md)
- [Examples](docs/public/EXAMPLES.md)

## Running Tests

```bash
pnpm test
```

Tests cover:
- All invariants (AIT-1, MOC, CPT-1, SBAA, Ω-SCAN)
- Freeze protocol
- CLI commands
- Fixture validation

## License

MIT License - See LICENSE file for details

## Philosophy

Authority in AI systems must be:
- **Explicit** (never implicit or inferred)
- **Conserved** (can be delegated but not created)
- **Traceable** (clear path from human root)
- **Bounded** (scoped and time-limited)

This kernel enforces these properties at the workflow definition level, making governance violations impossible to deploy.
