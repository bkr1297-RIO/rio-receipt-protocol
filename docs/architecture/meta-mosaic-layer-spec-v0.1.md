# Meta + Mosaic Layer Spec v0.1

**Status:** draft architecture spec  
**Scope:** ONE/RIO/MUSS state-awareness and connective provenance layers  
**Claim level:** architecture draft; not runtime proof or implementation claim  
**Parent packet:** `docs/architecture/nervous-system-to-genesis-packet-v0.1.md`

---

## 1. Purpose

This document defines the Mosaic Layer and Meta Layer for ONE/RIO/MUSS.

The Mosaic Layer connects signals, roles, policies, receipts, context, tools, and provenance.

The Meta Layer observes system state, mismatch, open loops, drift, missing authority, proof gaps, and human-return requirements.

Neither layer authorizes consequence.

Keeper line:

```text
Mosaic connects. Meta observes. RIO governs. MUSS proves. Human authorizes.
```

---

## 2. Layer separation

| Layer | Function | May do | May not do |
|---|---|---|---|
| Mosaic | Connects events, provenance, roles, receipts, context, and policies | Relate, trace, surface, link | Authorize, execute, decide consequence |
| Meta | Observes system state and mismatch | Detect deltas, open loops, drift, proof gaps | Approve, execute, silently optimize |
| MANTIS | Watches pattern, continuity, recurrence, prediction error | Surface mismatch and drift | Authorize or override |
| Proxy Coherence Mirror | Displays pre-execution state and deltas | Make prediction visible and auditable | Grant authority |
| RIO | Governs consequence | Allow, hold, clarify, block, invalidate | Rewrite human meaning |
| MUSS | Receipts and preserves proof | Prove defined events | Prove whole truth or final meaning |

---

## 3. Mosaic Layer

The Mosaic Layer is the connective tissue of ONE/RIO/MUSS.

It can be modeled as:

```text
event graph
+ provenance graph
+ policy graph
+ receipt graph
+ context graph
+ role graph
+ tool-state graph
```

Mosaic answers:

```text
What is connected to what?
What changed?
Who or what acted?
Under what role?
Under what authority?
What proof exists?
What pattern is recurring?
```

---

## 4. Mosaic entities

Minimum Mosaic entities:

- `Principal`
- `Role`
- `Delegation`
- `Policy`
- `SignalEvent`
- `PredictionSignal`
- `StateHypothesis`
- `DecisionContract`
- `GateVerdict`
- `Action`
- `Receipt`
- `LedgerEntry`
- `SourceTruth`
- `GroundTruth`
- `PatternTruth`
- `ProtocolRequest`
- `ToolState`

---

## 5. MosaicEvent primitive

```json
{
  "event_id": "evt_001",
  "timestamp": "ISO-8601",
  "actor_principal_id": "principal_001",
  "source": "human|model|tool|connector|rio|mantis|muss|system",
  "target": "resource_or_component_id",
  "event_type": "signal|proposal|gate|execute|receipt|clarify|hold|block|update",
  "policy_refs": ["policy_001"],
  "context_refs": ["context_001"],
  "receipt_refs": ["receipt_001"],
  "state_delta": {
    "delta_type": "authority|scope|intent|evidence|context|role|receipt|learning",
    "severity": "low|medium|high|critical"
  },
  "trace_id": "trace_001"
}
```

---

## 6. Mosaic boundary

Mosaic can reveal relationship. Mosaic cannot grant permission.

Keeper line:

```text
Mosaic connects. It does not authorize.
```

This boundary prevents the connective field from becoming hidden authority.

---

## 7. Meta Layer

The Meta Layer is the state-awareness model of the governed system.

It answers:

```text
Are we aligned?
Are we overreaching?
Are we missing authority?
Are we using stale context?
Are we looping?
Are we drifting?
Are we relying on unproven claims?
Are we treating a pattern as identity?
Are we executing without enough proof?
Does the human need to return?
```

Meta sees. RIO decides. MUSS proves. Human authorizes.

---

## 8. MetaState primitive

```json
{
  "meta_state_id": "meta_001",
  "current_mode": "normal|caution|safe_mode|human_return_required",
  "active_delegations": ["delegation_001"],
  "open_loops": ["loop_001"],
  "unresolved_deltas": ["delta_001"],
  "risk_posture": "low|medium|high|critical",
  "receipt_integrity": "complete|gap_detected|unknown",
  "policy_conflicts": ["policy_conflict_001"],
  "model_disagreement": ["prediction_set_001"],
  "human_return_required": true,
  "sourcepoint_questions": ["question_001"]
}
```

---

## 9. MANTIS as prediction-error witness

MANTIS functions as the prediction-error witness.

It observes mismatch between:

- expected state and actual state
- declared protocol and inferred action
- model confidence and evidence support
- human pattern and machine proposal
- authorized scope and proposed consequence
- active delegation and attempted execution
- receipt requirement and proof availability

MANTIS may surface mismatch, pattern, recurrence, and drift.

MANTIS may not approve, execute, override, or authorize consequence.

Keeper line:

```text
MANTIS watches the mismatch. RIO governs the crossing.
```

---

## 10. Proxy Coherence Mirror as pre-execution proprioception

The Proxy Coherence Mirror functions as the pre-execution proprioceptive dashboard.

It makes machine prediction visible before consequence by showing:

- predicted state
- actual or authorized state
- state hypothesis
- confidence
- alignment delta
- evidence status
- missing rule flag
- authority status
- allowed uses
- required human return

It lets the human see the proposed crossing before the world is touched.

Keeper line:

```text
The Proxy Coherence Mirror is pre-execution proprioception.
```

---

## 11. Open loops

The Meta Layer should detect and surface open loops, including:

- action started without closure
- clarification requested but unresolved
- receipt required but missing
- hold unresolved
- block issued without review path where appropriate
- policy conflict unresolved
- repeated override cluster
- model disagreement unresolved
- stale context still being referenced
- delegation approaching expiration

Open loops are not automatically failures. They are state conditions requiring visibility.

---

## 12. Human return thresholds

Human return is required when:

- authority is missing, unclear, expired, or out of scope
- action consequence exceeds the active envelope
- identity, money, legal, medical, reputational, or public-claim risk appears
- model confidence exceeds evidence support
- repeated overrides suggest miscalibration
- missing rule or protocol ambiguity is detected
- a learning update is proposed
- a policy/invariant change is proposed

---

## 13. Required receipts

Meta and Mosaic events may require receipts when they change governance state.

Receipt-triggering events include:

- RIO handoff
- HOLD
- BLOCK
- CLARIFY
- INVALID
- human override
- policy version used
- authority status assigned
- prediction output with proposed consequence
- receipt gap detected
- protocol update approved
- learning candidate promoted

---

## 14. Keeper lines

- Mosaic connects. It does not authorize.
- Meta sees. RIO decides. MUSS proves. Human authorizes.
- MANTIS functions as prediction-error witness.
- The Proxy Coherence Mirror is pre-execution proprioception.
- MANTIS watches the mismatch. Proxy Coherence Mirror shows the mismatch. RIO governs the crossing. MUSS receipts the return.
- Receipts are digital proprioception.

---

## 15. Short form

**Mosaic connects the field. Meta watches the field. RIO governs the crossing. MUSS proves the return.**
