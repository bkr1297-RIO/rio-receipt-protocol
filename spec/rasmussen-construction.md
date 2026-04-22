# Rasmussen Receipt Construction

## Purpose

Defines the canonical method for constructing receipts under the RIO Receipt Protocol.

---

## Principle

RIO defines what a valid receipt is.
Rasmussen defines how to construct it.

---

## Construction Requirements

Each receipt MUST include:

- intent_hash
- execution_hash
- validation block
- decision
- signature
- chain reference

---

## Hashing

- intent_hash = deterministic hash of approved intent
- execution_hash = deterministic hash of execution input

---

## Validation Embedding

Receipts MUST include:

- validation decision
- validation checks
- policy version

---

## Signature

Receipts MUST be cryptographically signed.

Signature ensures:

- authenticity
- non-repudiation
- integrity

---

## Chain

Receipts MAY include chain linkage:

- previous receipt hash
- ledger reference

---

## Determinism

Given identical inputs:

- receipt MUST be identical
- verification MUST succeed

---

## Invariant

Receipts must be reproducible and verifiable without trust.
