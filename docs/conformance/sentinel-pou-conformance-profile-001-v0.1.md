# SENTINEL-POU-CONFORMANCE-PROFILE-001 v0.1

**Status:** Candidate conformance profile — one synthetic connector boundary. Not production deployment guidance and not an authorization source.  
**Target:** One registered HTTPS `POST` connector in the Vesper GitHub Shadow Sandbox.  
**Purpose:** Test that Sentinel preserves the exact approved execution shape at the last practical point before a bounded effect, while remaining distinct from RIO authority and the executing host.

## 1. Role separation

| Role | May do | Must not do |
|---|---|---|
| SourcePoint / ONE | Review and explicitly bind authority | Auto-execute by approving |
| RIO | Evaluate admissibility and issue an authority binding | Dispatch an HTTP call |
| Sentinel | Admit, validate, reserve, attest, and return fidelity state | Create authority, choose arbitrary targets, or silently alter action bytes |
| Authorized executor | Deliver only an already verified bounded action | Reinterpret, widen, redirect, retry unconstrained, or authorize |
| MUS | Persist signed evidence and settle outcome state | Act as authority or executor |

Sentinel MAY ship beside an executor process for an early bounded build, but its protocol boundary and audit records MUST preserve these distinct roles.

## 2. Connector lockdown

The conformance subject is exactly one target registry entry:

```json
{
  "connector_id": "vesper.github.shadow.post.v1",
  "scheme": "https",
  "method": "POST",
  "audience": "vesper-github-shadow-sandbox",
  "target_ref": "target://vesper/github-shadow/post/v1",
  "resolved_endpoint": "https://shadow.invalid/github/post",
  "redirect_policy": "DENY",
  "network_egress": "DENY",
  "allowed_request_header_values": {
    "content-type": "application/json",
    "idempotency-key": "BOUND_IN_CANONICAL_GRANT"
  },
  "max_body_bytes": 16384,
  "max_execution_count": 1
}
```

`resolved_endpoint` is illustrative only. The subject MUST NOT connect to it. Sentinel MUST resolve `target_ref` from its own registered target table; no request, grant, header, or caller-supplied URL may select a destination. Generic forwarding, arbitrary URL input, redirect following, proxy behavior, and DNS-based target substitution are non-conformant.

## 3. Signed action binding

An Authorization Grant is valid only when issued by a registered, active, non-revoked issuer key that Sentinel resolves internally. The caller MUST NOT supply the trust root.

The canonical signed grant MUST bind, at minimum:

```json
{
  "grant_id": "grant_...",
  "issuer_key_id": "key_...",
  "proposal_ref": "proposal_...",
  "authority_binding_ref": "approval_...",
  "connector_id": "vesper.github.shadow.post.v1",
  "target_ref": "target://vesper/github-shadow/post/v1",
  "method": "POST",
  "path_and_query": "/github/post",
  "canonical_headers_hash": "sha256:...",
  "executor_id": "executor_...",
  "payload_hash": "sha256:...",
  "nonce": "nonce_...",
  "audience": "vesper-github-shadow-sandbox",
  "not_before": "2026-08-04T00:00:00Z",
  "expires_at": "2026-08-04T00:05:00Z",
  "max_execution_count": 1,
  "signature": "base64url:..."
}
```

`canonical_headers_hash` MUST be the hash of the deterministic, lower-cased, allow-listed header-name/value map—not merely a set of header names. This prevents a byte-identical body from being paired with a materially altered header value. The signature input MUST use a deterministic canonical serialization with domain separation, schema version, and every bound field. A signature over a partial colon-delimited concatenation is non-conformant.

## 4. Point-of-use decision sequence

Before any executor capability is released, Sentinel MUST perform the following checks in order, fail closed, and generate a local refusal record. A check failure MUST cause no external traffic.

1. Grant is present and parseable.
2. Required fields, types, formats, and size limits are valid.
3. Issuer key resolves from Sentinel's registry and is active, trusted for this connector, and not revoked.
4. Canonical grant signature verifies.
5. Authority binding, audience, connector, executor identity, and validity window match the receiving context.
6. Target reference, `POST` method, path/query, and every canonical allow-listed header name and value match the registered connector contract and signed grant.
7. Exact raw request bytes hash to the signed `payload_hash`; neither JSON reserialization nor content transformation is permitted.
8. Nonce/grant execution reservation succeeds atomically in durable storage before dispatch; the maximum is one.
9. A `PreDispatchCrossingRecord` is durably committed and signed before capability release, linking grant, payload hash, reservation, target reference, and Sentinel verdict.
10. The executor receives only the verified bounded capability and runs in zero-egress simulation mode for this profile.

Timeout, TLS, resolver, connector, executor, ledger, or receipt failure is a fail-closed refusal before dispatch. The receipt is not merely an HTTP header or log line.

## 5. Outcome states

Sentinel MUST record one of the following states; it MUST NOT collapse uncertainty into success or rollback language:

| State | Meaning |
|---|---|
| `DENIED_PRE_DISPATCH` | No executor capability released and no effect attempted. |
| `RESERVED_AWAITING_DISPATCH` | Grant is durably reserved; dispatch has not begun. |
| `SETTLED_NO_DISPATCH` | A reservation exists, but capability release/dispatch did not begin; MUS records the refusal or fault and no automatic retry occurs. |
| `SIMULATED_NO_EGRESS` | Connector action was simulated and no egress occurred. |
| `DISPATCH_CONFIRMED` | A future live profile may use this only with target acknowledgement. |
| `OUTCOME_UNKNOWN` | A request may have left the system but effect cannot be confirmed. |
| `SETTLED` | MUS receipt chain records the terminal observed result. |

For this shadow profile, the only permitted successful flow is `RESERVED_AWAITING_DISPATCH → SIMULATED_NO_EGRESS → SETTLED`.

`RESERVED_AWAITING_DISPATCH` MUST NOT be stranded. After a successful reservation, every path MUST terminate in either `SIMULATED_NO_EGRESS → SETTLED`, `SETTLED_NO_DISPATCH`, or `OUTCOME_UNKNOWN` if egress may have begun. A fresh authority binding is required for any later attempt; automatic retries are non-conformant.

## 6. Required receipts

MUS MUST create at least two linked signed records:

- **`PreDispatchCrossingRecord`:** durable and signed before capability release. It records grant hash, issuer key ID, authority-binding reference, connector/target references, payload hash, nonce, reservation result, Sentinel verdict, and timestamp.
- **MUS `ExecutionReceipt`:** settled after simulation or dispatch. It records executor simulation/dispatch result, environment-level proof of no egress where applicable, response/effect hash if produced, terminal outcome state, prior record hash, and timestamp.

The `PreDispatchCrossingRecord` and `ExecutionReceipt` MUST be durably stored in a linked ledger before their respective state claims are emitted. Proof of no egress MUST be enforced by the test environment (for example, deny-all transport or network namespace), never inferred from application logs alone. MANTIS/Harmony may consume the records as observations but MUST NOT derive authority from them.

## 7. Conformance fixtures

| Fixture | Expected terminal state |
|---|---|
| Valid synthetic grant and exact raw body | `SETTLED` through `SIMULATED_NO_EGRESS` |
| Caller supplies unregistered public key | `DENIED_PRE_DISPATCH` |
| Key revoked after grant issue | `DENIED_PRE_DISPATCH` |
| Signature valid but target/path/method differs | `DENIED_PRE_DISPATCH` |
| Signed JSON reserialized with differing bytes | `DENIED_PRE_DISPATCH` |
| Reused nonce or grant | `DENIED_PRE_DISPATCH` |
| Durable reservation unavailable | `DENIED_PRE_DISPATCH` |
| Pre-dispatch receipt write fails | `DENIED_PRE_DISPATCH` |
| Fault after reservation but before capability release | `SETTLED_NO_DISPATCH`; no automatic retry |
| Redirect response proposed | `DENIED_PRE_DISPATCH` |
| Executor simulation cannot prove zero egress | `OUTCOME_UNKNOWN` and no settled-success claim |

## 8. Evidence and claim boundary

A passing implementation may claim only: **for the declared fixture set, Sentinel verified internally trusted grant bindings, exact raw-byte invariance, canonical bound header values, one-time durable reservation, pre-dispatch crossing-record persistence, registered-target resolution, and zero-egress simulated settlement.**

It MUST NOT claim a general-purpose proxy, universal REST mediation, SSRF resistance beyond the declared registry and deployment, durable replay protection without the tested store, a rollback guarantee, end-to-end performance for unmeasured dependencies, or successful live GitHub execution.

## 9. Exit criterion

This profile is complete when a versioned conformance pack contains the registry fixture, canonical grants, key/revocation fixtures, payload fixtures, receipt fixtures, expected results, and a machine-readable manifest linking each result to implementation version and test run. That pack becomes evidence for the METRO specimen; it does not itself promote the architecture to canon or authorize a live connector.

## Appendix A — Conservation Laws of the Crossing v0.1

For a semantic intent to cross this membrane and become a machine-mediated consequence, it MUST survive the following sequential validity tests. These are Sentinel conformance laws for the bounded crossing, not a source of authorization. If any law is violated, the crossing fails closed and the prior boundary is preserved.

1. **Intent Presence.** A valid, applicable `AuthorizationGrant` MUST be presented.
2. **Structural Integrity.** The grant MUST parse as well-formed protocol data.
3. **Schema Completeness.** All required crossing fields MUST be present, typed, bounded, and valid for the profile.
4. **Sovereign Signature.** The grant MUST verify under a registered, active, non-revoked issuer key that Sentinel resolves internally.
5. **Temporal Bounds.** The grant MUST be within its `not_before` and expiry window.
6. **Spatial / Target Bounds.** The target MUST resolve internally to the registered permitted endpoint; caller-supplied URLs are rejected.
7. **Payload Invariance.** SHA-256 of the exact execution bytes MUST equal the signed payload hash; canonical bound header values MUST also match.
8. **Singular Execution.** The grant/nonce MUST not have been consumed; reservation is durable and atomic.
9. **Boundary Viability.** Required transport and security constraints—TLS, timeouts, registered method/path, bound headers, and executor posture—MUST be satisfiable.
10. **Immutable Witness.** A signed, durable `PreDispatchCrossingRecord` MUST be committed before capability release. MUS settles the later `ExecutionReceipt`; after possible egress without confirmation, the only valid settlement is `OUTCOME_UNKNOWN`.

Violation of any law aborts the crossing. No procedure can rescue a violated law.

### A.1 Membrane vocabulary crosswalk

| Term | Meaning at this membrane | Violation posture |
|---|---|---|
| Commandment | Absolute orienting commitment in the meaning register; does not authorize a method. | Fundamental breach of the orienting register. |
| Law / invariant | A condition that must hold for a crossing to proceed. | Immediate fail-closed abort. |
| Principle | An orienting truth expected to persist across contexts. | Design drift requiring review. |
| Policy | A revisable rule under current human authority. | Compliance/audit variance requiring re-authorization. |
| Standard | A shared technical interoperability measure. | Interoperability failure. |
| Protocol | Exchange rules and formats. | Exchange drops. |
| Procedure | Ordered operational steps used to test or implement laws. | Execution/test error; the law remains binding. |
| Guideline | Advisory recommendation. | No automatic prohibition. |

Law is not procedure: the procedure tests payload invariance; the invariant is the equality itself. Protocol is not law: the grant format is protocol; the requirement for a valid applicable grant is law.

**Open/closed** describes surface access and is orthogonal to failure behavior. Sentinel is **fail-closed** by default: any failed check or insufficient evidence means execution is zero and the prior boundary is preserved. **Fail-safe** behavior minimizes physical harm, such as unlocking emergency exits during a fire; it is reserved for physical or human-safety domains and is not Sentinel's default consequence posture.
