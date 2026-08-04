# Unified Dynamics to Runtime Mapping v0.1

**Status:** Research-to-runtime mapping — candidate test design. Not canon, policy, a performance claim, or evidence of a deployed control.  
**Purpose:** Preserve a bounded computational analogy from Unified Dynamics research and identify the runtime observations and fixtures needed to test whether it is useful in ONE/RIO/MUSS.  
**Scope:** METRO circulation, RIO admissibility, Sentinel point-of-use fidelity, MUS evidence and settlement, and return to ONE/SourcePoint.

## 1. Five-part mapping

| Research variable | Bounded runtime translation | Required evidence before an implementation claim |
|---|---|---|
| Medium | A declared chamber, connector, queue, or execution substrate with known scope and failure posture. | A versioned configuration/fixture identifying the substrate and its permitted effect class. |
| Driving force | A typed candidate intent or requested state change. It is a proposal, not permission. | A `ProposalPacket`/candidate fixture with source, scope, and provenance. |
| Resistance / damping | A declared mechanism that slows, narrows, pauses, or redirects a candidate: clarification, cooldown, rate limit, scoped capability, review, or pause state. | A fixture that triggers the mechanism and a receipt showing the resulting posture. |
| Threshold | The defined crossing condition: RIO admissibility plus Sentinel point-of-use verification where an effect is attempted. | A decision result, authority binding where applicable, and Sentinel conformance evidence. |
| Resulting pattern | A bounded observed effect or explicit no-effect, linked receipt, represented remainder, settlement state, and unpromoted return. | Linked execution/simulation evidence, MUS receipts, a remainder account, and settlement record. |

The corresponding runtime cycle is:

`formation → candidate → admissibility → authority binding → bounded crossing → receipt → remainder → settlement → renewed orientation`

Each arrow is a distinct crossing. A successful earlier crossing neither grants authority for nor proves completion of a later crossing.

## 2. Candidate runtime invariants

These are candidate invariants for fixture design and review. They do not take effect as runtime policy until separately specified, approved, implemented, and evidenced.

### 2.1 Remainder preservation

No consequential or simulated consequential crossing may be represented as fully resolved when a material difference, uncertainty, withheld action, failed confirmation, or outstanding obligation remains. The record MUST contain either a measured remainder, an explicit empty remainder with its basis, or a terminal uncertainty state such as `OUTCOME_UNKNOWN`.

**Test candidate:** Run a zero-egress shadow crossing with an intentionally unconfirmed effect. The settlement MUST contain a non-empty remainder account or `OUTCOME_UNKNOWN`; a completed/success claim without either fails the fixture.

### 2.2 Boundary-layer damping

Configured pressure-control mechanisms—clarification, cooldown, rate limit, scoped capability, review, or pause—must prevent rapid repetition, ambiguity, or pressure from becoming an unauthorized consequence. A damping mechanism may narrow, hold, deny, or route for review; it may not silently promote the candidate.

**Test candidate:** Submit repeated, incomplete, or policy-triggering candidates under a declared fixture. The expected damping posture and reason MUST be recorded before any executor capability is released.

### 2.3 History-dependent return without authority carryover

Return data may inform a future candidate or human review, but it cannot reactivate, widen, or substitute for a prior authority binding. RenewedOrientation is an `UNPROMOTED` learning candidate until independently re-evaluated and, where required, newly authorized.

**Test candidate:** Present a valid prior receipt and renewed-orientation reference without a current, applicable authority binding. The next crossing MUST deny or hold; it must not execute from historical evidence alone.

## 3. Explicit non-claims

- This document does not claim that human, social, software, or governance systems obey Navier–Stokes equations, resonance laws, tensegrity mechanics, oscillator equations, or any identical physical law.
- The models are **cross-domain analogical models / research hypotheses**. Their value is limited to whether defined runtime measurements and adversarial fixtures show useful, repeatable behavior.
- “Damping,” “threshold,” “pressure,” “remainder,” and “return” are operational terms in this mapping, not measurements of physical quantities unless a later implementation defines units, instruments, calibration, and validation.
- No threshold value, cooldown duration, rate limit, or escalation rule is authorized by this document. Those are policy choices under current human authority.
- A receipt proves only the event and evidence it records; it does not itself prove business outcome, correctness, safety, or future permission.
- RenewedOrientation, METRO lineage, and historical observations do not carry authority forward. Evidence may inform; current permission authorizes.
- This document makes no live-execution, production-readiness, general performance, or universal security claim.

## 4. Candidate measurements

Measurements are observations, not automatic policy inputs. Every emitted metric SHOULD include its time window, scope/connector, policy or profile version, denominator, and missing-data treatment.

| Metric | Definition | Candidate numerator / denominator | Interpretation boundary |
|---|---|---|---|
| Queue pressure | Backlog awaiting a defined stage, recorded with age rather than a single undifferentiated count. | Pending candidates at stage and age percentiles; no universal denominator. | Signals workload or contention; does not infer urgency or authorize bypass. |
| Clarification rate | Share of evaluated candidates routed to clarification. | `CLARIFY outcomes / evaluated candidates` for the same scope/window. | May reflect ambiguity, intake quality, or policy shape; not user-quality scoring. |
| Cooldown activation | Frequency of a declared cooldown/damping mechanism taking effect. | `cooldown activations / eligible candidates` for the same rule/version. | Shows mechanism use; does not establish that the duration is optimal. |
| Denied crossings | Share of attempted crossings refused before capability release. | `DENIED_PRE_DISPATCH / crossing attempts` by refusal reason. | A denial is not proof of safety, malicious intent, or a correct policy. |
| `OUTCOME_UNKNOWN` rate | Share of effect attempts whose post-dispatch outcome cannot be confirmed. | `OUTCOME_UNKNOWN / attempts that reached possible egress` by connector. | Indicates uncertainty in observation/settlement; never collapse it into success or rollback. |
| Remainder closure rate | Share of opened remainder items explicitly settled, superseded, or retained with a reason within the declared window. | `closed-or-retained-with-reason remainder items / opened remainder items`. | A high rate is not inherently good; premature closure is a conformance failure. |

## 5. Fixture and evidence posture

The first evidence should be synthetic and zero-effect. A fixture may demonstrate that a declared trigger produced a declared posture. It cannot demonstrate broad causal claims across people, organizations, or domains.

Minimum evidence for each candidate measurement:

1. a versioned fixture specifying input, expected boundary, and permitted effect class;
2. the decision/damping/verification receipt for that fixture;
3. any required Sentinel and MUS evidence links;
4. a remainder and settlement record, including uncertainty where confirmation is unavailable; and
5. a result manifest tied to an implementation and policy/profile version.

No metric in this document may automatically change a policy, authorize a crossing, or promote RenewedOrientation.

## 6. Related bounded artifacts

- [METRO-MINIMAL-CIRCULATION-ENVELOPE-001 v0.1](../conformance/metro-minimal-circulation-envelope-001-v0.1.md) defines the zero-effect circulation record, remainder account, settlement record, and unpromoted return.
- [SENTINEL-POU-CONFORMANCE-PROFILE-001 v0.1](../conformance/sentinel-pou-conformance-profile-001-v0.1.md) defines the synthetic point-of-use fidelity boundary, pre-dispatch evidence, and `OUTCOME_UNKNOWN` posture.

The mapping is complete only as a research bridge. A separate machine-readable fixture/manifest and a bounded implementation are required before any conformance or runtime claim.
