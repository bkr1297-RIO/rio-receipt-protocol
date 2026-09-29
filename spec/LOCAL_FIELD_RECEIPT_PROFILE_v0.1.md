# ONE Local Field — gateway receipt lineage profile v0.1

Status: draft adaptation for architecture R-07 / #322, not a redesign or canonization of receipts. Runtime: `rio-system/gateway/receipts/receipts.mjs`; portable passage semantics: `rio-protocol/spec/local-field-v0.1.md`; architecture contract: `one-rio-muss-architecture/docs/architecture/local-field/ONE-LOCAL-FIELD-BUILD-SPEC-v0.1.md`.

## Compatibility boundary

The current gateway already emits a native five-hash receipt: intent → governance → authorization → execution → receipt. This differs from this repository's standalone flat `RIO_RECEIPT_PROTOCOL_v0.1.md` format and its SPKI key serialization. Local Field preserves the gateway format and hash recipe. It does **not** pass a gateway receipt to the standalone flat-format verifier or claim wire equivalence. Neither existing generator is replaced.

The optional `local_field_attestation` seals the complete native receipt under the separately enrolled receiver's Ed25519 key. Its fields are `profile: rio-gateway-local-field-v0.1`, `field_id`, `passage_id`, `signer_id`, `signature`. Sign `{receipt: <native receipt without attestation>, binding: <attestation without signature>}` using the shared strict sorted JSON encoding. Raw 32-byte gateway keys can be wrapped in Ed25519 SPKI for independent verification; this is a serialization adaptation, not a second identity root.

## Existing artifact mappings

| Concern | Native artifact / binding |
|---|---|
| Source intent, requested subject/action/target | `intent.parameters.passage` and its signed envelope |
| RIO admission | `governance.checks.decision`, with separate decision ID and exact passage hash |
| Authority/delegation | `authorization.conditions.lineage`, signed grant records in root-to-leaf order |
| Point-of-use fidelity | `execution.result.fidelity`, separate outcome and admitted hash |
| Attempt | `execution.result.attempt`, attempt ID, exact operation and receiver |
| Occurrence claim | `execution.result.occurrence`, observation ID, method, content hash and status |
| Multi-node provenance | `execution.result.provenance`: proposed, admitted, attempted, observed, returned |
| Result | `execution.result.adapter`; never equated with observation by itself |
| Return | Persisted passage/intent/correlation/receipt IDs and disposition; the complete Return is separately signed by the same enrolled receiver, and correlation is also inside the signed execution artifact |
| Ledger | Existing gateway entry hash recipe in its durable local backend; full entries are available through a root-signed read-only query |

Proposed and receiving nodes use distinct enrolled keys. In the v0.1 filesystem profile, admission, attempt, observation and Return belong to the receiver, each represented separately. The receiver reads the file through a separate descriptor after writing. That is an observation method within receiver custody, not an independent MANTIS witness. The acceptance driver additionally reads the file from a separate process and records that evidence independently.

## Verification and proof ceiling

`verifier/local-field.js` is a read-only profile verifier for exported gateway artifacts. The caller must supply the root key out of band. It validates root-signed enrollment, distinct keys, receiver attestation, signed passage/grant lineage, native five hashes, exact decision/attempt/occurrence relationships and the complete Return signature and correlation. It creates no receipt, authority, nonce or ledger entry. Historical receipt validity does not mean a grant is still current after revocation.

Return attestation has profile `rio-gateway-local-field-return-v0.1`, field ID, signer ID and Ed25519 signature over `{returned: <Return without attestation>, binding: <attestation without signature>}`. This binds outcome, recipient, time, reason and identifiers, including held/unsettled Returns that have no completed receipt. It is a Return transport/proof binding, not a second receipt generator.

`node --test test/local-field-profile.test.js` checks an actual runtime-exported proof plus tampering cases. Fixture provenance is the included run ID and timestamp; no mock execution is represented. The full live trace and restart evidence remain in `rio-system/docs/evidence/one-local-field-v0.1/acceptance-trace.json`.

Receipt integrity is not occurrence truth. A failed or interrupted adapter/observer can produce an unknown occurrence; an unfinished attempt becomes an unresolved Return after restart. Receipt creation cannot rewrite the prior RIO decision or turn a denial into an authorization. Complete host compromise or rollback of all trusted storage is outside this local custody profile.
