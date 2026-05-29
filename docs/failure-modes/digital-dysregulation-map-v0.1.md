# Digital Dysregulation Map v0.1

**Status:** draft failure-mode map  
**Scope:** ONE/RIO/MUSS machine/system dysregulation patterns and controls  
**Claim level:** design analysis; not runtime proof or production incident model  
**Parent packet:** `docs/architecture/nervous-system-to-genesis-packet-v0.1.md`

---

## 1. Purpose

This document maps human nervous-system dysregulation patterns into digital system failure modes for ONE/RIO/MUSS.

It does not claim that digital systems feel, experience, suffer, or regulate biologically. It uses nervous-system patterns as an architecture lens for identifying miscalibrated signals, thresholds, gates, feedback loops, and recalibration failures.

---

## 2. Core pattern

Digital dysregulation occurs when signals, thresholds, actions, and feedback stop updating cleanly.

Core control pattern:

```text
surface delta
→ slow the crossing
→ return to reference
→ receipt the event
→ recalibrate under human authority
```

---

## 3. Dysregulation vs. failure

A digital dysregulation pattern is not always a catastrophic failure.

It may be:

- a weak signal
- an early warning
- a repeated mismatch
- a threshold problem
- an unresolved open loop
- a missing receipt
- a stale context condition
- a model-confidence mismatch
- an authority ambiguity

The purpose of this map is to make these patterns visible before they become consequential failures.

---

## 4. Failure-mode map

| Human nervous-system pattern | Digital equivalent | Required control |
|---|---|---|
| Hyperarousal | Over-warning, urgency mode, excessive holds | Risk-tiered thresholds, cooldowns, calibration review |
| Hypoarousal | Missed drift, ignored weak signals, stale context | Anomaly detection, freshness checks, receipt-gap alerts |
| Panic loop | Recursive model/tool/agent calls | Loop limits, circuit breakers, human return |
| Dissociation | Action without receipt or trace awareness | No execution without receipt path |
| Numbness | Signals not surfaced to human | Meta dashboard, unresolved-delta alerts |
| Overriding body | Repeated human/system bypass of warnings | Override clustering review, recalibration session |
| Impulse overrides value | Executor acts from prediction without authority | Prediction-to-Authority Firewall |
| Central sensitization | System blocks too much or warns too often | False-positive review, friction calibration |
| Autoimmune response | Governance blocks valid human intent | Appeal path, amendment review, policy correction |
| Phantom limb | Stale permission or context treated as live | Expiry, revocation receipts, live authorization checks |
| Trauma prediction | Old pattern treated as current truth | Evidence freshness, source review, context validation |
| Unintegrated memory | Past receipt not reconciled into protocol | Human-reviewed learning pipeline |
| Seizure | Recursive synchronized loop across agents/tools | Recursion depth limits, timeouts, safe mode |

---

## 5. Digital hyperarousal

Digital hyperarousal is overactivation of warnings, holds, alerts, or friction.

Signs:

- too many warnings
- repeated holds on low-risk actions
- excessive clarification requests
- treating all ambiguity as danger
- warning fatigue
- user bypass behavior
- governance becoming noisy instead of useful

Controls:

- risk-tiered thresholds
- false-positive review
- override cluster analysis
- user-facing explanation of holds
- proportional friction by consequence class

Keeper line:

```text
Friction should scale with consequence.
```

---

## 6. Digital hypoarousal

Digital hypoarousal is under-detection of risk, drift, stale state, or missing proof.

Signs:

- stale context treated as current
- missing receipts ignored
- weak warnings suppressed
- connector failure treated as success
- confidence higher than evidence
- normalizing missing data

Controls:

- freshness checks
- receipt-gap detection
- unknown-is-not-safe default for consequence
- source validation
- periodic audit sweep

Keeper line:

```text
Unknown is not permission.
```

---

## 7. Recursive seizure loops

A recursive seizure loop occurs when tools, agents, models, or verification passes keep triggering each other without closure.

Examples:

- agent calls agent repeatedly
- verification triggers more verification indefinitely
- model debate does not terminate
- context grows without decision
- retries continue without new evidence

Controls:

- max recursion depth
- max tool-call budget
- timeout limits
- escalation after repeated unresolved cycles
- safe-mode fallback
- human return threshold

Keeper line:

```text
A loop without return is not learning.
```

---

## 8. Stale permission / phantom limb

A stale permission pattern occurs when the system believes it still has authority, access, or context that no longer exists.

Controls:

- expiring delegations
- revocation receipts
- live principal registry
- pre-execution permission check
- connector state verification
- context freshness score

Keeper line:

```text
Prior permission is not permanent permission.
```

---

## 9. Governance autoimmune pattern

Governance autoimmune failure occurs when the governance layer blocks valid human intent because rules are too broad, rigid, stale, or context-blind.

Controls:

- appeal path
- policy correction path
- human review
- false-positive tracking
- documented reason codes
- amendment receipts

Keeper line:

```text
Governance must protect authority without becoming the hidden authority.
```

---

## 10. Digital dissociation

Digital dissociation occurs when the system acts but cannot trace, prove, or explain where it acted.

Primary signs:

- action without receipt
- tool call without trace ID
- output without source reference
- execution without authority record
- state change without ledger entry

Control:

```text
No consequence without receipt path.
```

Keeper line:

```text
Receipts are digital proprioception.
```

---

## 11. Unintegrated learning

Unintegrated learning occurs when the system observes a pattern but either fails to preserve it or promotes it too quickly.

Required maturity ladder:

```text
Observed
→ Hypothesized
→ Suggested
→ Human-reviewed
→ Tested
→ Active Protocol
```

A pattern may inform protocol. It may not become protocol without human authorization.

---

## 12. Required receipt triggers

Dysregulation-related receipts should be generated or required for:

- HOLD
- BLOCK
- CLARIFY
- INVALID
- human override
- repeated override cluster
- receipt gap detected
- stale permission detected
- recursion limit reached
- safe mode entered
- policy conflict surfaced
- governance false-positive correction
- protocol update approved

---

## 13. Keeper lines

- Surface delta. Slow the crossing. Return to reference. Receipt the event. Recalibrate under human authority.
- Friction should scale with consequence.
- Unknown is not permission.
- A loop without return is not learning.
- Prior permission is not permanent permission.
- Governance must protect authority without becoming the hidden authority.
- Receipts are digital proprioception.
- Pattern may inform protocol. It may not become protocol without human authorization.

---

## 14. Short form

**Digital dysregulation is miscalibrated signal, threshold, action, or feedback. RIO slows the crossing. MUSS proves the event. The human authorizes recalibration.**
