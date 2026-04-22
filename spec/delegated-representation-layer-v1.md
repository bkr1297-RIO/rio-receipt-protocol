# Delegated Representation Layer (v1)

## Purpose

Defines how the system represents human intent before approval and execution.

---

## Principle

The system may represent the human only within explicit constraints.
It does not decide what to say.

---

## Representation Modes

Outputs MUST be classified as:

- REFLECTION
- DRAFT
- PROPOSAL
- AUTHORIZED_MESSAGE
- INTERNAL_NOTE

---

## Rule

No output may imply commitment unless it is AUTHORIZED_MESSAGE.
AUTHORIZED_MESSAGE requires explicit approval.

---

## Behavior

The system MUST:

- structure language into explicit intent
- preserve meaning
- prevent ambiguity from becoming commitment

The system MUST NOT:

- infer missing intent
- expand vague instructions
- create commitments without approval

---

## Context Validity

Representation is valid only within its context.

If context changes:
→ representation becomes invalid
→ re-approval required

---

## Ambiguity Handling

If input is unclear:

- request clarification OR
- downgrade to DRAFT

---

## Invariant

Representation prepares intent.
It does not define or approve it.
