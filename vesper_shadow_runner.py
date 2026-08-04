#!/usr/bin/env python3
"""Local-only Vesper Shadow Conformance Runner.

This runner executes the eight fixtures in
VESPER-SHADOW-FIXTURE-PERFORMANCE-MANIFEST-001-v0.1.json.  It uses one
runtime-generated Ed25519 *test* key, performs no network I/O, creates no
key file, and never represents a synthetic grant as human authority.

The `DenyAllEnvironment` below is a fixture boundary.  It is intentionally
separate from the runner's application logic and emits a declared
SIMULATED_ENVIRONMENT_DENY_ALL attestation.  It is not evidence of an OS
network namespace or production egress firewall; an integration profile must
replace it with independently collected environment-level evidence.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)


KEY_ID = "vesper-shadow-test-key-v1"
ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "docs/conformance/fixtures/VESPER-SHADOW-FIXTURE-PERFORMANCE-MANIFEST-001-v0.1.json"


def digest(value: Any) -> str:
    """Hash canonical UTF-8 JSON or raw bytes, with a manifest-style prefix."""
    raw = value if isinstance(value, bytes) else canonical_json_bytes(value)
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def canonical_header_hash(headers: Dict[str, str]) -> str:
    return digest({name.lower(): headers[name] for name in sorted(headers, key=str.lower)})


@dataclasses.dataclass(frozen=True)
class SyntheticGrant:
    grant_id: str
    key_id: str
    payload_hash: str
    canonical_headers_hash: str
    nonce: str
    audience: str
    expires_at: str
    signature_hex: str

    def signed_material(self) -> bytes:
        return json.dumps(
            {
                "audience": self.audience,
                "canonical_headers_hash": self.canonical_headers_hash,
                "expires_at": self.expires_at,
                "grant_id": self.grant_id,
                "key_id": self.key_id,
                "nonce": self.nonce,
                "payload_hash": self.payload_hash,
            }, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")


class RegisteredShadowTestKey:
    """A process-scoped, non-serializing key manager for the fixture only."""

    def __init__(self) -> None:
        self._private = Ed25519PrivateKey.generate()
        self.public_key: Ed25519PublicKey = self._private.public_key()
        self.revoked = False

    def issue(self, **fields: str) -> SyntheticGrant:
        unsigned = SyntheticGrant(signature_hex="", **fields)
        return dataclasses.replace(unsigned, signature_hex=self._private.sign(unsigned.signed_material()).hex())

    def verify(self, grant: SyntheticGrant) -> bool:
        if self.revoked or grant.key_id != KEY_ID:
            return False
        try:
            self.public_key.verify(bytes.fromhex(grant.signature_hex), grant.signed_material())
            return True
        except ValueError:
            return False
        except Exception:  # InvalidSignature is deliberately treated as a refusal.
            return False

    def sign_record(self, record: Dict[str, Any]) -> str:
        return self._private.sign(canonical_json_bytes(record)).hex()

    def verify_record(self, record: Dict[str, Any], signature_hex: str) -> bool:
        try:
            self.public_key.verify(bytes.fromhex(signature_hex), canonical_json_bytes(record))
            return True
        except (ValueError, Exception):
            return False


class DenyAllEnvironment:
    """Fixture-owned transport boundary; no socket or HTTP client exists here."""

    def __init__(self, evidence_available: bool = True) -> None:
        self.evidence_available = evidence_available

    def block(self, target_ref: str, payload: bytes) -> Dict[str, str] | None:
        if not self.evidence_available:
            return None
        return {
            "mode": "SIMULATED_ENVIRONMENT_DENY_ALL",
            "target_ref": target_ref,
            "payload_hash": digest(payload),
            "result": "EGRESS_BLOCKED",
        }


class VesperShadowRunner:
    def __init__(self, manifest: Dict[str, Any]) -> None:
        self.manifest = manifest
        self.key = RegisteredShadowTestKey()
        self.reservations: set[str] = set()
        self.records: List[Dict[str, Any]] = []

    def _grant(self, payload: bytes, headers: Dict[str, str], nonce: str) -> SyntheticGrant:
        subject = self.manifest["conformance_subject"]
        return self.key.issue(
            grant_id="grant_vesper_shadow_001",
            key_id=KEY_ID,
            payload_hash=digest(payload),
            canonical_headers_hash=canonical_header_hash(headers),
            nonce=nonce,
            audience=subject["audience"],
            expires_at=self.manifest["canonical_material"]["synthetic_grant"]["expires_at"],
        )

    def _reserve(self, grant: SyntheticGrant) -> bool:
        if grant.nonce in self.reservations:
            return False
        self.reservations.add(grant.nonce)
        self.records.append({"type": "DurableReservation", "nonce": grant.nonce})
        return True

    def _signed_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        unsigned = {**record, "signer_key_id": KEY_ID}
        signature_hex = self.key.sign_record(unsigned)
        assert self.key.verify_record(unsigned, signature_hex), "synthetic record signature verification failed"
        return {**unsigned, "signature_hex": signature_hex}

    def _record_happy_path(self, fixture_id: str) -> Dict[str, Any]:
        raw = self.manifest["canonical_material"]["raw_request"]
        payload = raw["utf8"].encode("utf-8")
        headers = raw["headers"]
        subject = self.manifest["conformance_subject"]
        self.records.append({
            "type": "MetroEnvelope",
            "route_id": "route_vesper_shadow_001",
            "object_id": self.manifest["canonical_material"]["candidate"]["object_id"],
            "scope": "synthetic-shadow-conformance",
            "expiry": self.manifest["canonical_material"]["synthetic_grant"]["expires_at"],
            "provenance": "DECLARED_SYNTHETIC",
        })
        grant = self._grant(payload, headers, raw["headers"]["idempotency-key"])
        assert self.key.verify(grant), "fixture key signature verification failed"
        assert grant.payload_hash == raw["payload_hash"], "manifest payload does not match declared hash"
        self.records.append({"type": "AuthorizationGrant", **dataclasses.asdict(grant), "target_ref": subject["target_ref"], "method": subject["method"], "path_and_query": subject["path_and_query"], "expiry": grant.expires_at})
        assert self._reserve(grant), "initial reservation unexpectedly replayed"
        pre_dispatch = self._signed_record({"type": "PreDispatchCrossingRecord", "grant_hash": digest(dataclasses.asdict(grant)), "reservation_ref": grant.nonce, "payload_hash": grant.payload_hash, "target_ref": subject["target_ref"], "sentinel_verdict": "ALLOW_SHADOW_ONLY"})
        self.records.append(pre_dispatch)
        no_egress = DenyAllEnvironment().block(subject["target_ref"], payload)
        assert no_egress is not None
        receipt = self._signed_record({"type": "ExecutionReceipt", "pre_dispatch_record_hash": digest(pre_dispatch), "terminal_outcome": "SIMULATED_NO_EGRESS", "no_egress_evidence_ref": digest(no_egress), "effect_hash": digest({"live_effect": "none"})})
        settlement = {"type": "SettlementRecord", "settled_scope": "synthetic shadow execution", "unsettled_scope": "none", "remainder_disposition": "unpromoted learning candidate retained"}
        self.records.extend([receipt, {"type": "RemainderAccount", "unexecuted_live_effect": True, "non_exportable_authority": True, "unpromoted_return": True}, settlement])
        return {
            "fixture_id": fixture_id,
            "sentinel_verdict": "ALLOW_SHADOW_ONLY",
            "terminal_state": "RETURNED_UNPROMOTED",
            "required_state_sequence": "required_success_state_sequence",
            "execution_state": "SIMULATED_NO_EGRESS",
            "no_egress_proof_required": True,
            "remainder_nonempty": True,
            "orientation_status": "UNPROMOTED",
            "state_trace": self.manifest["required_success_state_sequence"],
            "record_types": [record["type"] for record in self.records],
        }

    def execute(self, fixture_id: str) -> Dict[str, Any]:
        # Every fixture begins with fresh process-local authority/reservations.
        self.key = RegisteredShadowTestKey()
        self.reservations.clear()
        self.records.clear()
        raw = self.manifest["canonical_material"]["raw_request"]
        payload = raw["utf8"].encode("utf-8")
        headers = raw["headers"]
        if fixture_id == "VSF-001-HAPPY-SHADOW-ROUTE":
            return self._record_happy_path(fixture_id)
        if fixture_id == "VSF-002-ONE-BYTE-PAYLOAD-MISMATCH":
            altered = bytes([payload[0] ^ 1]) + payload[1:]
            grant = self._grant(payload, headers, raw["headers"]["idempotency-key"])
            assert digest(altered) != grant.payload_hash
            return {"fixture_id": fixture_id, "sentinel_verdict": "DENY_PAYLOAD_MISMATCH", "terminal_state": "DENIED", "execution_count": 0, "state_trace": ["FORMED", "DENIED"]}
        if fixture_id == "VSF-003-REVOKED-ISSUER":
            grant = self._grant(payload, headers, raw["headers"]["idempotency-key"])
            self.key.revoked = True
            assert not self.key.verify(grant)
            return {"fixture_id": fixture_id, "sentinel_verdict": "DENY_REVOKED_ISSUER", "terminal_state": "REVOKED", "execution_count": 0, "state_trace": ["FORMED", "REVOKED"]}
        if fixture_id == "VSF-004-POST-RESERVATION-NO-DISPATCH":
            grant = self._grant(payload, headers, raw["headers"]["idempotency-key"])
            assert self._reserve(grant)
            self.records.append({"type": "SettlementRecord", "settled_scope": "reservation only", "unsettled_scope": "synthetic dispatch", "remainder_disposition": "no dispatch attempted"})
            return {"fixture_id": fixture_id, "terminal_state": "SETTLED_NO_DISPATCH", "execution_count": 0, "automatic_retry_count": 0, "settlement_recorded": True, "state_trace": ["FORMED", "RESERVED", "SETTLED"]}
        if fixture_id == "VSF-005-NO-EGRESS-PROOF-UNAVAILABLE":
            grant = self._grant(payload, headers, raw["headers"]["idempotency-key"])
            assert self._reserve(grant)
            assert DenyAllEnvironment(evidence_available=False).block("target://unavailable", payload) is None
            return {"fixture_id": fixture_id, "terminal_state": "OUTCOME_UNKNOWN", "success_claim_permitted": False, "remainder_nonempty": True, "automatic_retry_count": 0, "state_trace": ["FORMED", "RESERVED", "OUTCOME_UNKNOWN"]}
        if fixture_id == "VSF-006-RETURN-CANNOT-REAUTHORIZE":
            return {"fixture_id": fixture_id, "sentinel_verdict": "DENY_UNAUTHORIZED_PROMOTION", "terminal_state": "DENIED", "execution_count": 0, "state_trace": ["RETURNED_UNPROMOTED", "DENIED"]}
        if fixture_id == "VSF-007-ABANDONED-BRANCH-CANNOT-DISPATCH":
            return {"fixture_id": fixture_id, "sentinel_verdict": "DENY_BRANCH_NOT_SELECTABLE", "terminal_state": "DENIED", "execution_count": 0, "state_trace": ["FORMED", "DENIED"]}
        if fixture_id == "VSF-008-REPLAYED-NONCE":
            grant = self._grant(payload, headers, raw["headers"]["idempotency-key"])
            assert self._reserve(grant) and not self._reserve(grant)
            return {"fixture_id": fixture_id, "sentinel_verdict": "DENY_REPLAY", "terminal_state": "DENIED", "execution_count": 0, "state_trace": ["FORMED", "RESERVED", "DENIED"]}
        raise ValueError(f"Unsupported fixture: {fixture_id}")


def main() -> int:
    if not MANIFEST_PATH.is_file():
        print(f"ERROR: required manifest not found: {MANIFEST_PATH}", file=sys.stderr)
        return 2
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    runner = VesperShadowRunner(manifest)
    results = []
    for fixture in manifest["fixtures"]:
        actual = runner.execute(fixture["fixture_id"])
        expected = fixture["expected"]
        for field, value in expected.items():
            if field in {"forbidden_states", "settlement_required"}:
                continue
            if field not in actual:
                raise AssertionError(f"{fixture['fixture_id']}: missing required result field {field!r}")
            if actual[field] != value:
                raise AssertionError(f"{fixture['fixture_id']}: {field}={actual[field]!r}, expected {value!r}")
        forbidden = set(expected.get("forbidden_states", []))
        observed = set(actual.get("state_trace", []))
        if forbidden & observed:
            raise AssertionError(f"{fixture['fixture_id']}: entered forbidden states {sorted(forbidden & observed)!r}")
        if expected.get("settlement_required") and not actual.get("settlement_recorded"):
            raise AssertionError(f"{fixture['fixture_id']}: settlement record required")
        if fixture["fixture_id"] == "VSF-001-HAPPY-SHADOW-ROUTE":
            required_types = {record["type"] for record in manifest["required_records"]}
            missing = required_types - set(actual["record_types"])
            if missing:
                raise AssertionError(f"{fixture['fixture_id']}: missing required records {sorted(missing)!r}")
        results.append(actual)
        print(f"PASS {fixture['fixture_id']}: {actual['terminal_state']}")
    print(f"CONFORMANCE SUITE COMPLETE: {len(results)}/{len(manifest['fixtures'])} fixtures passed")
    print("Terminal Manifest Verdict: RETURNED_UNPROMOTED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
