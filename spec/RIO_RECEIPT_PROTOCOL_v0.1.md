# RIO Receipt Protocol v0.1

## 1. Status

| Field | Value |
|-------|-------|
| Status | Draft specification |
| Repository | `bkr1297-RIO/rio-receipt-protocol` |
| License | MIT |
| Scope | Receipt/proof layer only |
| Runtime status | Local receipt engine prototype |
| Classification | C — Local Receipt Engine Prototype |

This specification defines the receipt and proof primitive for the RIO governed execution architecture. It does **not** define the full RIO governance runtime, policy engine, authorization flow, or execution gateway.

---

## 2. Purpose

The RIO Receipt Protocol defines a portable proof primitive for governed AI actions.

A **receipt** records a governed event such as an approval, block, refusal, execution, or verification outcome.

A receipt proves that a specific event was recorded, hashed, signed, and optionally linked into an append-only ledger.

A receipt **does not** prove that the action was wise, legal, moral, strategically correct, or externally certified.

A receipt also **does not** independently prove that an external-world action occurred unless connected to additional external attestation.

---

## 3. Terminology

| Term | Definition |
|------|-----------|
| Receipt | A signed, hash-bound record of a governed event. |
| Receipt Body | The canonical set of fields that are hashed and signed. |
| Receipt Hash | The SHA-256 digest of the canonicalized receipt body. |
| Signature | An Ed25519 digital signature over the canonicalized receipt body. |
| Public Key | The Ed25519 public key (SPKI DER, hex-encoded) used to verify a signature. |
| MUS Unit | Minimum Unit of Sovereignty — the local instance that produces and stores receipts. |
| Intent Hash | The SHA-256 digest of the canonicalized intent object that was authorized. |
| Execution Hash | The SHA-256 digest of the canonicalized execution input that was attempted. |
| Validation Decision | The outcome of the execution validation layer: ALLOW or BLOCK. |
| Nonce | A single-use value (UUID v4) bound to an approval, used to prevent replay. |
| Ledger | An append-only, hash-linked JSONL file that stores receipts in sequence. |
| Previous Receipt Hash | The receipt hash of the immediately preceding ledger entry, forming the chain link. |
| Chain Verification | The process of recomputing every receipt hash and verifying every chain link in the ledger. |
| Trusted Key | A public key registered in the local trusted key store, accepted for signature verification. |
| Replay | An attempt to reuse a previously consumed nonce to execute an action more than once. |
| Tamper Evidence | The property that any modification to a signed receipt or ledger entry is detectable. |

---

## 4. Normative Keywords

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** in this document are to be interpreted as normative requirements for implementations of this protocol.

---

## 5. Receipt Data Model

A conforming receipt MUST contain the following fields:

| Field | Type | Required | Purpose | Validation Rule |
|-------|------|----------|---------|-----------------|
| `receipt_id` | string (UUID v4) | REQUIRED | Unique identifier for this receipt. | MUST be a valid UUID. |
| `timestamp` | string (ISO 8601) | REQUIRED | Creation time of the receipt. | MUST be a valid ISO 8601 timestamp. |
| `intent_hash` | string (hex, 64 chars) | REQUIRED | SHA-256 of the canonicalized intent. | MUST be a 64-character lowercase hexadecimal string. |
| `execution_hash` | string (hex, 64 chars) | REQUIRED | SHA-256 of the canonicalized execution input. | MUST be a 64-character lowercase hexadecimal string. |
| `mus_unit_id` | string | OPTIONAL | Identifier of the MUS Unit that produced this receipt. | If present, MUST be a non-empty string. |
| `validation.decision` | string | REQUIRED | The validation outcome. | MUST be one of: `"ALLOW"`, `"BLOCK"`. |
| `validation.checks` | object | REQUIRED | Individual check results. | MUST contain boolean fields for each validation check performed. |
| `validation.policy_version` | string | REQUIRED | Version of the policy used for validation. | MUST be a semver-compatible string. |
| `approval.approval_id` | string (UUID v4) | REQUIRED | Unique identifier for the approval. | MUST be a valid UUID. |
| `approval.intent_hash` | string (hex, 64 chars) | REQUIRED | Hash of the intent that was approved. | MUST match `intent_hash`. |
| `approval.authorizer` | string | REQUIRED | Identity of the authorizer. | MUST be a non-empty string. |
| `approval.nonce` | string (UUID v4) | REQUIRED | Single-use nonce bound to this approval. | MUST be a valid UUID. MUST NOT have been previously used. |
| `chain_reference.previous_receipt_hash` | string (hex, 64 chars) or null | REQUIRED | Receipt hash of the prior ledger entry. | MUST be null for the first entry (genesis). MUST be a valid hex hash for subsequent entries. |
| `receipt_hash` | string (hex, 64 chars) | REQUIRED | SHA-256 of the canonicalized receipt body. | MUST be recomputable from the receipt body. |
| `signature` | string (hex) | REQUIRED | Ed25519 signature over the canonicalized receipt body. | MUST verify against the associated public key. |
| `public_key` | string (hex) | REQUIRED | SPKI DER-encoded Ed25519 public key. | MUST be a valid Ed25519 public key. |

Implementations MAY include additional fields (e.g., `signature_algorithm`, `decision` at top level) but MUST NOT omit required fields.

---

## 6. Canonicalization

Receipts MUST be canonicalized before hashing and signing.

The current implementation defines canonicalization as follows:

1. For `null` or non-object values: use `JSON.stringify(value)`.
2. For arrays: recursively canonicalize each element, join with `,`, wrap in `[]`.
3. For objects: sort keys lexicographically (Unicode code point order), recursively canonicalize each value, produce `"key":value` pairs joined with `,`, wrap in `{}`.

Implementations MUST use deterministic field ordering as defined above.

Non-deterministic serialization (e.g., language-default `JSON.stringify` without key sorting) MUST NOT be used for receipt hash generation.

The following fields are excluded from the signed body (they are appended after signing):
- `receipt_hash`
- `signature`
- `signature_algorithm`
- `public_key`

Verification MUST recompute the canonical form from the receipt body fields before validating the hash and signature.

---

## 7. Hashing

All hashes in this protocol use **SHA-256** unless explicitly versioned otherwise.

| Hash Field | Binds To |
|-----------|----------|
| `intent_hash` | The canonicalized intent object that was authorized. |
| `execution_hash` | The canonicalized execution input that was attempted or performed. |
| `receipt_hash` | The canonicalized receipt body (all fields except `receipt_hash`, `signature`, `signature_algorithm`, `public_key`). |

Any mutation to hash-bound fields MUST cause verification failure. A receipt whose recomputed hash does not match the stored `receipt_hash` MUST be rejected.

---

## 8. Signatures

Receipts MUST be signed.

The current implementation uses **Ed25519** (RFC 8032).

- The signature is computed over the canonicalized receipt body (the same byte string used to compute `receipt_hash`).
- Signature verification MUST use the public key embedded in the receipt or resolved from a trusted key registry.
- Receipts signed by unknown or untrusted keys MUST be rejected or explicitly marked as untrusted.
- Signature verification failure MUST cause receipt verification failure.
- Keys are stored in SPKI DER format, hex-encoded.

---

## 9. Ledger and Chain Linking

The ledger is **append-only**.

Each ledger entry is a single JSON object stored as one line in a JSONL file. Each entry contains:

| Field | Purpose |
|-------|---------|
| `receipt_hash` | The receipt hash (chain identifier for this entry). |
| `previous_receipt_hash` | The receipt hash of the prior entry (chain link). |
| `appended_at` | Timestamp when the entry was appended to the ledger. |
| `receipt` | The full receipt object. |

Chain linking rules:

- The first entry MAY use `null` as `previous_receipt_hash` (genesis).
- Each subsequent entry MUST set `previous_receipt_hash` to the `receipt_hash` of the immediately preceding entry.
- Deletion, insertion, mutation, or reordering of entries SHOULD be detectable by chain verification.
- Chain verification MUST recompute every receipt hash and compare every `previous_receipt_hash` link.

---

## 10. Replay Prevention

Approval nonces MUST be single-use.

- Reuse of a nonce MUST be rejected or recorded as a replay attempt.
- Implementations MUST persist used nonces in a nonce store.
- Nonce registry failures SHOULD fail closed for governed actions (i.e., if the nonce store is unavailable, the action SHOULD be blocked rather than allowed).

---

## 11. Validation Decision

The validation decision records the outcome of the execution validation layer.

**Current normative values:**

| Decision | Meaning |
|----------|---------|
| `ALLOW` | All validation checks passed. Execution is permitted. |
| `BLOCK` | One or more validation checks failed. Execution is denied. |

**Non-normative future extension values** (not currently implemented):

| Decision | Possible Meaning |
|----------|-----------------|
| `HOLD` | Action paused pending additional information. |
| `CLARIFY` | Action requires clarification before proceeding. |
| `INVALID` | Action is structurally invalid. |
| `REFUSED` | Action refused by policy. |
| `FAILED` | Execution was attempted but failed. |

Implementations MUST NOT claim support for future values unless they are implemented and tested.

---

## 12. Receipt Generation Algorithm

A conforming implementation MUST follow this sequence:

1. **Receive** structured intent and execution/attempt data.
2. **Validate intent match** — verify `intent_hash` matches the hash of the execution input (deep equality check).
3. **Validate context match** — verify the approval's `intent_hash` matches the intent being executed.
4. **Validate scope** — verify the execution action falls within the approved scope.
5. **Validate execution path** — verify the action is in the set of allowed actions.
6. **Determine validation decision** — if all checks pass, decision is `ALLOW`; if any check fails, decision is `BLOCK` (fail-closed).
7. **Assign nonce / confirm nonce validity** — verify the approval nonce has not been previously used; record it.
8. **Construct canonical receipt body** — assemble all receipt body fields.
9. **Compute receipt hash** — canonicalize the receipt body and compute SHA-256.
10. **Sign receipt body** — sign the canonicalized receipt body with the local Ed25519 private key.
11. **Append receipt to ledger** — write the receipt as a new ledger entry with correct chain link.
12. **Return receipt** — return the complete receipt including hash, signature, and public key.

Steps 2–5 reflect the current reference implementation's validation checks (`intent_match`, `context_match`, `scope_valid`, `execution_path_valid`). Implementations MAY define additional or alternative checks provided the fail-closed property is preserved.

---

## 13. Receipt Verification Algorithm

A conforming verifier MUST follow this sequence:

1. **Load receipt** — parse the receipt object.
2. **Reconstruct canonical receipt body** — extract body fields (excluding `receipt_hash`, `signature`, `signature_algorithm`, `public_key`) and canonicalize.
3. **Recompute receipt hash** — compute SHA-256 of the canonical body. Compare to stored `receipt_hash`. If mismatch: FAIL.
4. **Verify signature** — verify the Ed25519 signature over the canonical body using the embedded public key. If invalid: FAIL.
5. **Verify trusted key** — check that the public key is in the trusted key registry. If untrusted: FAIL or mark untrusted.
6. **Verify nonce/replay status** — if a nonce registry is available, check that the nonce has not been used in a different receipt. If replay detected: FAIL.
7. **Verify chain link** — if ledger context is available, verify that `chain_reference.previous_receipt_hash` matches the prior entry's `receipt_hash`. If mismatch: FAIL.
8. **Return verification status** — PASS, FAIL, or UNTRUSTED with reason.

---

## 14. Chain Verification Algorithm

A conforming chain verifier MUST follow this sequence:

1. **Load ledger entries** in append order (line by line from JSONL).
2. **For each entry:**
   - Parse JSON. If malformed: record error, halt.
   - Verify `receipt_hash` and `receipt` fields are present.
   - Reconstruct the canonical receipt body from the embedded receipt.
   - Recompute receipt hash. If mismatch: record error.
   - Verify signature. If invalid: record error.
   - Verify trusted key. If untrusted: record error.
   - Verify `previous_receipt_hash` equals the `receipt_hash` of the prior entry (or null for genesis). If mismatch: record error.
3. **Detect anomalies** — missing entries, reordered entries, inserted entries, or mutated entries are all detectable through hash/link mismatches.
4. **Return result** — `CHAIN VALID` if zero errors, or `CHAIN INVALID` with a list of errors and their positions.

---

## 15. Security Properties

A conforming implementation provides the following security properties:

| Property | Description |
|----------|-------------|
| Integrity | Receipt body is hash-bound. Any modification is detectable. |
| Authenticity | Receipt is signed by a known key. Origin is verifiable. |
| Non-repudiation | The signer cannot deny producing the receipt (signature is bound to their key). |
| Replay prevention | Single-use nonces prevent re-execution of previously approved actions. |
| Tamper evidence | Any modification to a receipt or ledger entry is detectable through hash recomputation. |
| Chain integrity | The append-only ledger with hash links detects deletion, insertion, reordering, or mutation. |
| Fail-closed validation | Any validation check failure results in BLOCK. The system does not default to permissive. |

---

## 16. What This Protocol Proves

A conforming implementation can prove:

- A receipt was created for a governed event.
- The receipt was signed by a known key.
- The receipt body was not modified after signing.
- The receipt was linked into a hash-chain ledger.
- Ledger tampering is detectable.
- The validation decision was recorded (ALLOW or BLOCK).
- The receipt binds intent and execution hashes, proving what was authorized and what was attempted.

---

## 17. What This Protocol Does Not Prove

This protocol does **not** prove:

- That the action was wise.
- That the action was legal.
- That the action was moral.
- That the action was strategically correct.
- That the action occurred in the external world without external attestation.
- That future actions are authorized.
- That the full RIO governance product is complete.
- That legal or regulatory certification exists.

---

## 18. Conformance Levels

The following conformance levels apply to implementations of this receipt protocol specification. These are **receipt-protocol conformance levels**, not full RIO runtime conformance levels.

| Level | Name | Requirements |
|-------|------|-------------|
| 1 | Receipt Shape | All required fields present and correctly typed. |
| 2 | Signed Receipt | Level 1 + valid Ed25519 signature over canonical body. |
| 3 | Hash-Linked Receipt | Level 2 + valid `receipt_hash` and correct `previous_receipt_hash` field. |
| 4 | Ledger Verification | Level 3 + full local chain verification passes. |
| 5 | Replay Protection | Level 4 + nonce registry detects and rejects replay attempts. |
| 6 | Trusted-Key Verification | Level 5 + trusted-key registry rejects receipts signed by untrusted keys. |

---

## 19. Example Receipt

The following is a synthetic example receipt using fake data. It does not contain real keys, identities, or ledger data.

```json
{
  "receipt_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-05-01T12:00:00.000Z",
  "intent_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "execution_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "mus_unit_id": "mus-unit-example-001",
  "validation": {
    "decision": "ALLOW",
    "checks": {
      "intent_match": true,
      "context_match": true,
      "scope_valid": true,
      "execution_path_valid": true
    },
    "policy_version": "1.0.0"
  },
  "decision": "ALLOW",
  "approval": {
    "approval_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
    "intent_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "authorizer": "human:example-user",
    "nonce": "11223344-5566-7788-99aa-bbccddeeff00"
  },
  "chain_reference": {
    "previous_receipt_hash": null
  },
  "receipt_hash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "signature": "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567",
  "signature_algorithm": "Ed25519",
  "public_key": "302a300506032b6570032100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

> **Note:** This example uses placeholder values. In a real implementation, `receipt_hash` and `signature` would be cryptographically valid.

---

## 20. Relationship to RIO Protocol

- This specification defines the **receipt/proof primitive**.
- [`rio-protocol`](https://github.com/bkr1297-RIO/rio-protocol) defines the broader governance protocol and conformance framework.
- This repository can be used independently as a local proof engine.
- Full governed execution requires additional governance, authorization, and runtime components outside this repository.

| Repository | Role |
|-----------|------|
| `rio-protocol` | Canonical governance protocol specification |
| `rio-receipt-protocol` | Receipt/proof primitive (this spec) |
| `rio-system` | Observation/MANTIS layer |
| `language-intake-mvp` | Language governance / crossing detection |
| Private runtime repos | Full execution/runtime implementations |

---

## 21. Implementation Notes

- Current reference implementation is **Node.js 18+** using built-in `crypto` module.
- **Zero external dependencies.**
- No external network calls are made.
- Local initialization (`mus-init.js`) creates: Ed25519 keypair, trusted key store, nonce store, and empty ledger.
- Canonicalization uses recursive sorted-key JSON serialization (see Section 6).
- Tests cover: tampering detection, deletion detection, reordering detection, replay prevention, untrusted key rejection, and full chain verification.
- The reference implementation includes 73 conformance tests (44 Node.js + 29 Python).

---

## 22. Open Issues / Future Work

- **Canonicalization:** The canonical JSON method should be made fully explicit as a standalone algorithm definition (potentially aligned with RFC 8785 JCS) if interoperability with non-JavaScript implementations is required.
- **Additional validation decisions:** Values such as HOLD, CLARIFY, INVALID, REFUSED, FAILED may be added in future versions.
- **External attestation:** Proving that an external-world action occurred is out of scope for v0.1. Future versions may define an attestation extension.
- **Interoperability profile:** A formal interoperability profile with `rio-protocol` may be added in a future version.
- **Independent verifier format:** The verifier interface may be separated into its own specification.
- **Multi-signer receipts:** Support for co-signatures or multi-party receipts is not defined in v0.1.
- **Key rotation:** Procedures for rotating signing keys while maintaining chain integrity are not defined in v0.1.

---

## 23. License

This specification and reference implementation are licensed under the **MIT License**. See root [`LICENSE`](../LICENSE).
