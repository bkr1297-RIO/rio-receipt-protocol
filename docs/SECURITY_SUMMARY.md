# Security Summary

## Threat Model

This system addresses the following threats:

### 1. Execution Drift

An action executes differently from what was approved.

**Mitigation:** The Execution Validation Layer compares intent_hash to execution_hash before execution. If they differ, execution is blocked.

### 2. Post-Execution Tampering

A receipt is modified after generation.

**Mitigation:** Receipts include a SHA-256 hash of the receipt body and an Ed25519 signature. Any modification invalidates both.

### 3. Unauthorized Execution

An action executes without approval.

**Mitigation:** Execution requires a valid approval reference. The validation block must confirm intent_match, context_match, scope_valid, and execution_path_valid.

### 4. Replay

A previously approved action is re-executed.

**Mitigation:** Approvals include a nonce. Receipt chain linkage via previous_receipt_hash prevents insertion.

### 5. Silent Policy Change

Validation rules change without notice.

**Mitigation:** Validation includes policy_version. Changes require explicit version updates.

---

## Cryptographic Primitives

| Primitive | Algorithm | Purpose |
|-----------|-----------|---------|
| Hashing | SHA-256 | intent_hash, execution_hash, receipt_hash |
| Signing | Ed25519 | Receipt signature |
| Key format | SPKI DER | Public key encoding |

---

## Fail-Closed Behavior

If any validation check fails, execution does not occur.

There is no fallback, override, or degraded mode.

---

## Verification

Verification requires only:

- the receipt JSON
- the public key (included in receipt)
- SHA-256 and Ed25519 (standard libraries)

No external service, network access, or trust relationship is required.

---

## Scope

This security model covers receipt generation and verification only.

It does not cover:

- key management
- identity systems
- network transport
- access control
- storage encryption
