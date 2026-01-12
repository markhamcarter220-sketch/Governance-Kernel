# Private Covenant

**This document is not required to run tests or use the Governance Kernel.**

---

## Purpose

This covenant records the foundational principles and design philosophy of the Governance Kernel. It serves as a record of intent for maintainers and contributors.

## Core Axioms

### Axiom 1: Authority is Ontologically Primary

Authority is not a property emergent from capability, optimization, or utility. It is a primitive that exists prior to any action. An agent may possess the technical capability to perform an operation, but this capability alone does not constitute authority.

**Implication**: All authority must be explicitly granted. There is no default authority. Silence is not consent.

### Axiom 2: Conservation of Authority

Authority is conserved in the same way energy is conserved in physics. It can be delegated (transferred) but not created. The ultimate source of authority in AI systems is human, and this authority can only flow downward through explicit delegation chains.

**Implication**: Any attempt to create authority (self-approval, circular delegation, emergent authority) violates this conservation law and must be rejected.

### Axiom 3: Freeze Dominates Guess

When ambiguity, conflict, or inconsistency arises, the system must freeze rather than make an inference about intent. Guessing at authority or interpreting ambiguous constraints is more dangerous than halting.

**Implication**: The freeze state is not a failure mode—it is the correct behavior in the presence of contradiction. Human intervention is required to resolve and restart.

### Axiom 4: Hard Constraints Are Inviolable

Optimization is subordinate to constraint satisfaction. No amount of utility, efficiency, or goal achievement justifies violating a hard constraint. Constraints represent the boundaries of acceptable behavior.

**Implication**: If a goal conflicts with a constraint, the goal must be rejected or rewritten. There is no trade-off.

## Design Philosophy

### Negative Space Architecture

The kernel is designed primarily by what it **prevents** rather than what it enables. The invariants define the boundaries of unacceptable behavior. Everything within those boundaries is permitted; everything outside is rejected.

This is intentional: we cannot enumerate all safe behaviors, but we can enumerate unsafe patterns.

### Transparency Over Cleverness

The kernel uses explicit pattern matching and rule-based validation rather than statistical inference or machine learning. Every violation is traceable to a specific rule. Every rule is documented and explainable.

This is intentional: governance must be auditable and deterministic.

### Public API, Private Covenant

The public API (library, CLI, HTTP) is stable and documented. This covenant is private—it records the "why" behind the "what". Users need not agree with or even read this covenant to use the kernel effectively.

This is intentional: principles guide design but do not burden users.

## Non-Goals

The Governance Kernel explicitly does NOT:

1. **Align AI**: It validates structures, not behaviors. An aligned model can produce unaligned workflows; an unaligned model can produce aligned workflows.

2. **Replace Human Judgment**: It enforces that human judgment is present and traceable, but does not evaluate the quality of that judgment.

3. **Guarantee Safety**: It prevents certain classes of authority violations but does not guarantee the absence of all risks. Security is multi-layered.

4. **Optimize Workflows**: It rejects unsafe workflows but does not suggest improvements or optimize for efficiency.

5. **Execute Workflows**: It is a static validator, not a runtime enforcement system. Integration with execution engines is the responsibility of the implementer.

## Evolution

This covenant may evolve as new attack patterns emerge or as our understanding of authority in AI systems deepens. Changes to this document should be rare and significant.

The public API and invariants should remain stable. Breaking changes require major version increments and extensive justification.

## Closing

Authority in AI systems is not a problem to be solved with better models or more data. It is a structural requirement that must be enforced at the design level. The Governance Kernel is one tool in that effort.

It is incomplete. It is imperfect. But it is explicit.

And explicit is better than implicit.

---

*Governance Kernel Contributors, January 2026*
