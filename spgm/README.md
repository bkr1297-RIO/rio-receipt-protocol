# SPG-M Receipt-Compatible Profile

SPG-M — Symbolic Pattern Governance Module — is an optional receipt-compatible profile/adapter for the RIO Receipt Protocol.

It maps ambiguous pattern-governance outcomes into the current `ALLOW` / `BLOCK` receipt primitive without changing the core receipt engine.

## Boundary

SPG-M may:

- classify pattern-governance outcomes,
- add SPG-M boolean checks,
- add hash-bound SPG-M metadata under `validation.spgm`,
- map containment, refusal, escalation, and failure to `BLOCK`,
- prepare receipt-compatible validation context.

SPG-M may not:

- add new normative decision enums,
- authorize Class 3–5 action,
- create persistent memory without MUSS,
- treat symbolic interpretation as fact,
- treat machine output as authority,
- replace RIO governance,
- modify receipt cryptography or hash-chain behavior.

## Current Mapping

| SPG-M outcome | Receipt decision |
|---------------|------------------|
| `PROCEED` | `ALLOW` only if human-authorized, low-risk/governed, and existing receipt checks pass |
| `HOLD` | `BLOCK` |
| `CONTAIN` | `BLOCK` |
| `REFUSE` | `BLOCK` |
| `ESCALATE` | `BLOCK` or no execution receipt until governance completes |
| `FAIL` | `BLOCK` |

## Files

- `constants.js` — profile constants, outcome names, and check names.
- `spgm-checks.js` — boolean SPG-M doctrine/gate checks.
- `map-spgm-to-receipt.js` — maps SPG-M runtime outcomes into receipt-compatible validation objects.

## Doctrine

> Symbolic interpretation never creates authority. Machine output never creates authority. Recurrence is not proof. Pattern promotion does not create authority.
