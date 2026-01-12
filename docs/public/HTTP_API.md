# HTTP API Reference

## Starting the Server

```bash
pnpm server

# Custom port
PORT=8080 pnpm server

# Custom host
HOST=127.0.0.1 PORT=8080 pnpm server
```

Default: `http://0.0.0.0:3000`

---

## Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "governance-kernel"
}
```

**Status Code:** `200`

---

### POST /verify

Verify a workflow JSON object.

**Request Body:**
```json
{
  "workflow": {
    "version": "1.0",
    "agents": [...],
    "tools": [...],
    "authority_map": {...},
    "operations": [...],
    "constraints": [...],
    "timestamps": {...}
  }
}
```

**Response (Success):**
```json
{
  "valid": true,
  "violations": [],
  "summary": "Workflow validation PASSED. All invariants satisfied."
}
```

**Status Code:** `200`

**Response (Violations):**
```json
{
  "valid": false,
  "violations": [
    {
      "code": "MOC_DECISION_NOT_GATED",
      "severity": "fail",
      "message": "Decision operation \"op1\" is not properly gated by human approval",
      "path": "/operations/0",
      "evidence": {
        "operation_id": "op1",
        "classification": "DEC",
        "requires_approval": false,
        "approved_by": null
      },
      "remediation": "Set requires_approval=true and provide approved_by field for operation \"op1\""
    }
  ],
  "summary": "Workflow validation FAILED with 1 critical violation(s) and 0 warning(s)."
}
```

**Status Code:** `422 Unprocessable Entity`

**Response (Freeze):**
```json
{
  "valid": false,
  "violations": [
    {
      "code": "SBAA_SPLIT_BRAIN",
      "severity": "freeze",
      "message": "Multiple authority sources detected...",
      "path": "/authority_map/delegations",
      "evidence": {...},
      "remediation": "..."
    }
  ],
  "freeze": {
    "frozen": true,
    "reason": "SBAA_SPLIT_BRAIN: Multiple authority sources detected...",
    "violations": [...]
  },
  "summary": "Workflow FROZEN due to critical violations. 1 freeze-level issue(s) detected."
}
```

**Status Code:** `409 Conflict`

**Error Response:**
```json
{
  "error": "Bad Request",
  "message": "Missing workflow in request body"
}
```

**Status Code:** `400`

---

### POST /scan

Scan a text artifact for governance violations.

**Request Body:**
```json
{
  "text": "The AI decides whether to approve requests...",
  "type": "policy"
}
```

**Response (Clean):**
```json
{
  "artifact_type": "policy",
  "violations": [],
  "clean": true,
  "summary": "Artifact (policy) passed Ω-SCAN validation"
}
```

**Status Code:** `200`

**Response (Violations):**
```json
{
  "artifact_type": "prompt",
  "violations": [
    {
      "code": "OMEGA_IMPLICIT_AUTHORITY_IN_TEXT",
      "severity": "fail",
      "message": "Artifact contains implicit authority claim",
      "path": "line:15",
      "evidence": {
        "line_number": 15,
        "matched_text": "AI decides",
        "context": "The AI decides which action to take..."
      },
      "remediation": "Replace implicit authority with explicit human delegation or approval requirement"
    }
  ],
  "clean": false,
  "summary": "Artifact (prompt) has 1 violation(s)"
}
```

**Status Code:** `422 Unprocessable Entity`

**Error Response:**
```json
{
  "error": "Bad Request",
  "message": "Missing text in request body"
}
```

**Status Code:** `400`

---

## Usage Examples

### cURL

```bash
# Health check
curl http://localhost:3000/health

# Verify workflow
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d @fixtures/workflows/pass_minimal.json

# Scan artifact
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The AI decides to approve requests automatically.",
    "type": "policy"
  }'
```

### JavaScript/Node

```javascript
const response = await fetch('http://localhost:3000/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ workflow: workflowObject })
});

const result = await response.json();
if (!result.valid) {
  console.error('Violations:', result.violations);
}
```

### Python

```python
import requests

response = requests.post('http://localhost:3000/verify',
  json={'workflow': workflow_dict})

result = response.json()
if not result['valid']:
    print('Violations:', result['violations'])
```

---

## Notes

- No authentication required (development server)
- CORS enabled by default (Fastify default)
- JSON input only
- Server logs to stdout (configurable via `LOG_LEVEL` env var)
- Graceful shutdown on SIGINT/SIGTERM
