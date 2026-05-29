# Precision / Trust Weighting Layer v0.1

**Status:** draft architecture spec  
**Scope:** ONE/RIO/MUSS signal weighting, confidence, evidence, and trust calibration  
**Claim level:** architecture proposal; not runtime implementation or proof  
**Parent packet:** `docs/architecture/nervous-system-to-genesis-packet-v0.1.md`

---

## 1. Purpose

This document defines how ONE/RIO/MUSS should weight predictive signals before they influence proposals, gates, warnings, or human-return requests.

Precision weighting is adapted here as an architecture pattern: the system must decide how much weight to give a signal based on reliability, evidence, freshness, authority, and consequence.

Core line:

```text
Precision weighting is trust weighting, not authority granting.
```

---

## 2. Core distinction

Trust weighting can affect:

- confidence
- priority
- warning severity
- need for verification
- need for human return
- proposal quality
- evidence posture

Trust weighting cannot create:

- authority
- permission
- consent
- delegation
- execution right
- policy amendment
- proof of whole truth

---

## 3. Inputs to trust weighting

The layer may consider:

| Input | Question |
|---|---|
| Source reliability | Has this source been reliable in this context? |
| Evidence quality | Is the claim supported, verified, inferred, or speculative? |
| Context freshness | Is the context current enough for reliance? |
| Model confidence | How confident is the model or ensemble? |
| Model convergence | Do independent models agree? |
| Model divergence | Where do models disagree or expose uncertainty? |
| Authority strength | Does valid authority exist for the proposed crossing? |
| Receipt availability | Can the event be proven afterward? |
| Consequence level | What happens if the system is wrong? |
| Reversibility | Can the action be undone? |
| Identity risk | Does this affect representation of a person/entity? |
| Public-claim risk | Could this create external reliance? |

---

## 4. TrustWeight primitive

```json
{
  "trust_weight": {
    "id": "tw_001",
    "signal_ref": "prediction_signal_001",
    "source_reliability": 0.82,
    "evidence_quality": "unsupported|plausible|supported|verified",
    "context_freshness": 0.74,
    "model_confidence": 0.68,
    "model_convergence": 0.86,
    "model_divergence_notes": ["One model overstated implementation readiness."],
    "authority_strength": "none|weak|bounded|explicit",
    "receipt_availability": true,
    "consequence_level": "low|medium|high|critical",
    "reversibility": "reversible|partially_reversible|irreversible",
    "recommended_reliance": "do_not_rely|reflect_only|verify_before_use|proposal_only|eligible_for_gate_review"
  }
}
```

---

## 5. Recommended reliance levels

| Reliance level | Meaning |
|---|---|
| `do_not_rely` | Signal is too weak, stale, unsupported, or conflicted |
| `reflect_only` | Useful for thought, patterning, or brainstorming only |
| `verify_before_use` | May become useful after source/evidence check |
| `proposal_only` | May support a proposal but not consequence |
| `eligible_for_gate_review` | May be sent to RIO for consequence review |

No reliance level authorizes execution by itself.

---

## 6. Authority separation

Authority is evaluated separately from trust.

A highly trusted signal with no authority cannot execute.

A low-trust signal with authority may still require verification, clarification, or HOLD.

Keeper line:

```text
Trust can raise confidence. It cannot create permission.
```

---

## 7. Convergence and divergence

Convergence can improve confidence or indicate useful signal.

Divergence can expose uncertainty, blind spots, hallucination risk, context gaps, or framing differences.

Neither convergence nor divergence grants authority.

Keeper lines:

```text
Convergence reveals signal; it does not grant authority.
Divergence reveals uncertainty; it does not automatically invalidate the work.
```

---

## 8. Evidence Delta

An Evidence Delta occurs when confidence exceeds support.

Examples:

- confident claim with no source
- model consensus without evidence
- symbolic pattern treated as proof
- old context treated as current
- inference presented as fact
- draft architecture described as runtime implementation

Controls:

- downgrade claim language
- require citation/source
- mark as hypothesis
- require verification
- hold before public or consequential use

---

## 9. Precision over/under-weighting failure modes

| Failure | Digital pattern | Control |
|---|---|---|
| Overweighting model confidence | Hallucinated certainty | Evidence Delta check |
| Overweighting convergence | Consensus becomes fake proof | Convergence boundary |
| Underweighting weak signals | Drift missed | Anomaly detection |
| Overweighting risk | Overblocking / warning fatigue | False-positive calibration |
| Underweighting authority | Convenience bypass | Authority gate |
| Overweighting authority | Approved but unsupported action | Evidence and consequence checks |

---

## 10. Use by RIO

RIO may use trust weights as inputs into gate posture, but trust weights do not decide consequence alone.

RIO must separately evaluate:

- authority
- scope
- consequence
- evidence
- receipt path
- role boundary
- invariant compliance

---

## 11. Required metadata

Prediction or proposal packets should include:

- trust weight reference
- evidence quality
- context freshness
- source reliability
- model convergence/divergence summary
- recommended reliance
- authority status
- receipt availability

---

## 12. Keeper lines

- Precision weighting is trust weighting, not authority granting.
- Trust can raise confidence. It cannot create permission.
- Convergence reveals signal; it does not grant authority.
- Evidence Delta occurs when confidence exceeds support.
- Model confidence may support review. It may not bypass governance.

---

## 13. Short form

**Weight the signal. Do not crown it.**
