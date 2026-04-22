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
