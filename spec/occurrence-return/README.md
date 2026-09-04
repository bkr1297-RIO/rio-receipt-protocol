# Occurrence-to-Return Closure v0.1

This directory types the artifacts used by one local, synthetic, zero-egress
Vesper proof episode. It closes a fixture lineage; it does not close a live
constitutional crossing.

## Identity rule

The implementation keeps these objects distinct:

```text
Attempt != Occurrence != Observation != Evidence != Receipt
        != Settlement != Return != Acknowledgement
```

A valid Door or authorization can admit an attempt. It does not prove an
occurrence. The Vesper source `ExecutionReceipt` and the durable MUS receipt
remain separate records and are hash-bound in the same lineage. Neither
self-establishes Observation or Evidence, and neither is evidence of an
external outcome. Settlement is scope-bound, and Return creates no new
authority, succession, incorporation, learning, or promotion.

## Derivation rule

`RETURNED_UNPROMOTED` may be derived only after a newly started verifier:

1. reads the persisted Vesper export;
2. verifies the signed attempt and local occurrence;
3. verifies separately signed Observation and Evidence Decision artifacts;
4. verifies the MUS receipt, trusted signer, ledger chain, expected ledger
   head, and expected record count;
5. verifies the signed Settlement, Return Envelope, and recipient-specific
   Return Acknowledgement plus their hash links; and
6. confirms that all authority, succession, incorporation, learning, and
orientation-promotion effects remain `NONE` or `false`.

References to the signed downstream artifacts and the Return-journal head hash
the complete artifact, including its attestation, signer key, and signature.
MUS retains its protocol `receipt_hash` over the signed receipt body and also
emits `mus_signed_receipt_hash` where this fixture must bind the complete
signed receipt. Re-signing an unchanged body under a substituted role key
therefore changes the full checkpoint and fails reconstruction.

The role slots use distinct fixture-generated keys, but the producer holds
those private keys in one process. This demonstrates typed role/key separation,
not independent custody or real recipient control.

## Claim ceiling

The strongest successful result is:

```text
SINGLE_DOMAIN_OCCURRENCE_TO_RETURN_FIXTURE_CLOSED_LOCAL_SYNTHETIC_ZERO_EGRESS
```

It does not establish live human authority, OS-level no-egress enforcement,
an external GitHub occurrence or outcome, production security, succession,
an externally governed trust root, federation, or Human Return.

See [`closure-artifacts.schema.json`](closure-artifacts.schema.json) for the
signed artifact shapes and
[`../../docs/conformance/VESPER_OCCURRENCE_RETURN_CLOSURE_v0.1.md`](../../docs/conformance/VESPER_OCCURRENCE_RETURN_CLOSURE_v0.1.md)
for the executable specimen and hostile-fixture boundary.
