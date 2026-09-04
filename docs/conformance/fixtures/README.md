# Vesper Shadow Conformance Fixture

This directory contains a local-only, synthetic conformance fixture for the
merged Vesper Shadow Circulation Conformance Pack. It is a reproducible
engineering specimen, not a live connector, authority service, deployment, or
production-security claim.

## Run

Requirements: Python 3.11+ and the `cryptography` package.

```bash
python3 -m pip install cryptography
python3 vesper_shadow_runner.py
```

The runner loads `VESPER-SHADOW-FIXTURE-PERFORMANCE-MANIFEST-001-v0.1.json`
relative to its own file and evaluates its eight declared fixtures.

Expected terminal behavior:

- the sole positive route returns `RETURNED_UNPROMOTED` after
  `SIMULATED_NO_EGRESS`;
- refusal and fault cases remain non-promoting, including `OUTCOME_UNKNOWN`
  when no-egress evidence is unavailable; and
- the synthetic Ed25519 test key exists only in process memory and is never
  represented as human authority.

The positive fixture can also be exported as a durable machine-readable
packet for the bounded occurrence-to-Return specimen:

```bash
python3 vesper_shadow_runner.py \
  --fixture VSF-001-HAPPY-SHADOW-ROUTE \
  --output /tmp/vesper-export.json
```

Its in-run `SettlementRecord` is deliberately provisional. It does not settle
Observation, Evidence, durable MUS incorporation, recipient Return, external
outcome, human authority, production behavior, federation, or Human Return.
Those obligations cannot be borrowed from the fixture's terminal label.

## Claim boundary

`DenyAllEnvironment` is a local fixture boundary. Its attestation shows only
that this runner did not provide a transport path. It is not OS-level namespace
proof, a production firewall claim, live GitHub behavior, or evidence of an
external-world outcome.

See
[`../VESPER_OCCURRENCE_RETURN_CLOSURE_v0.1.md`](../VESPER_OCCURRENCE_RETURN_CLOSURE_v0.1.md)
for the separate persisted episode and fresh-process verifier.
