
# RIO — Receipt Protocol for Verifiable AI Actions

A minimal system that ensures AI actions execute exactly as approved—and proves it.

---

## Run it in 30 seconds

node demo.js

You will see:

- valid action → ALLOW
- modified action → BLOCK
- tampered receipt → FAIL

---

## Core Invariant

Nothing executes unless it exactly matches what was approved at the moment of execution—and that fact is provable.

---

## What This Is

This repository provides:

- a minimal reference implementation
- a deterministic validation layer
- a cryptographic receipt + verification system

It demonstrates how to:

- enforce exact-match execution
- prevent silent or altered actions
- produce independently verifiable proof

---

## System Model

Language → Intent → Approval → Validation → Execution → Receipt → Verification

---

## Real Example — Controlled Action (Email)

RIO can be placed directly in front of real actions.

Intent:

{
  "action": "send_email",
  "target": "finance@company.com",
  "parameters": {
    "subject": "Q2 Report",
    "body": "See attached report."
  }
}

Behavior:

- No approval → blocked
- Approved + exact match → executes
- Any change → blocked

Result:

Only the approved action runs, and the outcome is verifiable.

---

## How to Use This in Your System

To apply this pattern:

1. Structure intent into explicit, machine-readable form
2. Require explicit approval before execution
3. Validate execution against the approved intent
4. Execute only if validation passes
5. Generate a receipt after execution
6. Verify receipts independently

The pattern:

intent → approval → validation → execution → receipt → verification

See a simple example:

/examples/integration/

---

## Next Step — Beyond This Repo

This repository demonstrates execution and proof.

To build a complete system, you will need:

- an approval layer (human-in-the-loop)
- a gateway to enforce execution boundaries
- a policy layer for constraints and risk

This repository intentionally stops at execution and verification.

---

## Where the Invariant Is Enforced

The invariant is enforced at validation before execution.

intent
→ approval
→ validation
→ execution
→ receipt
→ verification

Validation ensures:

- execution input matches approved intent
- context and scope are unchanged
- action is permitted

If any check fails:

→ execution is blocked

---

## Repository Structure

demo.js                     ← one-command demo

generate_receipt.js         ← receipt generation
verify_receipt.js           ← verification
test_tamper.js              ← tamper detection

examples/
  valid_receipt.json
  denied_receipt.json

examples/integration/
  send_email_example.md

verifier/
  index.html
  verify.js

spec/
  rio-overview.md
  execution-validation-layer.md
  rasmussen-construction.md
  delegated-representation-layer-v1.md
  BONDI_*.md

docs/
  SECURITY_SUMMARY.md

---

## Dependencies

None. Uses only Node.js built-in crypto module.

---

## License

MIT

---

## One Line

If it changes, it doesn’t run.
If it runs, you can prove it.