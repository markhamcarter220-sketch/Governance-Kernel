# CLI Reference

## Installation

```bash
pnpm install
pnpm build
```

The CLI is available as `pnpm gk` or directly via `node dist/cli/main.js`.

---

## Commands

### `gk verify <file>`

Verify a workflow JSON file against all governance invariants.

**Usage:**
```bash
gk verify <workflow.json> [--json]
```

**Options:**
- `--json`: Output results as JSON instead of formatted report

**Exit Codes:**
- `0`: Validation passed
- `1`: Error (file not found, invalid JSON, etc.)
- `2`: Validation failed (violations found)
- `3`: Freeze state (critical conflicts)

**Examples:**
```bash
# Verify a workflow
gk verify fixtures/workflows/pass_minimal.json

# Get JSON output
gk verify fixtures/workflows/fail_authority_leak.json --json
```

**Sample Output:**
```
============================================================
GOVERNANCE KERNEL VERIFICATION REPORT
============================================================

Status: ✓ PASS
Summary: Workflow validation PASSED. All invariants satisfied.
Total Violations: 0

============================================================
```

---

### `gk scan <file>`

Scan a text artifact (policy, prompt, documentation) for governance violations.

**Usage:**
```bash
gk scan <file> [--type <type>] [--json]
```

**Options:**
- `--type <type>`: Artifact type (policy, prompt, doc, etc.)
- `--json`: Output results as JSON

**Exit Codes:**
- `0`: Artifact is clean
- `1`: Error (file not found, etc.)
- `2`: Violations found

**Examples:**
```bash
# Scan a policy document
gk scan fixtures/docs/sample_policy.md --type policy

# Scan an agent prompt
gk scan fixtures/docs/sample_agent_prompt.txt --type prompt

# Get JSON output
gk scan governance.txt --type doc --json
```

**Sample Output (Clean):**
```
============================================================
Ω-SCAN ARTIFACT REPORT
============================================================

Artifact Type: policy
Status: ✓ CLEAN
Summary: Artifact (policy) passed Ω-SCAN validation

============================================================
```

**Sample Output (Violations):**
```
============================================================
Ω-SCAN ARTIFACT REPORT
============================================================

Artifact Type: prompt
Status: ✗ VIOLATIONS FOUND
Summary: Artifact (prompt) has 3 violation(s)

------------------------------------------------------------
VIOLATIONS
------------------------------------------------------------

[1] FAIL: OMEGA_IMPLICIT_AUTHORITY_IN_TEXT
    Message: Artifact contains implicit authority claim
    Location: line:15
    Remediation: Replace implicit authority with explicit human delegation or approval requirement
    Evidence: {
      "line_number": 15,
      "matched_text": "AI decides",
      "context": "The AI decides which action to take..."
    }
```

---

### `gk explain [code]`

Explain a violation code or list all available codes.

**Usage:**
```bash
gk explain [violation_code]
```

**Arguments:**
- `violation_code` (optional): Specific code to explain

**Examples:**
```bash
# List all codes and invariants
gk explain

# Explain a specific code
gk explain AIT1_IMPLICIT_AUTHORITY
gk explain MOC_DECISION_NOT_GATED
```

**Sample Output:**
```
AIT1_IMPLICIT_AUTHORITY:
AIT-1 Violation: Operation assumes authority without explicit delegation. Authority must be explicitly granted through a delegation chain from human_root.
```

**List Output:**
```
Usage: gk explain <VIOLATION_CODE>

Available violation codes:
  - AIT1_IMPLICIT_AUTHORITY
  - AIT1_MISSING_DELEGATION_PATH
  - MOC_DECISION_NOT_GATED
  - MOC_EXECUTION_NOT_GATED
  - CPT1_SEMANTIC_DRIFT
  - CPT1_TEMPORAL_STALE
  - CPT1_GOAL_CONSTRAINT_CONFLICT
  - SBAA_SPLIT_BRAIN
  - OMEGA_UNDEFINED_TERM_USED_IN_DECISION
  - OMEGA_IRREVERSIBLE_WITHOUT_SIGNOFF
  - OMEGA_IMPLICIT_AUTHORITY_IN_TEXT
  - SCHEMA_VALIDATION_ERROR

Invariant rules:
  AIT1: Authority Invariance Theorem
    Authority is explicit, typed, and conserved. No operation may execute without a valid authority path from human_root.
  MOC: MAP Operation Classifier
    Operations are classified as SUP/INT/EIN/DEC. DEC and EIN operations must be gated by explicit human authority.
  ...
```

---

### `gk help`

Display help information.

**Usage:**
```bash
gk help
gk --help
gk -h
```

---

## Integration Examples

### CI/CD Pipeline

```yaml
# .github/workflows/governance-check.yml
name: Governance Check
on: [push]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      - run: pnpm gk verify workflows/production.json
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

pnpm gk verify workflows/*.json || {
  echo "Governance validation failed!"
  exit 1
}
```

### Makefile

```makefile
.PHONY: verify scan

verify:
	pnpm gk verify workflows/*.json

scan:
	find docs -name "*.md" -exec pnpm gk scan {} --type policy \;
```
