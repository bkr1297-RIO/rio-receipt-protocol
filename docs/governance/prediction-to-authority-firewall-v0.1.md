# Prediction-to-Authority Firewall v0.1

**Status:** draft governance spec / Batch 11 patch candidate  
**Scope:** ONE/RIO/MUSS prediction, inference, proposal, and consequence boundary  
**Claim level:** governance doctrine and schema guidance; not runtime proof  
**Parent packet:** Nervous-System-to-Genesis Extraction Packet v0.2

---

## 1. Core law

**Prediction may become a proposal. A proposal may become consequence only through valid authority.**

Prediction can inform, simulate, prepare, and warn. Prediction cannot authorize.

---

## 2. Default posture

Every prediction-like output starts with the following defaults:

```text
may_execute = false
may_authorize = false
```

These defaults may change only when valid authority exists.

Valid authority means:

1. explicit human approval in the moment, or
2. explicit bounded pre-approval inside an active delegation envelope.

---

## 3. Allowed uses

A prediction may:

- reflect
- simulate
- prepare
- warn
- support a proposal packet
- surface a delta
- ask for human clarification

A prediction may not:

- authorize
- execute
- expand scope
- create delegation
- modify protocol
- promote itself into policy
- treat convergence as consent
- treat correctness as permission
- silently cross from hypothesis into consequence

---

## 4. Required metadata

Every prediction output must declare what it is allowed to become.

Minimum metadata:

- `state_hypothesis`
- `confidence`
- `human_protocol_ref`
- `missing_rule_flag`
- `alignment_delta`
- `allowed_uses`
- `authority_status`

Allowed uses must be explicit:

- `may_reflect`
- `may_simulate`
- `may_prepare`
- `may_warn`
- `may_execute`
- `may_authorize`

Default:

```text
may_execute = false
may_authorize = false
```

---

## 5. Authority status

A prediction must carry authority status before any downstream component may prepare execution.

Valid authority statuses include:

| Status | Meaning |
|---|---|
| `none` | No authority exists; reflection/proposal only |
| `explicit_approval` | Human approved this crossing in the moment |
| `bounded_preapproval` | Action is inside an active delegation envelope |
| `expired` | Prior authority existed but is no longer valid |
| `out_of_scope` | Authority exists for another scope but not this action |
| `unclear` | Authority cannot be determined; human return required |

---

## 6. Missing rule behavior

When a human-authored rule is absent, unclear, stale, or contradictory, the system must not infer its way into authority.

Required path:

```text
missing rule
→ surface delta
→ ask human / SourcePoint clarification
→ candidate protocol
→ explicit approval
→ receipt
→ future application inside declared scope
```

---

## 7. Relationship to RIO

RIO is the consequence governor. It evaluates whether a proposed crossing has valid authority, scope, consequence classification, and proof path.

The Prediction-to-Authority Firewall sits before consequence and prevents prediction from becoming authorization.

---

## 8. Relationship to MUSS

MUSS receipts the outcome of the gate:

- prediction surfaced
- proposal prepared
- clarification requested
- hold issued
- block issued
- refusal issued
- execution allowed
- protocol update approved

Receipts prove what happened. They do not convert prediction into truth or authority.

---

## 9. Keeper lines

- Prediction is not permission.
- Prediction without authority must pause.
- Convergence without authority must pause.
- High probability without authority must pause.
- Correctness without authority must pause.
- Capability without authority must pause.
- Every prediction must carry its authority status.
- The Inference-to-Action Firewall is the membrane between prediction and consequence.

---

## 10. Short form

**Prediction may prepare the crossing. Authority decides whether the crossing may occur.**
