# RIO Receipt Protocol

**A bounded receipt layer for governed-action records.**

This repository is a local receipt-engine prototype. It creates, signs, and verifies tamper-evident records representing supplied authorization data, local validation results, reported execution data, and ledger linkage. Receipt integrity does not independently establish that external execution occurred or that the supplied authority was lawful.

> This is **part of the RIO system**, not the entire system. It handles proof. Other repositories handle governance, observation, and interface.

---

## What RIO Is

RIO is a governed execution layer for AI systems. It sits between intelligent systems and real-world actions, ensuring that important actions cannot execute without authorization, policy checks, verification, and proof. Different repositories implement different parts of the system, including governance, receipts, observation, and interface layers.

**The short version:**

- AI proposes.
- Humans approve when required.
- RIO governs execution.
- Receipts preserve a signed, locally verifiable account of what the engine was told and checked.

---

## What This Repository Contains

A self-contained, zero-dependency receipt engine that demonstrates:

- Creating cryptographically signed receipts for every governed action
- Appending receipts to a hash-chained ledger (tamper-evident)
- Verifying the full chain locally (no network or accounts; verification still relies on the configured trust registry and any external checkpoints required by the claim)
- Detecting tampering, deletion, reordering, and replay attacks

**Classification:** C — Local Receipt Engine Prototype
**Core dependencies:** Zero Node packages (Node.js 18+ built-in crypto only)
**Vesper closure fixture:** Python 3.11+ and `cryptography`
**Network calls:** Zero

---

## Bounded Vesper Occurrence-to-Return Specimen

The repository also composes the existing Vesper synthetic route with the
same receipt core used by the local engine. It persists distinct Attempt,
Occurrence, Observation, Evidence, Receipt, Settlement, Return, and
Acknowledgement artifacts, then asks a fresh process to reconstruct the
episode against producer-emitted MUS-ledger and Return-journal heads handed to
a newly started verifier. This models retained checkpoints; it is not an
externally governed checkpoint service.

```bash
npm run test:occurrence-return
npm run closure:vesper
```

A passing run establishes only a closed local synthetic zero-egress fixture
lineage ending `RETURNED_UNPROMOTED`. It does not establish live human
authority, an external occurrence or outcome, production security,
succession, federation, or Human Return. See
[`docs/conformance/VESPER_OCCURRENCE_RETURN_CLOSURE_v0.1.md`](docs/conformance/VESPER_OCCURRENCE_RETURN_CLOSURE_v0.1.md).

## Bounded Federated Crossing Fixture

After the single-domain closure fixture, a separate two-jurisdiction specimen
types a purpose-bound `SharedWorld`, inert `Door` objects, a local synthetic
`Crossing`, trace, evidence, receipt, settlement, and distinct Returns to both
campuses.

```bash
npm run test:federation
node federation-fixture/produce.js /tmp/federated-crossing-packet
```

It establishes only a reconstructable local synthetic fixture; it does not
establish production federation, constitutional lawfulness, shared succession,
external effect, or human authority. See
[`docs/conformance/FEDERATED_CROSSING_FIXTURE_v0.1.md`](docs/conformance/FEDERATED_CROSSING_FIXTURE_v0.1.md).

---

## SPG-M Profile

This repository includes an optional SPG-M profile adapter for mapping pattern-governance outcomes into the existing RIO receipt proof layer.

SPG-M does not change receipt cryptography, canonicalization, hash-chain verification, ledger behavior, or the current `ALLOW` / `BLOCK` decision model.

Useful SPG-M files:

- [`spgm/README.md`](spgm/README.md) — profile adapter overview
- [`docs/SPGM_PROFILE.md`](docs/SPGM_PROFILE.md) — concise profile note
- [`docs/SPG_M_VERIFICATION_NOTES.md`](docs/SPG_M_VERIFICATION_NOTES.md) — verification commands and expectations
- [`docs/SPG_M_ENTERPRISE_PATTERN_GOVERNANCE.md`](docs/SPG_M_ENTERPRISE_PATTERN_GOVERNANCE.md) — enterprise framing
- [`spec/SPG_M_RECEIPT_PROTOCOL_MAPPING_v0.1.md`](spec/SPG_M_RECEIPT_PROTOCOL_MAPPING_v0.1.md) — receipt mapping note
- [`examples/spgm_containment_receipt.json`](examples/spgm_containment_receipt.json) — containment receipt example

Run SPG-M checks directly:

```bash
npm run spgm
npm run spgm:demo
```

---

## How This Repo Fits Into the Larger System

| Repository | Role |
|------------|------|
| [rio-protocol](https://github.com/bkr1297-RIO/rio-protocol) | Canonical protocol specification |
| **[rio-receipt-protocol](https://github.com/bkr1297-RIO/rio-receipt-protocol)** (this repo) | Proof layer — local receipt engine |
| [rio-system](https://github.com/bkr1297-RIO/rio-system) | Observation and monitoring layer |
| [language-intake-mvp](https://github.com/bkr1297-RIO/language-intake-mvp) | Language governance — crossing detection |

The canonical protocol specification lives in [rio-protocol](https://github.com/bkr1297-RIO/rio-protocol). This repo implements the proof mechanism defined there.

---

## 60-Second Quickstart

> **Important:** You must run `npm run init` first. Initialization creates a fresh local unit, keypair, trust registry, nonce stores, and ledger for your checkout.
>
> Repository history contains public demonstration key material. Treat it as compromised demonstration data, not signer identity. See [`docs/KEY_HISTORY_NOTICE.md`](docs/KEY_HISTORY_NOTICE.md).

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
| `npm test` | Runs core receipt tests and SPG-M mapping tests |
| `npm run demo` | 2 receipts created (1 ALLOW + 1 BLOCK), ledger VALID |
| `npm run verify-chain` | Full ledger chain verification → CHAIN VALID |

That's it. No install beyond Node.js 18+. No npm dependencies. No network calls.

The optional occurrence-to-Return specimen has an additional local Python
requirement documented in its section above. Run `npm run test:full` after
installing Python `cryptography` to exercise both the Node-only core and that
fixture.

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

## Core Validation Invariant

Within this prototype, an `ALLOW` receipt is emitted only when the supplied execution input exactly matches the approved intent and the other local validation checks pass. The receipt proves the integrity and signer attribution of that local record within its trust configuration; it does not by itself prove external occurrence.

---

## What This Demonstrates Locally

| Capability | How |
|------------|-----|
| Local identity/keypair initialization | `mus-init.js` creates Ed25519 keypair per user |
| Ed25519 signed receipts | Every receipt carries a signature and public key |
| Local hash-chain ledger | Append-only JSONL with `receipt_hash` → `previous_receipt_hash` linkage |
| Ledger chain verification | `verify-chain.js` validates every link |
| Tamper detection | Modified receipt body → hash mismatch → FAIL |
| Interior deletion detection | Missing interior chain entry → broken link → FAIL; tail truncation or whole-ledger replacement requires an external trusted head/checkpoint |
| Reorder detection | Wrong `previous_receipt_hash` → FAIL |
| Untrusted-key detection | Receipt signed by unknown key → REJECTED |
| Replay prevention | Reused nonce → BLOCKED |
| Zero external services required | No dependencies, no network calls, no accounts |

---

## What This Does Not Do

This repo is the **proof layer only**. It does not include:

- the full governance runtime (that's [rio-protocol](https://github.com/bkr1297-RIO/rio-protocol))
- production enforcement or policy evaluation
- risk assessment or approval workflows
- language governance (that's [language-intake-mvp](https://github.com/bkr1297-RIO/language-intake-mvp))
- observation or pattern monitoring (that's [rio-system](https://github.com/bkr1297-RIO/rio-system))
- a user interface or accounts

These belong to other parts of the RIO system.

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

## How the Receipt Protocol Works

For the standards-style receipt protocol specification, see [`spec/RIO_RECEIPT_PROTOCOL_v0.1.md`](spec/RIO_RECEIPT_PROTOCOL_v0.1.md).

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
| Signer attribution | Signature ties receipt to a keypair within the configured trust registry; key custody remains a separate burden |
| Replay prevention | One-time nonces, tracked and rejected on reuse |
| Tamper evidence | Hash chain links every receipt to its predecessor |
| Trust boundary | Only receipts signed by trusted keys pass verification |
| Fail-closed | Any validation failure → BLOCK, never silent pass |

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

test/
  spgm-receipt-mapping.test.js ← SPG-M profile mapping tests

spgm/
  constants.js               ← SPG-M profile constants
  spgm-checks.js             ← SPG-M profile checks
  map-spgm-to-receipt.js     ← Receipt-compatible mapping adapter
  README.md                  ← SPG-M profile overview

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
  spgm_containment_receipt.json

verifier/
  index.html                ← Browser-based verifier
  verify.js                 ← Browser verification logic

spec/                       ← Protocol specifications
docs/                       ← Security and architecture docs
adapters/                   ← Action adapters (send_email)
scripts/                    ← Demo scripts
```

---

## Tests

```bash
# Run all tests (requires init first)
npm test

# Run only tamper detection tests (6 cases)
node test_tamper.js

# Run only chain verification tests (7 cases, 15 assertions)
node test_chain.js

# Run only SPG-M mapping tests
npm run spgm
```

All tests use isolated temporary data and do not modify the real ledger.

---

## Requirements

- Node.js 18+ (uses built-in `crypto` with Ed25519 support)
- No npm dependencies (zero `node_modules`)
- Works on macOS, Linux, Windows

---

## One-Line Summary

If the supplied execution input changes, local validation blocks it. If a receipt is issued, its signed local account can be checked within the declared trust boundary.

---

## License

MIT
