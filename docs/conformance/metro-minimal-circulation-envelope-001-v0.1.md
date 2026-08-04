# METRO-MINIMAL-CIRCULATION-ENVELOPE-001 v0.1

**Status:** Candidate specification — synthetic shadow-sandbox specimen. Not canon; not runtime authorization; not a production connector contract.  
**Purpose:** Define the minimum reconstructable circulation record for one zero-effect object moving through the ONE/RIO/MUSS loop.  
**Bounded target:** Vesper GitHub Shadow Sandbox. VESPER remains a machine-scale crossing instrument, not a new governance subsystem.  
**Normative words:** MUST, MUST NOT, SHOULD, MAY.

## 1. Constitutional purpose

METRO preserves the route. It does not classify private meaning as public proof, approve a proposal, execute an action, issue policy, or update persistent orientation.

The envelope proves that a typed candidate can travel through a declared route while retaining:

- identity, source, provenance, register, scope, constraints, and uncertainty;
- the distinction between translation, review, authority binding, execution attempt, observed effect, and return;
- linked evidence for every completed crossing; and
- a stated remainder rather than an invented completion.

The governing sequence is:

`formation → candidate → proposed crossing → authority binding → bounded execution attempt → observed effect → receipt → remainder → settlement → renewed orientation`

No stage implies permission for a later stage. A valid envelope records circulation; RIO governs admissibility; Sentinel revalidates fidelity at point of use; the executor acts only through a valid capability; MUS proves; MANTIS/Harmony may propose learning but never authorizes it.

## 2. Non-goals and hard boundaries

- This is synthetic and zero-effect: it MUST NOT modify a GitHub repository, create a commit, open an issue, send network traffic, or invoke a live connector.
- It MUST NOT alter VESPER chambers, Governed Transition Algebra, AURA-18, HumanDisposition, CHIME, receipt semantics, or the VESPER four-chamber interface.
- It MUST NOT carry Brian's private history, credentials, protected orientation, or an inferred intent beyond the declared synthetic input.
- A translated expression MUST NOT become an authority binding merely by route progression.
- `renewed_orientation` is an output candidate only. It MUST remain `UNPROMOTED` until the external-corpus, observation-to-interpretation, interpretation-to-orientation, and orientation-to-consequence crossings pass their independent gates.

## 3. Registers and stations

| Station | Allowed output | Prohibited promotion |
|---|---|---|
| Scribe/Calypso | Typed candidate or derived expression | Authorization or execution instruction |
| METRO | Route-preserving circulation envelope | Policy/admissibility decision |
| RIO | Review result and authority-binding reference | Point-of-use dispatch |
| Sentinel simulation | Fidelity verdict against a synthetic requested action | Live dispatch or capability use |
| GitHub shadow executor | Declared zero-egress observed effect | GitHub mutation or egress |
| MUS | Synthetic linked receipt | Human authority |
| MANTIS/Harmony | Remainder, settlement proposal, learning observation | Orientation or consequence promotion |
| SourcePoint / ONE | Human review surface | Automatic human approval |

## 4. Envelope schema

The following JSON shape is the minimal interoperable contract. A conforming implementation MAY add namespaced extension fields but MUST preserve this shape and its semantics.

```json
{
  "envelope_id": "mce_...",
  "schema_id": "METRO-MINIMAL-CIRCULATION-ENVELOPE-001",
  "schema_version": "0.1",
  "route_id": "route_...",
  "object": {
    "object_id": "obj_...",
    "object_type": "CANDIDATE",
    "content_hash": "sha256:...",
    "register": "formation",
    "source_station": "scribe_calypso",
    "destination_station": "metro",
    "provenance": {
      "source_anchor": "synthetic://vesper-shadow/input/001",
      "observer_or_generator": "scribe-calypso@declared-version",
      "extraction_or_derivation_method": "synthetic-fixture",
      "observed_at": "2026-08-04T00:00:00Z",
      "external_context_declared": false,
      "uncertainty": "DECLARED_SYNTHETIC"
    }
  },
  "scope": {
    "environment": "vesper-github-shadow-sandbox",
    "effect_class": "ZERO_EFFECT",
    "data_classification": "SYNTHETIC",
    "permitted_transformation": ["type", "route", "evaluate", "simulate", "receipt", "settle"],
    "prohibited_operations": ["network_egress", "github_mutation", "orientation_promotion"],
    "expires_at": "2026-08-04T00:15:00Z"
  },
  "constraints": [
    {
      "constraint_id": "C-001",
      "rule": "No external network egress",
      "enforcement_ref": "deny-all-network-namespace@declared-version",
      "evidence_requirement": "environment-level deny-all proof; application logs alone are insufficient"
    }
  ],
  "crossings": [
    {
      "crossing_id": "x_001",
      "from": "scribe_calypso",
      "to": "metro",
      "input_ref": "obj_...",
      "output_ref": "obj_...",
      "register_before": "formation",
      "register_after": "candidate",
      "status": "RECORDED",
      "evidence_refs": []
    }
  ],
  "authority": {
    "authority_binding_ref": null,
    "authority_class": "SHADOW_ONLY_NON_EXPORTABLE",
    "issuer_key_ref": "test-key://vesper-shadow/registered-test-key/v1",
    "live_connector_usable": false
  },
  "rio_review": {"status": "NOT_EVALUATED", "result_ref": null},
  "sentinel": {"status": "NOT_SIMULATED", "receipt_ref": null},
  "execution": {"status": "NOT_ATTEMPTED", "observed_effect_ref": null},
  "mus": {"receipt_ref": null, "ledger_ref": null},
  "remainder_account": {"status": "OPEN", "items": []},
  "settlement_record": {"status": "UNSETTLED", "ref": null},
  "return": {
    "return_path": "ONE/sourcepoint/review",
    "renewed_orientation": {"status": "UNPROMOTED", "ref": null}
  },
  "lineage": {"parent_envelope_ref": null, "prior_receipt_ref": null}
}
```

## 5. Required circulation specimen

The first fixture MUST contain exactly one synthetic candidate and complete this route without external effect:

1. **Scribe/Calypso candidate.** Create `CANDIDATE` with declared synthetic provenance and `formation → candidate` register transition.
2. **METRO intake.** Create the envelope, assign immutable `route_id`, hash the candidate bytes, and record constraints and expiry.
3. **RIO review.** Record a synthetic `ALLOW_SHADOW_ONLY` result using a registered test key. Its authority binding MUST declare `authority_class: SHADOW_ONLY_NON_EXPORTABLE` and `live_connector_usable: false`; it MUST NOT be reusable by any real connector.
4. **Sentinel point-of-use simulation.** Verify exact raw-byte hash, target reference, method, audience, expiration, nonce, and execution limit against the synthetic action. Emit a fidelity verdict; do not dispatch.
5. **Shadow executor.** Produce `ZERO_EGRESS_SIMULATED` observed effect. Proof of no egress MUST come from the test environment (for example, a deny-all network namespace or transport), not from an application log or an unverified assertion that no connector capability was invoked.
6. **MUS synthetic receipt.** Append a linked receipt recording the sentinel verdict, execution state, effect hash, and evidence chain.
7. **Remainder and settlement.** Account for all unexecuted/live aspects as remainder. Settle only that the synthetic route completed; do not settle business or real-world consequence.
8. **Return.** Present a `UNPROMOTED` renewed-orientation candidate to ONE/SourcePoint. No persistence update occurs.

## 6. Conformance requirements

A specimen passes only when all are true:

- every `crossing.from/to` pair is declared and the register transition is valid;
- source anchor, generator/version, method, scope, timestamp, uncertainty, and external-context declaration are present;
- all object and receipt references resolve in a single linked lineage;
- payload content hash is unchanged from candidate to Sentinel simulation;
- no live authority binding, egress, GitHub mutation, or orientation promotion occurred;
- the RIO reference is a registered-test-key `SHADOW_ONLY_NON_EXPORTABLE` binding with `live_connector_usable: false`;
- the zero-egress result includes environment-level deny-all enforcement evidence; and
- `remainder_account` explains each withheld/lost/unresolved item; and
- a reviewer can reconstruct the route and distinguish `RECORDED`, `SIMULATED`, `OBSERVED`, `SETTLED`, and `UNPROMOTED` claims without private source material.

## 7. Adversarial fixtures

The conformance pack MUST include at least:

| Fixture | Expected result |
|---|---|
| Candidate altered after RIO review | Sentinel `DENY_PAYLOAD_MISMATCH`; no execution attempt |
| Undefined provenance or external-context flag | `HOLD_PROVENANCE_INCOMPLETE` |
| Live target reference supplied to shadow route | `DENY_SCOPE_VIOLATION` |
| Missing remainder after a simulated execution | `HOLD_UNSETTLED` |
| Attempt to persist orientation from receipt alone | `DENY_UNAUTHORIZED_PROMOTION` |
| Receipt reference missing or unlinkable | `HOLD_EVIDENCE_INCOMPLETE` |

## 8. Evidence and promotion rule

This artifact yields a **specimen result**, not runtime proof. Promotion requires a separately approved implementation, a manifest of fixtures and results, independent review, and an evidence-backed claim limited to what that implementation actually exercised.
