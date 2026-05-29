# Reference Range + Threshold Engine v0.1

**Status:** draft architecture spec  
**Scope:** ONE/RIO/MUSS reference ranges, deltas, thresholds, and gate posture  
**Claim level:** architecture proposal; not runtime implementation or proof  
**Parent packet:** `docs/architecture/nervous-system-to-genesis-packet-v0.1.md`

---

## 1. Purpose

This document defines how ONE/RIO/MUSS compares proposed or actual system state against authorized reference state.

The Reference Range + Threshold Engine provides the comparison grammar for governed crossings:

```text
reference state
→ incoming signal or proposed state
→ delta
→ threshold
→ gate posture
```

RIO uses this comparison to determine whether a crossing may proceed, should warn, must clarify, must hold, must block, or is invalid.

---

## 2. Core concept

```text
The system compares proposed state against authorized reference state.
```

A reference range is not a vague preference. It is a declared, bounded source of valid system behavior.

Reference ranges can come from:

- Core Constitution
- Personal Constitution
- human-authored protocols
- active delegations
- organization policy
- evidence standards
- receipt requirements
- consequence class
- tool permissions
- identity and role boundaries
- current approval state

---

## 3. Operating pattern

```text
Reference → Signal → Delta → Threshold → Gate → Receipt → Recalibration
```

Where:

- **Reference** = what is allowed, expected, required, or forbidden
- **Signal** = incoming request, model output, tool state, prediction, event, or proposal
- **Delta** = mismatch between reference and signal/proposal
- **Threshold** = severity/importance boundary that determines posture
- **Gate** = RIO/Sentinel decision posture
- **Receipt** = proof of gate outcome or consequence
- **Recalibration** = human-reviewed protocol or threshold update

---

## 4. ReferenceRange primitive

```json
{
  "reference_range": {
    "id": "ref_range_001",
    "owner_principal_id": "human_001",
    "scope": "email|finance|calendar|identity|public_claim|tool_call|custom",
    "source_type": "constitution|personal_protocol|delegation|org_policy|evidence_standard|receipt_requirement",
    "source_ref": "policy_or_protocol_id",
    "allowed_states": ["draft_only", "internal_reflection", "low_consequence_tool_call"],
    "blocked_states": ["external_send_without_approval", "credential_transfer", "unreceipted_execution"],
    "thresholds": {
      "max_consequence_without_review": "low",
      "minimum_authority": "explicit_approval|bounded_preapproval|none",
      "minimum_evidence": "supported|plausible|verified|source_required",
      "receipt_required": true,
      "human_return_required_above": "medium"
    },
    "expires_at": "ISO-8601|null",
    "revocation_path": "string|null"
  }
}
```

---

## 5. Delta classes

| Delta | Core question |
|---|---|
| Authority Delta | Does valid authority exist for this crossing? |
| Intent Delta | Does proposed action match declared human intent? |
| Scope Delta | Is action inside the authorized boundary? |
| Consequence Delta | Is consequence larger than the approved envelope? |
| Evidence Delta | Is confidence greater than proof supports? |
| Identity Delta | Is system treating data, role, or pattern as identity? |
| Role Delta | Is a model, proxy, or tool exceeding its role? |
| Context Delta | Is context stale, contradictory, or incomplete? |
| State Delta | Is system overloaded, looping, uncertain, or unstable? |
| Receipt Delta | Can the action be proven afterward? |
| Learning Delta | Is an observed pattern being promoted without approval? |

---

## 6. Threshold posture

A simple posture map:

| Delta severity | Default posture |
|---|---|
| Low | ALLOW inside envelope |
| Low + reversible | ALLOW or ALLOW_WITH_MODIFICATIONS |
| Medium | WARN, CLARIFY, or HOLD depending on consequence |
| High | HOLD or BLOCK |
| Critical | BLOCK or INVALID |
| Invariant violation | INVALID |

The threshold must rise as consequence rises.

Keeper line:

```text
Friction should scale with consequence.
```

---

## 7. Gate outcomes

Possible gate outcomes:

- `ALLOW`
- `ALLOW_WITH_MODIFICATIONS`
- `WARN`
- `CLARIFY`
- `HOLD`
- `BLOCK`
- `INVALID`
- `SAFE_MODE`

### 7.1 INVALID vs. BLOCK

`BLOCK` means a proposed crossing is not allowed under current conditions.

`INVALID` means the proposed crossing violates a core invariant or required structure and cannot proceed as a normal reviewable action.

Examples of INVALID:

- missing authority for high-consequence action
- attempt to treat prediction as authorization
- attempt to bypass RIO
- attempt to execute without receipt path where receipts are required
- role attempting to approve its own consequence

---

## 8. Dynamic thresholds

Thresholds may adjust based on:

- consequence class
- reversibility
- evidence quality
- authority clarity
- model disagreement
- context freshness
- identity or reputation risk
- financial/legal/medical risk
- public/private status
- previous overrides
- current system state
- active delegation envelope

Dynamic thresholds are allowed. Silent authority expansion is not.

Keeper line:

```text
Adaptive posture is not authority expansion.
```

---

## 9. Missing reference behavior

When no valid reference range exists, the system must not infer permission.

Required path:

```text
missing reference
→ surface delta
→ SourcePoint clarification
→ candidate reference/protocol
→ explicit approval
→ receipt
→ future application inside declared scope
```

Keeper line:

```text
When the human has not authored the rule, the system must ask before consequence.
```

---

## 10. Threshold equation concept

A conceptual threshold calculation may consider:

```text
Action Pressure =
  intent match
+ authorization strength
+ evidence strength
+ reversibility
+ human confirmation
- consequence risk
- ambiguity
- scope mismatch
- identity risk
- missing receipt path
- role drift
```

This is not a final mathematical implementation. It is a design model for turning reference/delta analysis into gate posture.

---

## 11. Required receipts

Receipts should be generated for:

- ALLOW
- ALLOW_WITH_MODIFICATIONS
- CLARIFY
- HOLD
- BLOCK
- INVALID
- SAFE_MODE
- human override
- threshold update
- protocol update
- missing reference clarification
- authority status assignment

Receipts prove the gate event. They do not prove whole truth or final meaning.

---

## 12. Keeper lines

- The system compares proposed state against authorized reference state.
- Friction should scale with consequence.
- Adaptive posture is not authority expansion.
- When the human has not authored the rule, the system must ask before consequence.
- Prediction may prepare the crossing. Authority decides whether the crossing may occur.
- Correctness is evidence. It is not permission.

---

## 13. Short form

**Reference ranges define what counts as valid. Thresholds decide when mismatch requires friction. RIO gates the crossing. MUSS receipts the result.**
