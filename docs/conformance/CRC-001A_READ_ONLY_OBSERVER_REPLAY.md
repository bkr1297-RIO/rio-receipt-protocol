# CRC-001A — Read-Only Observer Replay / Bounded Observation Profile

**Profile ID:** `CRC-001A-OBS-RO-20260904`  
**Status:** `SPECIFIED_NOT_EXECUTED`  
**Standing:** Candidate bounded observation profile; not MANTIS admission, not independent proof, and not a promotion event.

## Purpose

CRC-001A defines the smallest observer replay that can follow the CRC-001 live documentation occurrence without creating another occurrence.

The observer must retrieve the already-declared repository state through a read-only boundary and verify the exact pinned object. A valid replay is an observation of the declared document proposition; it is not authority, permission, evidence assessment, settlement, successor standing, or Human Return.

## Parent occurrence

- **Crossing:** `CRC-001-LIVE-DOC-20260904`
- **Parent PR:** [#31](https://github.com/bkr1297-RIO/rio-receipt-protocol/pull/31)
- **Repository:** `bkr1297-RIO/rio-receipt-protocol`
- **Writer branch:** `crc-001-live-docs-only-20260904`
- **Occurrence commit:** `0344b2965a9c00afd7e7b3f21ce0ebc8932bba86`
- **Target path:** `docs/conformance/CRC-001_LIVE_DOCUMENTATION_ONLY_CROSSING.md`
- **Expected blob SHA:** `413f562acd093676ba286cdf2c6fed0f5fae33ea`
- **Expected content SHA-256:** `e82a47a070d1ebb293e280773c6d25fea14614afe03c5e60e1cd87a4ed80fd26`
- **Expected content length:** `1822` bytes

The observer is pinned to the occurrence commit, not to a moving branch tip.

## Observer boundary

A future execution may be called an observer replay only if all of the following are recorded before retrieval:

1. **Separate process or service:** the observer is not the process that created the branch, commit, or PR.
2. **Separate credential or custody boundary:** the observer credential is read-only for this repository and cannot create branches, write files, update refs, merge, deploy, or publish.
3. **Attributable profile:** the observer profile, credential class, run identifier, and access time are recorded.
4. **No self-certification:** the observer reports the retrieved facts; it does not authorize the occurrence, declare constitutional lawfulness, or own the authoritative ledger.
5. **Fail-closed mismatch:** inability to prove read-only scope, credential separation, exact ref, or expected bytes yields a refusal state rather than a successful observation.

The CRC-001 connector readback is a distinct retrieval event, but it uses the same connector family as the writer and is therefore **not** independent observer custody. It must not be relabeled as MANTIS evidence.

## Replay procedure

A designated observer performs only these steps:

1. Resolve repository identity and the exact occurrence commit.
2. Retrieve the target path at commit `0344b2965a9c00afd7e7b3f21ce0ebc8932bba86`.
3. Verify the returned path, commit/ref, blob SHA, UTF-8 byte length, and content SHA-256 against the pinned values above.
4. Record the observer profile, read-only permission evidence, retrieval timestamp, request/run identifier when available, and the comparison result.
5. Emit one observation record with no write, ref update, comment, review, merge, deployment, publication, or production-data mutation.
6. Preserve any mismatch, unavailable credential, or permission ambiguity as an explicit refusal/hold.

## Result vocabulary

- `OBSERVED_MATCH`: the exact pinned object was retrieved through a proven read-only observer boundary.
- `OBSERVED_MISMATCH`: one or more pinned identity or content checks failed.
- `OBSERVER_NOT_INDEPENDENT`: the observer boundary is not separate from the writer or its custody.
- `OBSERVER_UNAVAILABLE`: the required read-only profile could not be established or invoked.
- `REPLAY_REFUSED`: the procedure stopped before making an observation because a prerequisite was not satisfied.

Only `OBSERVED_MATCH` with the boundary conditions satisfied may be supplied to a later evidence-assessment step. None of these result labels creates authority or successor standing.

## Hostile fixtures

The observer profile must refuse or downgrade:

- branch-tip substitution for the pinned occurrence commit;
- path substitution;
- commit, tree, or blob mismatch;
- content hash or byte-length mismatch;
- a writer-capable token presented as read-only;
- the same credential or mutable workflow being used for both write and observation;
- missing permission evidence;
- an observer that attempts a write, comment, review, ref update, merge, or deployment;
- a successful retrieval presented as proof of human identity, constitutional lawfulness, external-world consequence, or settlement.

## Claim ceiling and non-effects

If the replay is later executed successfully, the maximum immediate claim is:

`CONNECTOR_READ_ONLY_REPLAY_OF_DECLARED_GITHUB_DOCUMENT`

This profile does not establish independent human authority, MANTIS admission, independent key custody, constitutional lawfulness, authoritative MUS custody, settlement, succession, federation activation, production readiness, or Human Capacity Return.

This PR itself is inert documentation. It creates no observer credential, performs no replay, changes no executable code, and does not merge or promote PR #31.

## Next gate

Designate a separately governed read-only observer, execute this replay against the pinned commit, preserve the observation record, and only then decide whether the result can enter the authoritative occurrence-to-Return route.

**Keeper:** A readback can confirm a repository fact. Independence must be established before it can carry independent observation standing.

`Δ MachineAuthority = 0`
