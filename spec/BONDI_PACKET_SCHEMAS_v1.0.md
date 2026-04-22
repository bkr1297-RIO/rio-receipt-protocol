# Bondi Packet Schemas (v1.0)

## Purpose

Defines structured data used for coordination between system components.

Packets are:

- structured
- attributable
- immutable once written

---

## Packet Types

### 1. Intent Packet

Represents structured intent.

Fields:

- intent_id
- action
- target
- parameters
- context

---

### 2. Approval Packet

Represents authorization.

Fields:

- approval_id
- intent_hash
- authorizer
- nonce
- ttl
- scope

---

### 3. Validation Packet

Represents validation result.

Fields:

- decision
- checks
- policy_version
- reason_codes

---

### 4. Execution Packet

Represents execution request.

Fields:

- execution_input
- intent_hash
- approval_reference

---

### 5. Receipt Packet

Represents proof of execution.

Fields:

- intent_hash
- execution_hash
- validation
- decision
- signature
- chain_reference

---

## Rules

- packets MUST be source-attributed
- packets MUST be timestamped
- packets MUST NOT be mutated
- packets MUST preserve lineage

---

## Relationship

Packets:

- carry state between layers
- enable deterministic processing
- support audit and replay

---

## Invariant

All system behavior must be representable through packets.
