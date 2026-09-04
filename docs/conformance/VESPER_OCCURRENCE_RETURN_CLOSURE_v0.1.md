# Vesper Occurrence-to-Return Closure v0.1

## Standing

This is one reconstructable, fixture-local proof episode built from the
existing Vesper synthetic runner and the existing MUS receipt engine.

Its successful standing is:

```text
SINGLE_DOMAIN_OCCURRENCE_TO_RETURN_FIXTURE_CLOSED_LOCAL_SYNTHETIC_ZERO_EGRESS
```

It is a precursor to the first witnessed constitutional crossing. It is not
that crossing, and it does not activate federation.

## Executed lineage

The fixture persists and binds:

```text
Pre-dispatch record
  -> Execution attempt
  -> Fixture-local occurrence
  -> Separately started observer process
  -> Evidence decision
  -> MUS record admission and signed receipt
  -> Fsynced, hash-linked MUS ledger
  -> Scope-bounded settlement
  -> Recipient-specific return envelope
  -> SourcePoint receipt acknowledgement
  -> Fresh-process reconstruction as RETURNED_UNPROMOTED
```

The original Vesper `SettlementRecord` remains a provisional source record.
It explicitly leaves observation, MUS incorporation, return acknowledgement,
external outcome, authority, production, federation, and Human Return
unsettled. Only the downstream signed `SettlementDecision` can settle the
narrow local proposition after the receipt and chain have verified.

## Run

Requirements: Node.js 18+, Python 3.11+, and Python `cryptography`.

```bash
npm run test:occurrence-return
npm run closure:vesper
```

To retain the durable packet for inspection, supply a new or empty directory:

```bash
npm run closure:vesper -- /tmp/vesper-closure-packet
```

The producer refuses a non-empty directory before writing. A failed or
completed packet directory is single-use; choose a new empty directory for a
new episode.

The runner starts a producer process, persists the artifacts, then starts a
fresh verifier with producer-emitted expected MUS and Return journal heads
passed as out-of-band process arguments. This exercises checkpoint comparison
but does not establish an externally governed checkpoint service. The
verifier—not the producer's terminal label—derives the bounded terminal state.

## Failure behavior exercised

The suite confirms that closure fails when:

- a persisted occurrence is tampered with;
- Observation or Evidence is absent;
- the MUS signer is not in the supplied trust set;
- the Return journal is clean-prefix truncated relative to its expected head
  and count;
- Return attempts to create future authority;
- Settlement is requested before receipt and chain verification; or
- the exact MUS receipt is replayed.

The reusable receipt core separately exercises signed-body integrity, trust,
duplicate receipt IDs, duplicate approval nonces, pre-append chain integrity,
and expected-head/count verification.

## Explicitly unresolved

- live human-authored authority;
- independently governed observation or evidence services;
- OS-level no-egress enforcement;
- any external GitHub effect or outcome;
- production key custody, concurrency control, or security;
- an externally governed trust root or checkpoint service;
- succession or Typed Incorporation;
- Human Return measurement; and
- multiple jurisdictions, SharedWorld, Door, or federation.

The next proof must replace, rather than verbally upgrade, at least one of
those synthetic seams.
