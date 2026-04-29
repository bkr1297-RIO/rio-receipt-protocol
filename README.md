# RIO — Receipt Protocol for Verifiable AI Actions

A minimal system that ensures AI actions execute exactly as approved — and proves it.

No account required. No cloud dependency. No hidden agent action. Runs locally on your machine.

---

## Run it in 30 seconds

```bash
npm run init -- --owner "human:your-name"
npm run demo
```

You will see:

- valid action → ALLOW
- modified action → BLOCK
- tampered receipt → FAIL
- ledger chain → VALID

---

## Core Invariant

Nothing executes unless it exactly matches what was approved at the moment of execution — and that fact is provable.

---

## What This Is

This repository provides:

- a minimal reference implementation
- a deterministic validation layer
- a cryptographic receipt + verification system
- a persistent hash-chain ledger
- a local identity and keypair system

It demonstrates how to:

- enforce exact-match execution
- prevent silent or altered actions
- produce independently verifiable proof
- chain receipts into a tamper-evident ledger
- initialize a portable local receipt engine

---

## System Model

Language → Intent → Approval → Validation → Execution → Receipt → Ledger → Verification

---

## Quick Start

```bash
# 1. Initialize your local MUS Unit
npm run init -- --owner "human:your-name"

# 2. Run the demo (creates receipts, appends to ledger, verifies chain)
npm run demo

# 3. Verify the ledger hash chain
npm run verify-chain

# 4. Run all tests
npm test
```

That's it. No install beyond Node.js 18+. No npm dependencies. No network calls.

---

## What Happens When You Run It

### `npm run init`

Creates your local identity and storage:
- Generates an Ed25519 keypair (your signing identity)
- Creates a unit ID (your local MUS Unit identifier)
- Initializes an empty hash-chain ledger
- Sets up nonce tracking (prevents replay attacks)

### `npm run demo`

Demonstrates the full receipt loop:
1. Creates a valid intent (send_email to colleague)
2. Validates execution matches intent → ALLOW
3. Creates a drifted execution (target changed) → BLOCK
4. Signs both receipts with your local key
5. Appends both to the hash-chain ledger
6. Verifies each receipt individually
7. Verifies the full ledger chain

### `npm run verify-chain`

Reads the ledger and checks:
- Every receipt hash is correct (no tampering)
- Every signature is valid (signed by trusted key)
- Every chain link is intact (no deletions or reordering)
- Every public key is in the trusted set

---

## Real Example — Controlled Action (Email)

RIO can be placed directly in front of real actions.

Intent:

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

intent → approval → validation → execution → receipt → ledger → verification

---

## How the Receipt Protocol Works

### Receipt Fields

Every receipt contains:

| Field | Purpose |
|-------|---------|
| `receipt_id` | Unique identifier (UUID) |
| `timestamp` | ISO 8601 creation time |
| `intent_hash` | SHA-256 of the canonical intent |
| `execution_hash` | SHA-256 of what actually executed |
| `mus_unit_id` | Local unit that produced this receipt |
| `validation.decision` | ALLOW or BLOCK |
| `validation.checks` | Which checks passed/failed |
| `approval.authorizer` | Who authorized (e.g., "human:brian") |
| `approval.nonce` | One-time use token (prevents replay) |
| `chain_reference.previous_receipt_hash` | Link to previous receipt |
| `receipt_hash` | SHA-256 of canonical receipt body |
| `signature` | Ed25519 signature over receipt body |
| `public_key` | Signer's public key (for verification) |

### Validation Checks

The engine performs four checks before issuing a receipt:

1. **intent_match** — Does execution match the approved intent?
2. **context_match** — Does the approval reference the correct intent?
3. **scope_valid** — Is the action within the approved scope?
4. **execution_path_valid** — Is the action type in the allowed set?

If ANY check fails → BLOCK. Fail-closed by design.

### Hash Chain

Each receipt links to the previous via `previous_receipt_hash`. This creates an append-only chain where:
- Deletion is detectable (chain link breaks)
- Modification is detectable (hash mismatch)
- Reordering is detectable (previous_hash mismatch)
- Insertion is detectable (signature fails)

---

## Security Properties

| Property | Mechanism |
|----------|-----------|
| Integrity | SHA-256 hash of canonical receipt body |
| Authenticity | Ed25519 signature over receipt body |
| Non-repudiation | Signature ties receipt to specific keypair |
| Replay prevention | One-time nonces, tracked and rejected on reuse |
| Tamper evidence | Hash chain links every receipt to its predecessor |
| Trust boundary | Only receipts signed by trusted keys pass verification |
| Fail-closed | Any validation failure → BLOCK, never silent pass |

---

## Where the Invariant Is Enforced

The invariant is enforced at validation before execution.

```
intent → approval → validation → execution → receipt → verification
```

Validation ensures:

- execution input matches approved intent
- context and scope are unchanged
- action is permitted

If any check fails:

→ execution is blocked

---

## Repository Structure

```
package.json                ← Scripts and metadata
mus-init.js                 ← Initialize a local MUS Unit
demo.js                     ← Full receipt loop demonstration
generate_receipt.js         ← Receipt generation (legacy + unit-aware)
verify_receipt.js           ← Single receipt verification
verify-chain.js             ← Full ledger chain verification
ledger.js                   ← Append-only hash-chain ledger module
test_tamper.js              ← Tamper detection tests (6 cases)
test_chain.js               ← Chain verification tests (7 cases)

config/
  mus-unit.json             ← Your local unit config (created by init)

trust/
  signing_key.json          ← Your Ed25519 keypair (created by init)
  trusted_keys.json         ← Trusted public keys

runtime/
  nonce_store.json          ← Used nonces (replay prevention)
  verified_nonces.json

ledger/
  ledger.jsonl              ← Hash-chain receipt ledger (append-only)

examples/
  valid_receipt.json
  denied_receipt.json

verifier/
  index.html                ← Browser-based verifier
  verify.js                 ← Browser verification logic

spec/                       ← Protocol specifications
docs/                       ← Security and architecture docs
adapters/                   ← Action adapters (send_email)
scripts/                    ← Demo scripts
```

---

## Extension Points

This engine is designed to be extended. The following are documented but not yet implemented:

- **v0.2 policy rules** — Additional governance rules can be loaded from policy JSON files
- **Network sync** — Ledger entries can be replicated to a remote store
- **Multi-unit federation** — Multiple MUS Units can cross-verify each other's chains
- **Policy engine integration** — Connect to the Brian Shield evaluator for content-aware governance

---

## Next Step — Beyond This Repo

This repository demonstrates execution, proof, and local persistence.

To build a complete system, you will need:

- an approval layer (human-in-the-loop)
- a gateway to enforce execution boundaries
- a policy layer for constraints and risk

This repository intentionally stops at execution, verification, and local ledger.

---

## Classification

This repo is classified as **C — Local Receipt Engine Prototype**:
- Can initialize a local MUS Unit ✓
- Can generate a local keypair ✓
- Can create signed receipts ✓
- Can append to a hash-chain ledger ✓
- Can verify individual receipts ✓
- Can verify the full chain ✓
- Runs fully locally with no network calls ✓
- Is user-agnostic (any owner handle works) ✓

---

## Tests

```bash
# Run all tests
npm test

# Run only tamper detection tests (6 cases)
node test_tamper.js

# Run only chain verification tests (7 cases, 15 assertions)
node test_chain.js
```

All tests use isolated temporary data and do not modify the real ledger.

---

## Requirements

- Node.js 18+ (uses built-in `crypto` with Ed25519 support)
- No npm dependencies (zero `node_modules`)
- Works on macOS, Linux, Windows

---

## License

MIT

---

## One Line

If it changes, it doesn't run.
If it runs, you can prove it.
