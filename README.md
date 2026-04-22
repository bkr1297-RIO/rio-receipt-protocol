# RIO Receipt Protocol

A minimal, complete, verifiable system that proves:

- No action executes unless it exactly matches what was approved
- Invalid or altered actions are blocked
- All outcomes produce verifiable, tamper-evident receipts

---

## What This Is

This repository contains:

- a protocol specification
- a reference implementation
- a verification system

It is a standard, a proof system, and a reference implementation.

---

## Core Invariant

Nothing executes unless it exactly matches what was approved at the moment of execution — and that fact is provable.

---

## System Model

```
Language → Intent → Approval → Validation → Execution → Receipt → Verification
```

---

## Quick Start

```bash
# Generate receipts (valid + denied)
node generate_receipt.js

# Verify a receipt
node verify_receipt.js examples/valid_receipt.json

# Test tamper detection
node test_tamper.js
```

See [VERIFY_THIS_SYSTEM.md](VERIFY_THIS_SYSTEM.md) for the full walkthrough.

---

## Real Example — Controlled Action (Email)

RIO can be placed directly in front of real actions.

Example: sending an email.

### Intent

```json
{
  "action": "send_email",
  "target": "finance@company.com",
  "parameters": {
    "subject": "Q2 Report",
    "body": "See attached report."
  }
}
```

### Behavior

- No approval → blocked
- Approved + exact match → executes
- Any change → blocked

### Result

RIO ensures only the approved action runs and produces a verifiable receipt.

### Minimal Integration Pattern

```
intent → approval → validation → execute → receipt
```

Replace "execute" with your own system:

- send email
- call API
- move funds
- trigger workflow

### Key Property

If the action changes, it does not run.
If it runs, it can be proven.

---

## Where the Invariant Is Enforced

The core invariant is enforced at the validation step before execution.

Flow:

```
intent
→ approval
→ validation
→ execution
→ receipt
→ verification
```

Validation enforces that:

- the execution input exactly matches the approved intent
- the context and scope are unchanged
- the action is permitted

If any check fails:

→ execution is blocked

Only after validation passes:

→ execution occurs
→ a receipt is generated
→ the outcome can be independently verified

This is where the invariant holds:

**Nothing executes unless it exactly matches what was approved.**

---

## Repository Structure

```
generate_receipt.js          ← generates valid + denied receipts
verify_receipt.js            ← verifies receipt integrity
test_tamper.js               ← demonstrates tamper detection

examples/
  valid_receipt.json         ← ALLOW case
  denied_receipt.json        ← BLOCK case (drift)

verifier/
  index.html                 ← browser-based verifier
  verify.js                  ← browser verification logic

spec/
  rio-overview.md
  execution-validation-layer.md
  rasmussen-construction.md
  delegated-representation-layer-v1.md
  BONDI_ROUTING_ENGINE_v1.0.md
  BONDI_AUTHORITY_BOUNDARY_v1.0.md
  BONDI_RUNTIME_SPINE_v1.0.md
  BONDI_PACKET_SCHEMAS_v1.0.md

docs/
  SECURITY_SUMMARY.md
```

---

## Naming

- **Execution Validation Layer** — ensures execution matches approved intent
- **Rasmussen Receipt Construction** — canonical method for building receipts

---

## Dependencies

None. Uses only Node.js built-in `crypto` module.

---

## License

MIT
