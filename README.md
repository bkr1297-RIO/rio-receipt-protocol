# RIO — Receipt Protocol for Verifiable AI Actions

> **Classification C — Local Receipt Engine Prototype**
>
> A local, zero-dependency receipt engine for creating, signing, appending, and verifying receipts for governed AI/software actions.

No account required. No cloud dependency. No hidden agent action. Runs locally on your machine.

---

## 60-Second Quickstart

> **Important:** You must run `npm run init` first. The repo ships without generated local state — no keypair, no ledger, no unit config. Init creates everything you need.

```bash
git clone https://github.com/bkr1297-RIO/rio-receipt-protocol.git
cd rio-receipt-protocol
npm run init -- --owner "human:your-name"
npm test
npm run demo
npm run verify-chain
```

**What you will see:**

| Command | Result |
|---------|--------|
| `npm run init` | Creates your local identity, keypair, and empty ledger |
| `npm test` | 21/21 tests pass (6 tamper + 15 chain) |
| `npm run demo` | 2 receipts created (1 ALLOW + 1 BLOCK), ledger VALID |
| `npm run verify-chain` | Full ledger chain verification → CHAIN VALID |

That's it. No install beyond Node.js 18+. No npm dependencies. No network calls.

---

## How It Works

```
init local unit
  → generate keypair
    → create signed receipt
      → append to ledger
        → verify chain
```

1. **Init** — `mus-init.js` creates a local MUS Unit: unit ID, Ed25519 keypair, trusted keys, empty ledger, nonce store.
2. **Receipt** — `generate_receipt.js` validates intent vs. execution, creates a signed receipt with hash, signature, and chain link.
3. **Ledger** — `ledger.js` appends the receipt to a local JSONL file with `receipt_hash` and `previous_receipt_hash`.
4. **Verify** — `verify-chain.js` walks the full chain, checking every hash, signature, chain link, and trust anchor.

---

## Core Invariant

Nothing executes unless it exactly matches what was approved at the moment of execution — and that fact is provable.

---

## What This Proves

This repo currently demonstrates and verifies:

| Capability | How |
|------------|-----|
| Local identity/keypair initialization | `mus-init.js` creates Ed25519 keypair per user |
| Ed25519 signed receipts | Every receipt carries a signature and public key |
| Local hash-chain ledger | Append-only JSONL with `receipt_hash` → `previous_receipt_hash` linkage |
| Ledger chain verification | `verify-chain.js` validates every link |
| Tamper detection | Modified receipt body → hash mismatch → FAIL |
| Deletion detection | Missing chain entry → broken link → FAIL |
| Reorder detection | Wrong `previous_receipt_hash` → FAIL |
| Untrusted-key detection | Receipt signed by unknown key → REJECTED |
| Replay prevention | Reused nonce → BLOCKED |
| Zero external services required | No dependencies, no network calls, no accounts |

---

## What This Does Not Do Yet

This repo is the **proof layer only**. It does not include:

- the full ONE product (human-facing governed operating environment)
- production enforcement or runtime governance
- policy evaluation or risk assessment
- Brian Shield (content governance evaluator)
- email/scanner integration
- a complete Portable MUS Unit
- legal or compliance certification

These belong to the broader RIO/ONE/MUSS system, which is separate from this repository.

---

## Current Verified Status

| Field | Value |
|-------|-------|
| Classification | **C — Local Receipt Engine Prototype** |
| Status | `verified_on_main` |
| PR | #2 merged |
| Tests | 21/21 passing |
| Demo | 2 receipts — 1 ALLOW + 1 BLOCK |
| Ledger | Verifies VALID |
| Dependencies | Zero |
| Network calls | Zero |

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

## RIO Portable Kit Context

This repo is the **Proof layer** of the broader RIO Portable Kit. The Source Pack carries context; this repo carries proof.

> **The protocol proves the grammar. The Local Receipt Engine makes the grammar portable.**

For the full kit (Purpose + Meaning + Proof), see the RIO Portable Kit.

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

## Tests

```bash
# Run all tests (requires init first)
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
