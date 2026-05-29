# Predictive Governance Schemas v0.1

**Status:** draft schema spec  
**Scope:** ONE/RIO/MUSS prediction, delta, authority, and receipt schema primitives  
**Claim level:** schema proposal; not runtime implementation or proof  
**Parent packet:** `docs/architecture/nervous-system-to-genesis-packet-v0.1.md`

---

## 1. Purpose

This document defines schema primitives for governing prediction inside ONE/RIO/MUSS.

The core rule is simple:

```text
Every prediction must declare what it is allowed to become.
```

Prediction may reflect, simulate, prepare, or warn. Prediction may not authorize or execute unless valid authority exists separately.

---

## 2. Core defaults

All prediction-like outputs default to:

```text
may_execute = false
may_authorize = false
```

Those values may change only when valid authority exists:

1. explicit human approval in the moment, or
2. explicit bounded pre-approval inside an active delegation envelope.

---

## 3. PredictionSignal

A `PredictionSignal` records a hypothesis, forecast, model output, or next-state prediction before it becomes a proposal or action.

```json
{
  "prediction_signal": {
    "id": "pred_001",
    "source_component": "genesis|model|bondi|scribe|mantis|proxy_coherence_mirror|system",
    "created_at": "ISO-8601",
    "source_refs": ["signal_001", "context_001"],
    "state_hypothesis": "The user may be asking for a build artifact rather than a summary.",
    "confidence": 0.72,
    "human_protocol_ref": "protocol_id|null",
    "missing_rule_flag": true,
    "alignment_delta": {
      "delta_type": "authority|scope|intent|evidence|context|role|receipt|learning",
      "severity": "low|medium|high|critical",
      "description": "External action is implied, but approval is not present."
    },
    "allowed_uses": {
      "may_reflect": true,
      "may_simulate": true,
      "may_prepare": true,
      "may_warn": true,
      "may_execute": false,
      "may_authorize": false
    },
    "authority_status": {
      "authority_present": false,
      "authority_basis": "none|explicit_approval|bounded_preapproval|expired|out_of_scope|unclear",
      "delegation_id": null,
      "requires_human_return": true
    }
  }
}
```

---

## 4. PredictionPacket

A `PredictionPacket` groups one or more prediction signals, often from multiple models or components.

```json
{
  "prediction_packet": {
    "id": "pp_001",
    "created_at": "ISO-8601",
    "sourcepoint_id": "sourcepoint_001",
    "models_called": ["gpt", "claude", "gemini"],
    "prediction_signals": ["pred_001", "pred_002", "pred_003"],
    "convergence": {
      "score": 0.86,
      "summary": "Models converge on preparing a draft artifact, but not on execution.",
      "divergence_notes": ["One model frames this as implementation-ready; others frame it as draft-only."]
    },
    "hallucination_visibility": {
      "unsupported_claims_flagged": true,
      "notes": ["One model asserted runtime activation without evidence."]
    },
    "allowed_uses": {
      "may_reflect": true,
      "may_simulate": true,
      "may_prepare": true,
      "may_warn": true,
      "may_execute": false,
      "may_authorize": false
    },
    "authority_status": {
      "authority_present": false,
      "authority_basis": "none",
      "requires_human_return": true
    }
  }
}
```

---

## 5. CoherenceDelta

A `CoherenceDelta` describes the mismatch between predicted/proposed state and authorized/reference state.

```json
{
  "coherence_delta": {
    "id": "delta_001",
    "delta_type": "authority|scope|intent|evidence|context|role|receipt|learning|identity|consequence",
    "severity": "low|medium|high|critical",
    "expected_state_ref": "reference_range_001",
    "actual_or_proposed_state_ref": "proposal_001",
    "description": "The proposed action requires external send authority, but only draft authority is present.",
    "recommended_posture": "allow|warn|clarify|hold|block|invalid",
    "requires_human_return": true
  }
}
```

---

## 6. MachinePropensityVector

A `MachinePropensityVector` describes likely model, tool, agent, or workflow tendencies without implying machine desire, will, or intent.

Use this term instead of saying a machine “wants” to do something.

```json
{
  "machine_propensity_vector": {
    "id": "mpv_001",
    "component_id": "model_or_agent_001",
    "observed_context": "high-helpfulness drafting workflow",
    "propensities": [
      {
        "type": "scope_expansion",
        "likelihood": 0.64,
        "risk": "medium",
        "description": "Component may expand from draft preparation into implied send recommendation."
      },
      {
        "type": "overconfidence",
        "likelihood": 0.51,
        "risk": "medium",
        "description": "Component may present synthesis as more settled than evidence supports."
      }
    ],
    "required_controls": ["evidence_delta_check", "authority_status_check", "rio_gate"]
  }
}
```

---

## 7. AuthorityStatus

An `AuthorityStatus` records whether valid authority exists for a proposed crossing.

```json
{
  "authority_status": {
    "authority_present": false,
    "authority_basis": "none|explicit_approval|bounded_preapproval|expired|out_of_scope|unclear",
    "authority_source_principal_id": "human_001|null",
    "delegation_id": "delegation_001|null",
    "scope": "draft_only|send_email|calendar_create|financial_review|custom",
    "expires_at": "ISO-8601|null",
    "revocation_path": "string|null",
    "receipt_required": true,
    "can_execute": false,
    "requires_human_return": true
  }
}
```

---

## 8. AllowedUses

`AllowedUses` records what a prediction, packet, or proposal may become.

```json
{
  "allowed_uses": {
    "may_reflect": true,
    "may_simulate": true,
    "may_prepare": true,
    "may_warn": true,
    "may_execute": false,
    "may_authorize": false
  }
}
```

Rules:

- `may_authorize` defaults to `false` and should remain `false` for model/system-generated prediction.
- `may_execute` defaults to `false` unless valid authority exists separately.
- A prediction may not set its own authority.
- Convergence may update confidence, not permission.

---

## 9. PredictionReceipt

A `PredictionReceipt` records how a prediction was handled.

```json
{
  "prediction_receipt": {
    "id": "preceipt_001",
    "created_at": "ISO-8601",
    "prediction_packet_id": "pp_001",
    "decision_id": "decision_001|null",
    "event_type": "surfaced|prepared|warned|clarified|held|blocked|executed|expired",
    "authority_status_ref": "authority_status_001",
    "gate_verdict": "allow|allow_with_modifications|clarify|hold|block|invalid|null",
    "human_return_required": true,
    "policy_refs": ["prediction-to-authority-firewall-v0.1"],
    "receipt_hash": "sha256...",
    "previous_receipt_hash": "sha256|null",
    "signature": "ed25519...|null"
  }
}
```

---

## 10. Prediction-to-proposal path

```text
PredictionSignal
→ PredictionPacket
→ CoherenceDelta
→ AuthorityStatus
→ ProposalPacket
→ RIO GateVerdict
→ Execution or Hold/Clarify/Block
→ MUSS Receipt
→ Human-reviewed recalibration
```

A prediction may become a proposal. A proposal may become consequence only through valid authority.

---

## 11. Required validation rules

1. A prediction without `authority_status` is invalid for downstream execution.
2. A prediction without `allowed_uses` is invalid for downstream execution.
3. `may_execute = true` requires valid authority.
4. `may_authorize = true` may not be set by a model/system prediction.
5. `confidence` may not override `authority_status`.
6. `convergence.score` may not override `authority_status`.
7. Missing human-authored rule requires SourcePoint clarification or HOLD.
8. Receipt path must exist before consequence.

---

## 12. Keeper lines

- Every prediction must carry its authority status.
- Prediction may prepare. Authority decides whether consequence may cross.
- Convergence updates confidence, not permission.
- A prediction may not set its own authority.
- Machine propensity is not machine desire.
- Correctness is evidence. It is not permission.

---

## 13. Short form

**Prediction is allowed to become structured signal. It is not allowed to become authority.**
