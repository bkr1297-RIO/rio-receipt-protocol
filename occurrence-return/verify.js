#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  canonicalize,
  sha256,
  validateExecution,
  verifySignedReceipt,
} = require("../receipt-core");
const { verifyChain } = require("../verify-chain");
const {
  artifactHash: strictArtifactHash,
  verifyArtifact,
  verifyVesperGrant,
  verifyVesperRecord,
} = require("./crypto");
const { readJson, readJsonLines } = require("./io");
const { EPISODE_ID, FIXTURE_ID, LOCAL_ACTION } = require("./produce");
const VESPER_MANIFEST = require("../docs/conformance/fixtures/VESPER-SHADOW-FIXTURE-PERFORMANCE-MANIFEST-001-v0.1.json");

const LOCAL_PROPOSITION =
  "The fixture boundary returned EGRESS_BLOCKED for the declared payload.";
const SETTLED_SCOPE = [
  "fixture-local-attempt-attributable",
  "fixture-local-deny-all-result-occurred",
  "persisted-result-separately-observed",
  "mus-record-admitted-and-ledgered",
];
const UNRESOLVED_SCOPE = [
  "os-level-egress-enforcement",
  "external-github-occurrence",
  "external-outcome",
  "human-authority",
  "production-security",
  "succession",
  "federation",
];
const REMAINDER = {
  unexecuted_live_effect: true,
  external_outcome: "UNRESOLVED",
  non_exportable_authority: true,
  unpromoted_return: true,
};
const ATTESTATION_KEYS = [
  "algorithm",
  "key_id",
  "signer_role",
  "public_key",
  "body_hash",
  "signature",
];
const SOURCE_RECORD_KEYS = {
  MetroEnvelope: ["type", "route_id", "object_id", "scope", "expiry", "provenance"],
  AuthorizationGrant: [
    "type",
    "grant_id",
    "key_id",
    "payload_hash",
    "canonical_headers_hash",
    "nonce",
    "audience",
    "expires_at",
    "signature_hex",
    "target_ref",
    "method",
    "path_and_query",
    "expiry",
  ],
  DurableReservation: ["type", "nonce"],
  PreDispatchCrossingRecord: [
    "type",
    "record_id",
    "grant_hash",
    "reservation_ref",
    "payload_hash",
    "target_ref",
    "sentinel_verdict",
    "signer_key_id",
    "signature_hex",
  ],
  ExecutionAttempt: [
    "type",
    "attempt_id",
    "pre_dispatch_record_hash",
    "mode",
    "target_ref",
    "payload_hash",
    "attempted_at",
    "external_call_count",
    "standing_effect",
    "signer_key_id",
    "signature_hex",
  ],
  TransitionOccurrence: [
    "type",
    "occurrence_id",
    "attempt_ref",
    "effect_type",
    "target_ref",
    "payload_hash",
    "local_effect",
    "external_effect",
    "environment_evidence",
    "occurred_at",
    "standing_effect",
    "signer_key_id",
    "signature_hex",
  ],
  ExecutionReceipt: [
    "type",
    "record_id",
    "pre_dispatch_record_hash",
    "attempt_ref",
    "occurrence_ref",
    "occurrence_hash",
    "terminal_outcome",
    "no_egress_evidence_ref",
    "effect_hash",
    "signer_key_id",
    "signature_hex",
  ],
  RemainderAccount: [
    "type",
    "unexecuted_live_effect",
    "non_exportable_authority",
    "unpromoted_return",
  ],
  SettlementRecord: [
    "type",
    "standing",
    "settled_scope",
    "unsettled_scope",
    "remainder_disposition",
    "authority_effect",
    "standing_effect",
  ],
};

function sameJson(actual, expected) {
  return canonicalize(actual) === canonicalize(expected);
}

function exactKeys(value, expectedKeys) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    sameJson(Object.keys(value).sort(), [...expectedKeys].sort())
  );
}

function requireExactKeys(value, expectedKeys, fail, code) {
  if (!exactKeys(value, expectedKeys)) fail(code);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value || ""
  );
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function artifactHash(value) {
  if (!value || typeof value !== "object") return null;
  try {
    return strictArtifactHash(value);
  } catch (_error) {
    return null;
  }
}

function canonicalHash(value) {
  if (value === undefined) return null;
  try {
    return sha256(canonicalize(value));
  } catch (_error) {
    return null;
  }
}

function publicKeyFingerprint(value) {
  if (!/^(?:[0-9a-f]{2})+$/.test(value || "")) {
    throw new Error("role key is not canonical hexadecimal DER");
  }
  const key = crypto.createPublicKey({
    key: Buffer.from(value, "hex"),
    format: "der",
    type: "spki",
  });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("role key is not Ed25519");
  }
  const canonical = key.export({ type: "spki", format: "der" }).toString("hex");
  if (canonical !== value) {
    throw new Error("role key DER is not canonical SPKI");
  }
  return sha256(canonical);
}

function verifyEpisode(workspaceRoot, expectedReturnHead, expectedMusHead) {
  const root = path.resolve(workspaceRoot);
  const errors = [];
  const fail = (code, detail) => errors.push(detail ? `${code}:${detail}` : code);
  if (!/^[0-9a-f]{64}$/.test(expectedReturnHead || "")) {
    fail("EXPECTED_RETURN_HEAD_REQUIRED");
  }
  if (!/^[0-9a-f]{64}$/.test(expectedMusHead || "")) {
    fail("EXPECTED_MUS_HEAD_REQUIRED");
  }
  const read = (relative, code) => {
    try {
      const value = readJson(path.join(root, relative));
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        fail(code, "EXPECTED_JSON_OBJECT");
        return null;
      }
      return value;
    } catch (error) {
      fail(code, error.message);
      return null;
    }
  };

  const exportPacket = read("vesper-export.json", "VESPER_EXPORT_MISSING_OR_INVALID");
  const observation = read("observation.json", "OBSERVATION_MISSING_OR_INVALID");
  const evidence = read("evidence-decision.json", "EVIDENCE_MISSING_OR_INVALID");
  const admission = read("mus-record-admission.json", "MUS_ADMISSION_MISSING_OR_INVALID");
  const receipt = read("mus-occurrence-receipt.json", "MUS_RECEIPT_MISSING_OR_INVALID");
  const roles = read("trust/role-bindings.json", "ROLE_BINDINGS_MISSING_OR_INVALID");
  const receiptTrust = read(
    "trust/receipt-keys.json",
    "RECEIPT_TRUST_MISSING_OR_INVALID"
  );
  const settlementFile = read("settlement-decision.json", "SETTLEMENT_MISSING_OR_INVALID");
  const returnFile = read("return-inbox/return-envelope.json", "RETURN_ENVELOPE_MISSING_OR_INVALID");
  const acknowledgementFile = read(
    "return-acknowledgement.json",
    "RETURN_ACKNOWLEDGEMENT_MISSING_OR_INVALID"
  );
  const vesperSigner = exportPacket?.signer;
  const vesperPublicKey = vesperSigner?.public_key_spki_der_hex;
  const vesperKeyId = vesperSigner?.key_id;

  let journal = [];
  try {
    journal = readJsonLines(path.join(root, "return-journal.jsonl"));
  } catch (error) {
    fail("RETURN_JOURNAL_MISSING_OR_INVALID", error.message);
  }
  if (journal.length !== 3) fail("RETURN_JOURNAL_COUNT_MISMATCH", String(journal.length));
  const [settlement, returnEnvelope, acknowledgement] = journal;

  if (roles) {
    requireExactKeys(
      roles,
      ["schema_version", "standing", "roles", "claim_ceiling"],
      fail,
      "ROLE_BINDINGS_SHAPE_REJECTED"
    );
    requireExactKeys(
      roles.roles,
      [
        "vesper_executor",
        "observer",
        "evidence_assessor",
        "mus_recorder",
        "settlement_evaluator",
        "sourcepoint_recipient",
      ],
      fail,
      "ROLE_SET_REJECTED"
    );
    if (
      roles.schema_version !== "one.occurrence-return-role-bindings.v0.1" ||
      roles.standing !== "FIXTURE_GENERATED_TRUST_CONFIGURATION" ||
      roles.claim_ceiling !== "Generated test keys establish fixture attribution only."
    ) {
      fail("ROLE_BINDINGS_CEILING_REJECTED");
    }
    const expectedRoles = {
      vesper_executor: "PROCESS_SCOPED_TEST_SIGNER",
      observer: "LOCAL_OBSERVER",
      evidence_assessor: "EVIDENCE_ASSESSOR",
      mus_recorder: "MUS_RECORDER_AND_RETURN_CARRIER",
      settlement_evaluator: "LOCAL_SETTLEMENT_EVALUATOR",
      sourcepoint_recipient: "FIXTURE_SOURCEPOINT_RECIPIENT",
    };
    for (const [roleName, expectedRole] of Object.entries(expectedRoles)) {
      const binding = roles.roles?.[roleName];
      const expectedKeys =
        roleName === "sourcepoint_recipient"
          ? ["role", "key_id", "public_key", "sourcepoint_ref"]
          : ["role", "key_id", "public_key"];
      requireExactKeys(
        binding,
        expectedKeys,
        fail,
        `ROLE_${roleName.toUpperCase()}_SHAPE_REJECTED`
      );
      if (
        binding?.role !== expectedRole ||
        typeof binding?.key_id !== "string" ||
        binding.key_id.trim().length === 0 ||
        !/^(?:[0-9a-f]{2})+$/.test(binding?.public_key || "")
      ) {
        fail(`ROLE_${roleName.toUpperCase()}_BINDING_REJECTED`);
      }
    }
    if (
      roles.roles?.sourcepoint_recipient?.sourcepoint_ref !==
      `fixture-sourcepoint:${FIXTURE_ID}`
    ) {
      fail("SOURCEPOINT_REFERENCE_REJECTED");
    }
  }

  if (receiptTrust) {
    requireExactKeys(
      receiptTrust,
      ["trusted_keys"],
      fail,
      "RECEIPT_TRUST_SHAPE_REJECTED"
    );
    if (
      !Array.isArray(receiptTrust.trusted_keys) ||
      receiptTrust.trusted_keys.length !== 1 ||
      receiptTrust.trusted_keys[0] !== roles?.roles?.mus_recorder?.public_key
    ) {
      fail("RECEIPT_TRUST_SET_REJECTED");
    }
  }

  let attempt;
  let occurrence;
  let preDispatch;
  let sourceExecutionReceipt;
  if (exportPacket) {
    requireExactKeys(
      exportPacket,
      [
        "schema_version",
        "fixture_id",
        "runner",
        "signer",
        "records",
        "result",
        "claim_ceiling",
      ],
      fail,
      "VESPER_EXPORT_SHAPE_REJECTED"
    );
    requireExactKeys(
      vesperSigner,
      ["key_id", "algorithm", "public_key_spki_der_hex", "standing"],
      fail,
      "VESPER_SIGNER_SHAPE_REJECTED"
    );
    requireExactKeys(
      exportPacket.claim_ceiling,
      ["environment", "external_occurrence", "human_authority", "production_standing"],
      fail,
      "VESPER_CLAIM_CEILING_SHAPE_REJECTED"
    );
    if (
      exportPacket.schema_version !== "one.vesper-shadow-export.v0.1" ||
      exportPacket.fixture_id !== FIXTURE_ID ||
      exportPacket.runner !== "vesper_shadow_runner.py" ||
      vesperSigner?.algorithm !== "Ed25519" ||
      vesperSigner?.standing !== "PROCESS_SCOPED_TEST_SIGNER" ||
      !sameJson(exportPacket.claim_ceiling, {
        environment: "LOCAL_SYNTHETIC_ZERO_EGRESS",
        external_occurrence: "NOT_CLAIMED",
        human_authority: "NOT_ESTABLISHED",
        production_standing: "ABSENT",
      })
    ) {
      fail("VESPER_EXPORT_IDENTITY_REJECTED");
    }
    const records = Array.isArray(exportPacket.records) ? exportPacket.records : [];
    const expectedRecordTypes = Object.keys(SOURCE_RECORD_KEYS);
    if (
      records.length !== expectedRecordTypes.length ||
      !sameJson(
        records.map((record) => record?.type),
        expectedRecordTypes
      )
    ) {
      fail("VESPER_RECORD_SET_REJECTED");
    }
    for (const record of records) {
      const allowedKeys = SOURCE_RECORD_KEYS[record?.type];
      if (!allowedKeys || !exactKeys(record, allowedKeys)) {
        fail("VESPER_SOURCE_RECORD_SHAPE_REJECTED", record?.type || "UNKNOWN");
      }
    }
    const vesperTrust = roles?.roles?.vesper_executor;
    if (
      !vesperTrust ||
      vesperKeyId !== vesperTrust.key_id ||
      vesperPublicKey !== vesperTrust.public_key
    ) {
      fail("VESPER_TRUST_BINDING_REJECTED");
    }
    requireExactKeys(
      exportPacket.result,
      [
        "fixture_id",
        "required_state_sequence",
        "state_trace",
        "record_types",
        "sentinel_verdict",
        "execution_state",
        "no_egress_proof_required",
        "remainder_nonempty",
        "orientation_status",
        "terminal_state",
      ],
      fail,
      "VESPER_SOURCE_RESULT_SHAPE_REJECTED"
    );
    const grant = records.find((record) => record?.type === "AuthorizationGrant");
    const reservation = records.find((record) => record?.type === "DurableReservation");
    const metroEnvelope = records.find((record) => record?.type === "MetroEnvelope");
    attempt = records.find((record) => record?.type === "ExecutionAttempt");
    occurrence = records.find(
      (record) => record?.type === "TransitionOccurrence"
    );
    preDispatch = records.find(
      (record) => record?.type === "PreDispatchCrossingRecord"
    );
    sourceExecutionReceipt = records.find(
      (record) => record?.type === "ExecutionReceipt"
    );
    const sourceRemainder = records.find(
      (record) => record?.type === "RemainderAccount"
    );
    const sourceSettlement = records.find(
      (record) => record?.type === "SettlementRecord"
    );
    const grantCore = grant
      ? {
          grant_id: grant.grant_id,
          key_id: grant.key_id,
          payload_hash: grant.payload_hash,
          canonical_headers_hash: grant.canonical_headers_hash,
          nonce: grant.nonce,
          audience: grant.audience,
          expires_at: grant.expires_at,
          signature_hex: grant.signature_hex,
        }
      : null;
    const grantVerification = verifyVesperGrant(
      grant,
      vesperPublicKey
    );
    if (!grantVerification.valid) {
      fail("VESPER_GRANT_SIGNATURE_REJECTED", grantVerification.reason);
    }
    const subject = VESPER_MANIFEST.conformance_subject;
    const rawRequest = VESPER_MANIFEST.canonical_material.raw_request;
    const grantSpec = VESPER_MANIFEST.canonical_material.synthetic_grant;
    const candidate = VESPER_MANIFEST.canonical_material.candidate;
    const canonicalHeaders = Object.fromEntries(
      Object.entries(rawRequest.headers).map(([name, value]) => [
        name.toLowerCase(),
        value,
      ])
    );
    if (
      !sameJson(metroEnvelope, {
        type: "MetroEnvelope",
        route_id: "route_vesper_shadow_001",
        object_id: candidate.object_id,
        scope: "synthetic-shadow-conformance",
        expiry: grantSpec.expires_at,
        provenance: "DECLARED_SYNTHETIC",
      })
    ) {
      fail("VESPER_METRO_ENVELOPE_REJECTED");
    }
    if (
      grant?.type !== "AuthorizationGrant" ||
      grant?.grant_id !== grantSpec.grant_id ||
      grant?.key_id !== grantSpec.issuer_key_id ||
      grant?.payload_hash !== rawRequest.payload_hash ||
      grant?.canonical_headers_hash !==
        `sha256:${canonicalHash(canonicalHeaders)}` ||
      grant?.nonce !== grantSpec.nonce ||
      grant?.audience !== subject.audience ||
      grant?.expires_at !== grantSpec.expires_at ||
      grant?.expiry !== grantSpec.expires_at ||
      grant?.target_ref !== subject.target_ref ||
      grant?.method !== subject.method ||
      grant?.path_and_query !== subject.path_and_query ||
      reservation?.nonce !== grantSpec.nonce
    ) {
      fail("VESPER_GRANT_SEMANTICS_REJECTED");
    }
    for (const [name, record] of [
      ["PRE_DISPATCH", preDispatch],
      ["ATTEMPT", attempt],
      ["OCCURRENCE", occurrence],
      ["SOURCE_EXECUTION_RECEIPT", sourceExecutionReceipt],
    ]) {
      if (!record) {
        fail(`${name}_MISSING`);
      } else if (
        !verifyVesperRecord(record, vesperPublicKey).valid
      ) {
        fail(`${name}_SIGNATURE_REJECTED`);
      }
    }
    if (
      preDispatch &&
      attempt &&
      (preDispatch.grant_hash !== `sha256:${artifactHash(grantCore)}` ||
        preDispatch.reservation_ref !== grant?.nonce ||
        reservation?.nonce !== grant?.nonce ||
        preDispatch.payload_hash !== grant?.payload_hash ||
        preDispatch.target_ref !== grant?.target_ref ||
        grant?.key_id !== vesperKeyId ||
        grant?.expiry !== grant?.expires_at ||
        preDispatch.sentinel_verdict !== "ALLOW_SHADOW_ONLY" ||
        preDispatch.record_id !== `pre-dispatch:${FIXTURE_ID}` ||
        preDispatch.signer_key_id !== vesperKeyId ||
        attempt.pre_dispatch_record_hash !== `sha256:${artifactHash(preDispatch)}` ||
        attempt.attempt_id !== `attempt:${FIXTURE_ID}` ||
        attempt.mode !== "SIMULATED_NO_EGRESS" ||
        attempt.attempted_at !== "2026-08-04T00:00:01Z" ||
        attempt.external_call_count !== 0 ||
        attempt.standing_effect !== "NONE" ||
        attempt.signer_key_id !== vesperKeyId ||
        attempt.target_ref !== preDispatch.target_ref ||
        attempt.payload_hash !== preDispatch.payload_hash)
    ) {
      fail("ATTEMPT_PRE_DISPATCH_BINDING_REJECTED");
    }
    if (
      attempt &&
      occurrence &&
      (occurrence.attempt_ref !== attempt.attempt_id ||
        occurrence.target_ref !== attempt.target_ref ||
        occurrence.payload_hash !== attempt.payload_hash)
    ) {
      fail("OCCURRENCE_ATTEMPT_BINDING_REJECTED");
    }
    if (
      occurrence &&
      (occurrence.effect_type !== "LOCAL_DENY_ALL_RESULT_RECORDED" ||
        occurrence.occurrence_id !== `occurrence:${FIXTURE_ID}` ||
        occurrence.attempt_ref !== attempt?.attempt_id ||
        occurrence.local_effect !== "FIXTURE_BOUNDARY_RETURNED_EGRESS_BLOCKED" ||
        occurrence.environment_evidence?.target_ref !== occurrence.target_ref ||
        occurrence.environment_evidence?.payload_hash !== occurrence.payload_hash ||
        occurrence.environment_evidence?.result !== "EGRESS_BLOCKED" ||
        occurrence.environment_evidence?.mode !== "SIMULATED_ENVIRONMENT_DENY_ALL" ||
        occurrence.external_effect !== "NOT_CLAIMED" ||
        occurrence.occurred_at !== "2026-08-04T00:00:02Z" ||
        occurrence.standing_effect !== "NONE" ||
        occurrence.signer_key_id !== vesperKeyId ||
        !exactKeys(occurrence.environment_evidence, [
          "mode",
          "target_ref",
          "payload_hash",
          "result",
        ]))
    ) {
      fail("OCCURRENCE_CLAIM_CEILING_REJECTED");
    }
    if (
      sourceExecutionReceipt &&
      preDispatch &&
      attempt &&
      occurrence &&
      (sourceExecutionReceipt.pre_dispatch_record_hash !==
          `sha256:${artifactHash(preDispatch)}` ||
        sourceExecutionReceipt.record_id !== `execution-receipt:${FIXTURE_ID}` ||
        sourceExecutionReceipt.attempt_ref !== attempt.attempt_id ||
        sourceExecutionReceipt.occurrence_ref !== occurrence.occurrence_id ||
        sourceExecutionReceipt.occurrence_hash !== `sha256:${artifactHash(occurrence)}` ||
        sourceExecutionReceipt.no_egress_evidence_ref !==
          `sha256:${artifactHash(occurrence.environment_evidence)}` ||
        sourceExecutionReceipt.effect_hash !==
          `sha256:${canonicalHash({ live_effect: "none" })}` ||
        sourceExecutionReceipt.terminal_outcome !== "SIMULATED_NO_EGRESS" ||
        sourceExecutionReceipt.signer_key_id !== vesperKeyId)
    ) {
      fail("SOURCE_EXECUTION_RECEIPT_BINDING_REJECTED");
    }
    if (
      !sameJson(sourceRemainder, {
        type: "RemainderAccount",
        unexecuted_live_effect: true,
        non_exportable_authority: true,
        unpromoted_return: true,
      })
    ) {
      fail("VESPER_SOURCE_REMAINDER_REJECTED");
    }
    if (
      !sameJson(sourceSettlement, {
        type: "SettlementRecord",
        standing: "PROVISIONAL_SOURCE_RECORD_NOT_CLOSURE",
        settled_scope: ["fixture-local deny-all result recorded"],
        unsettled_scope: [
          "separately attributable observation and evidence admission",
          "durable MUS ledger incorporation",
          "SourcePoint return acknowledgement",
          "OS-level egress enforcement",
          "external GitHub occurrence",
          "human authority",
          "production security",
          "federation",
          "Human Return",
        ],
        remainder_disposition: "unpromoted learning candidate retained",
        authority_effect: "NONE",
        standing_effect: "NONE",
      })
    ) {
      fail("VESPER_SOURCE_SETTLEMENT_REJECTED");
    }
    if (
      !sameJson(exportPacket.result?.record_types, expectedRecordTypes) ||
      exportPacket.result?.fixture_id !== FIXTURE_ID ||
      exportPacket.result?.execution_state !== "SIMULATED_NO_EGRESS" ||
      exportPacket.result?.sentinel_verdict !== "ALLOW_SHADOW_ONLY" ||
      exportPacket.result?.terminal_state !== "RETURNED_UNPROMOTED" ||
      exportPacket.result?.orientation_status !== "UNPROMOTED" ||
      exportPacket.result?.remainder_nonempty !== true ||
      exportPacket.result?.no_egress_proof_required !== true
    ) {
      fail("VESPER_SOURCE_RESULT_REJECTED");
    }
    if (
      exportPacket.result?.required_state_sequence !==
        "required_success_state_sequence" ||
      !sameJson(exportPacket.result?.state_trace, [
        "FORMED",
        "ROUTED",
        "REVIEWED",
        "AUTHORITY_BOUND",
        "RESERVED",
        "PRE_DISPATCH_RECORDED",
        "SIMULATED_NO_EGRESS",
        "RECEIPTED",
        "REMAINDER_OPEN",
        "SETTLED",
        "RETURNED_UNPROMOTED",
      ])
    ) {
      fail("VESPER_SOURCE_STATE_TRACE_REJECTED");
    }
  }

  if (observation && roles?.roles?.observer) {
    requireExactKeys(
      observation,
      [
        "schema_version",
        "type",
        "observation_id",
        "episode_id",
        "attempt_ref",
        "occurrence_ref",
        "occurrence_hash",
        "observer_ref",
        "observation_method",
        "observed_proposition",
        "completeness",
        "local_result",
        "external_effect",
        "observed_at",
        "evidence_admission_effect",
        "truth_effect",
        "settlement_effect",
        "standing_effect",
        "claim_ceiling",
        "attestation",
      ],
      fail,
      "OBSERVATION_SHAPE_REJECTED"
    );
    const checked = verifyArtifact(observation, roles.roles.observer);
    if (!checked.valid) fail("OBSERVATION_ATTESTATION_REJECTED", checked.reason);
    if (
      !occurrence ||
      !attempt ||
      observation.occurrence_ref !== occurrence.occurrence_id ||
      observation.occurrence_hash !== artifactHash(occurrence) ||
      observation.attempt_ref !== attempt.attempt_id ||
      observation.schema_version !== "one.local-occurrence-observation.v0.1" ||
      observation.type !== "Observation" ||
      observation.observation_id !== `observation:${FIXTURE_ID}` ||
      observation.episode_id !== EPISODE_ID ||
      !/^observer-process:[0-9]+$/.test(observation.observer_ref || "") ||
      observation.observation_method !==
        "PERSISTED_EXPORT_READBACK_AND_SIGNATURE_VERIFICATION" ||
      observation.observed_proposition !== LOCAL_PROPOSITION ||
      observation.completeness !== "COMPLETE_FOR_DECLARED_LOCAL_OCCURRENCE" ||
      observation.local_result !== "EGRESS_BLOCKED" ||
      observation.external_effect !== "NOT_OBSERVED_OR_CLAIMED" ||
      observation.evidence_admission_effect !== "NONE" ||
      observation.truth_effect !== "NONE" ||
      observation.settlement_effect !== "NONE" ||
      observation.standing_effect !== "NONE" ||
      observation.observed_at !== "2026-08-04T00:00:03Z" ||
      observation.claim_ceiling !== "SEPARATELY_ATTRIBUTABLE_LOCAL_OBSERVATION"
    ) {
      fail("OBSERVATION_BINDING_OR_CEILING_REJECTED");
    }
  }

  if (evidence && roles?.roles?.evidence_assessor) {
    requireExactKeys(
      evidence,
      [
        "schema_version",
        "type",
        "evidence_decision_id",
        "episode_id",
        "attempt_ref",
        "attempt_hash",
        "occurrence_ref",
        "occurrence_hash",
        "observation_ref",
        "observation_hash",
        "proposition",
        "verdict",
        "strength",
        "admission_status",
        "admission_basis",
        "external_effect_evidence",
        "external_outcome_evidence",
        "human_authority_evidence",
        "settlement_effect",
        "standing_effect",
        "assessed_at",
        "claim_ceiling",
        "attestation",
      ],
      fail,
      "EVIDENCE_SHAPE_REJECTED"
    );
    const checked = verifyArtifact(evidence, roles.roles.evidence_assessor);
    if (!checked.valid) fail("EVIDENCE_ATTESTATION_REJECTED", checked.reason);
    if (
      !observation ||
      !occurrence ||
      !attempt ||
      evidence.schema_version !== "one.local-evidence-decision.v0.1" ||
      evidence.type !== "EvidenceDecision" ||
      evidence.evidence_decision_id !== `evidence:${FIXTURE_ID}` ||
      evidence.episode_id !== EPISODE_ID ||
      evidence.attempt_ref !== attempt.attempt_id ||
      evidence.attempt_hash !== artifactHash(attempt) ||
      evidence.occurrence_ref !== occurrence.occurrence_id ||
      evidence.occurrence_hash !== artifactHash(occurrence) ||
      evidence.observation_ref !== observation.observation_id ||
      evidence.observation_hash !== artifactHash(observation) ||
      evidence.proposition !== LOCAL_PROPOSITION ||
      evidence.admission_status !== "ADMITTED" ||
      evidence.verdict !== "SUPPORT" ||
      evidence.strength !== "STRONG_FOR_DECLARED_LOCAL_PROPOSITION" ||
      !sameJson(evidence.admission_basis, [
        "VESPER_RECORD_SIGNATURES_VALID",
        "PERSISTED_EXPORT_READBACK",
        "ATTEMPT_OCCURRENCE_OBSERVATION_LINKS_EXACT",
      ]) ||
      evidence.external_effect_evidence !== "NOT_ESTABLISHED" ||
      evidence.external_outcome_evidence !== "NOT_ESTABLISHED" ||
      evidence.human_authority_evidence !== "NOT_ESTABLISHED" ||
      evidence.settlement_effect !== "NONE" ||
      evidence.standing_effect !== "NONE" ||
      evidence.assessed_at !== "2026-08-04T00:00:04Z" ||
      evidence.claim_ceiling !== "BOUNDED_LOCAL_OCCURRENCE_EVIDENCE"
    ) {
      fail("EVIDENCE_BINDING_OR_CEILING_REJECTED");
    }
  }

  if (admission) {
    requireExactKeys(
      admission,
      ["schema_version", "intent", "execution_input", "approval", "claim_ceiling"],
      fail,
      "MUS_ADMISSION_SHAPE_REJECTED"
    );
    requireExactKeys(
      admission.intent,
      ["action", "target", "parameters"],
      fail,
      "MUS_ADMISSION_INTENT_SHAPE_REJECTED"
    );
    requireExactKeys(
      admission.intent?.parameters,
      [
        "episode_id",
        "vesper_export_hash",
        "role_bindings_hash",
        "receipt_trust_hash",
        "pre_dispatch_ref",
        "pre_dispatch_hash",
        "attempt_ref",
        "attempt_hash",
        "occurrence_ref",
        "occurrence_hash",
        "source_execution_receipt_ref",
        "source_execution_receipt_hash",
        "observation_ref",
        "observation_hash",
        "evidence_decision_ref",
        "evidence_decision_hash",
        "admitted_proposition",
        "external_effect",
      ],
      fail,
      "MUS_ADMISSION_PARAMETERS_SHAPE_REJECTED"
    );
    requireExactKeys(
      admission.approval,
      [
        "approval_id",
        "intent_hash",
        "authorizer",
        "nonce",
        "scope",
        "authority_standing",
      ],
      fail,
      "MUS_ADMISSION_APPROVAL_SHAPE_REJECTED"
    );
    if (
      admission.schema_version !== "one.mus-local-record-admission.v0.1" ||
      admission.claim_ceiling !==
        "ALLOW admits an exact local record; it proves no external occurrence or lawful human authority." ||
      !sameJson(admission.intent, admission.execution_input) ||
      admission.intent?.target !== "mus:fixture-local-ledger" ||
      admission.approval?.scope !== LOCAL_ACTION ||
      admission.approval?.authority_standing !== "SYNTHETIC_FIXTURE_ONLY" ||
      admission.approval?.authorizer !== `fixture-coordinator:${FIXTURE_ID}` ||
      !validUuid(admission.approval?.approval_id) ||
      !validUuid(admission.approval?.nonce)
    ) {
      fail("MUS_ADMISSION_CEILING_REJECTED");
    }
  }

  if (receipt) {
    requireExactKeys(
      receipt,
      [
        "receipt_id",
        "timestamp",
        "intent_hash",
        "execution_hash",
        "mus_unit_id",
        "validation",
        "decision",
        "approval",
        "chain_reference",
        "receipt_hash",
        "signature",
        "signature_algorithm",
        "public_key",
      ],
      fail,
      "MUS_RECEIPT_SHAPE_REJECTED"
    );
    requireExactKeys(
      receipt.validation,
      [
        "decision",
        "checks",
        "policy_version",
        "profile",
        "claim_ceiling",
        "admission_hash",
      ],
      fail,
      "MUS_RECEIPT_VALIDATION_SHAPE_REJECTED"
    );
    requireExactKeys(
      receipt.validation?.checks,
      ["intent_match", "context_match", "scope_valid", "execution_path_valid"],
      fail,
      "MUS_RECEIPT_CHECKS_SHAPE_REJECTED"
    );
    requireExactKeys(
      receipt.approval,
      [
        "approval_id",
        "intent_hash",
        "authorizer",
        "nonce",
        "scope",
        "authority_standing",
      ],
      fail,
      "MUS_RECEIPT_APPROVAL_SHAPE_REJECTED"
    );
    requireExactKeys(
      receipt.chain_reference,
      ["previous_receipt_hash"],
      fail,
      "MUS_RECEIPT_CHAIN_REFERENCE_SHAPE_REJECTED"
    );
    if (
      !validUuid(receipt.receipt_id) ||
      receipt.timestamp !== "2026-08-04T00:00:04.500Z" ||
      receipt.mus_unit_id !== `mus-unit:fixture:${FIXTURE_ID}` ||
      receipt.validation?.decision !== "ALLOW" ||
      receipt.validation?.policy_version !== "1.0.0" ||
      receipt.validation?.profile !== "one.mus-local-occurrence-record.v0.1" ||
      receipt.validation?.claim_ceiling !== admission?.claim_ceiling ||
      receipt.validation?.admission_hash !== canonicalHash(admission) ||
      receipt.decision !== "ALLOW" ||
      !sameJson(receipt.approval, admission?.approval) ||
      receipt.chain_reference?.previous_receipt_hash !== null ||
      receipt.signature_algorithm !== "Ed25519"
    ) {
      fail("MUS_RECEIPT_CEILING_REJECTED");
    }
  }

  if (
    admission &&
    typeof admission === "object" &&
    !Array.isArray(admission) &&
    admission.intent &&
    typeof admission.intent === "object" &&
    admission.execution_input &&
    typeof admission.execution_input === "object" &&
    admission.approval &&
    typeof admission.approval === "object" &&
    receipt &&
    typeof receipt === "object" &&
    !Array.isArray(receipt)
  ) {
    const localValidation = validateExecution(
      admission.intent,
      admission.execution_input,
      admission.approval,
      [LOCAL_ACTION]
    );
    if (
      admission.intent?.action !== LOCAL_ACTION ||
      localValidation.decision !== "ALLOW" ||
      receipt.decision !== "ALLOW" ||
      receipt.intent_hash !== canonicalHash(admission.intent) ||
      receipt.execution_hash !== canonicalHash(admission.execution_input) ||
      !sameJson(receipt.approval, admission.approval) ||
      receipt.validation?.profile !== "one.mus-local-occurrence-record.v0.1" ||
      canonicalize(receipt.validation?.checks) !== canonicalize(localValidation.checks)
    ) {
      fail("MUS_RECORD_ADMISSION_BINDING_REJECTED");
    }
    const parameters = admission.intent?.parameters;
    if (
      !preDispatch ||
      !attempt ||
      !occurrence ||
      !sourceExecutionReceipt ||
      !observation ||
      !evidence ||
      parameters?.episode_id !== EPISODE_ID ||
      parameters?.vesper_export_hash !== canonicalHash(exportPacket) ||
      parameters?.role_bindings_hash !== canonicalHash(roles) ||
      parameters?.receipt_trust_hash !== canonicalHash(receiptTrust) ||
      parameters?.pre_dispatch_ref !== preDispatch.record_id ||
      parameters?.pre_dispatch_hash !== artifactHash(preDispatch) ||
      parameters?.attempt_ref !== attempt.attempt_id ||
      parameters?.attempt_hash !== artifactHash(attempt) ||
      parameters?.occurrence_ref !== occurrence.occurrence_id ||
      parameters?.occurrence_hash !== artifactHash(occurrence) ||
      parameters?.source_execution_receipt_ref !== sourceExecutionReceipt.record_id ||
      parameters?.source_execution_receipt_hash !== artifactHash(sourceExecutionReceipt) ||
      parameters?.observation_ref !== observation.observation_id ||
      parameters?.observation_hash !== artifactHash(observation) ||
      parameters?.evidence_decision_ref !== evidence.evidence_decision_id ||
      parameters?.evidence_decision_hash !== artifactHash(evidence) ||
      parameters?.admitted_proposition !== LOCAL_PROPOSITION ||
      parameters?.external_effect !== "NOT_CLAIMED"
    ) {
      fail("MUS_RECORD_SUBJECT_BINDING_REJECTED");
    }
    const musRole = roles?.roles?.mus_recorder;
    if (!musRole || receipt.public_key !== musRole.public_key) {
      fail("MUS_RECEIPT_ROLE_BINDING_REJECTED");
    }
    const checked = verifySignedReceipt(receipt, musRole?.public_key);
    if (!checked.valid) fail("MUS_RECEIPT_VERIFICATION_REJECTED");
  }

  const ledgerPath = path.join(root, "ledger", "ledger.jsonl");
  const receiptTrustPath = path.join(root, "trust", "receipt-keys.json");
  const chain = verifyChain({
    ledgerPath,
    trustedKeysPath: receiptTrustPath,
    expectedHeadHash:
      typeof expectedMusHead === "string" ? expectedMusHead : null,
    expectedRecordCount: 1,
  });
  if (!chain.valid) {
    for (const error of chain.errors) fail("MUS_CHAIN_REJECTED", error.error);
  }
  let ledgerEntries = [];
  try {
    ledgerEntries = readJsonLines(ledgerPath);
  } catch (error) {
    fail("MUS_LEDGER_READ_REJECTED", error.message);
  }
  if (ledgerEntries.length !== 1) fail("MUS_LEDGER_COUNT_MISMATCH");
  if (ledgerEntries[0]) {
    requireExactKeys(
      ledgerEntries[0],
      ["receipt_hash", "previous_receipt_hash", "appended_at", "receipt"],
      fail,
      "MUS_LEDGER_ENVELOPE_SHAPE_REJECTED"
    );
    if (
      ledgerEntries[0].receipt_hash !== receipt?.receipt_hash ||
      ledgerEntries[0].previous_receipt_hash !== null ||
      !isCanonicalIsoTimestamp(ledgerEntries[0].appended_at) ||
      !sameJson(ledgerEntries[0].receipt, receipt) ||
      ledgerEntries[0].receipt?.public_key !== roles?.roles?.mus_recorder?.public_key
    ) {
      fail("MUS_LEDGER_RECEIPT_IDENTITY_REJECTED");
    }
  }
  if (
    expectedMusHead &&
    ledgerEntries[0]?.receipt_hash !== expectedMusHead
  ) {
    fail("MUS_LEDGER_HEAD_MISMATCH");
  }

  if (settlement && roles?.roles?.settlement_evaluator) {
    requireExactKeys(
      settlement,
      [
        "schema_version",
        "type",
        "settlement_id",
        "episode_id",
        "previous_record_hash",
        "mus_receipt_ref",
        "mus_receipt_hash",
        "mus_signed_receipt_hash",
        "evidence_decision_ref",
        "evidence_decision_hash",
        "settled_proposition",
        "disposition",
        "settled_scope",
        "unresolved_scope",
        "remainder",
        "succession_effect",
        "future_authority_effect",
        "decided_at",
        "claim_ceiling",
        "attestation",
      ],
      fail,
      "SETTLEMENT_SHAPE_REJECTED"
    );
    const checked = verifyArtifact(settlement, roles.roles.settlement_evaluator);
    if (!checked.valid) fail("SETTLEMENT_ATTESTATION_REJECTED", checked.reason);
    if (
      !receipt ||
      !evidence ||
      settlement.schema_version !== "one.local-crossing-settlement.v0.1" ||
      settlement.type !== "SettlementDecision" ||
      settlement.settlement_id !== `settlement:${FIXTURE_ID}` ||
      settlement.episode_id !== EPISODE_ID ||
      settlement.previous_record_hash !== canonicalHash(receipt) ||
      settlement.mus_receipt_ref !== receipt.receipt_id ||
      settlement.mus_receipt_hash !== receipt.receipt_hash ||
      settlement.mus_signed_receipt_hash !== canonicalHash(receipt) ||
      settlement.evidence_decision_ref !== evidence.evidence_decision_id ||
      settlement.evidence_decision_hash !== artifactHash(evidence) ||
      settlement.settled_proposition !== LOCAL_PROPOSITION ||
      settlement.disposition !== "SETTLED_LOCAL_ZERO_EGRESS_OBSERVATION" ||
      !sameJson(settlement.settled_scope, SETTLED_SCOPE) ||
      !sameJson(settlement.unresolved_scope, UNRESOLVED_SCOPE) ||
      !sameJson(settlement.remainder, REMAINDER) ||
      settlement.succession_effect !== "NONE" ||
      settlement.future_authority_effect !== "NONE" ||
      settlement.decided_at !== "2026-08-04T00:00:05Z" ||
      settlement.claim_ceiling !== "FIXTURE_LOCAL_SETTLEMENT_ONLY"
    ) {
      fail("SETTLEMENT_BINDING_OR_CEILING_REJECTED");
    }
  }
  if (
    settlement &&
    settlementFile &&
    artifactHash(settlement) !== artifactHash(settlementFile)
  ) {
    fail("SETTLEMENT_JOURNAL_FILE_DIVERGENCE");
  }

  if (returnEnvelope && roles?.roles?.mus_recorder) {
    requireExactKeys(
      returnEnvelope,
      [
        "schema_version",
        "type",
        "return_id",
        "episode_id",
        "previous_record_hash",
        "recipient_ref",
        "carriage",
        "mus_receipt_ref",
        "mus_receipt_hash",
        "mus_signed_receipt_hash",
        "evidence_decision_ref",
        "evidence_decision_hash",
        "settlement_ref",
        "settlement_hash",
        "remainder",
        "requested_disposition",
        "automatic_incorporation",
        "succession_effect",
        "learning_effect",
        "future_authority_effect",
        "sent_at",
        "claim_ceiling",
        "attestation",
      ],
      fail,
      "RETURN_ENVELOPE_SHAPE_REJECTED"
    );
    const checked = verifyArtifact(returnEnvelope, roles.roles.mus_recorder);
    if (!checked.valid) fail("RETURN_ENVELOPE_ATTESTATION_REJECTED", checked.reason);
    const sourcePointRef = roles?.roles?.sourcepoint_recipient?.sourcepoint_ref;
    if (
      !settlement ||
      !receipt ||
      !evidence ||
      returnEnvelope.schema_version !== "one.local-return-envelope.v0.1" ||
      returnEnvelope.type !== "ReturnEnvelope" ||
      returnEnvelope.return_id !== `return:${FIXTURE_ID}` ||
      returnEnvelope.episode_id !== EPISODE_ID ||
      returnEnvelope.previous_record_hash !== artifactHash(settlement) ||
      returnEnvelope.settlement_ref !== settlement.settlement_id ||
      returnEnvelope.settlement_hash !== artifactHash(settlement) ||
      returnEnvelope.mus_receipt_ref !== receipt.receipt_id ||
      returnEnvelope.mus_receipt_hash !== receipt.receipt_hash ||
      returnEnvelope.mus_signed_receipt_hash !== canonicalHash(receipt) ||
      returnEnvelope.evidence_decision_ref !== evidence.evidence_decision_id ||
      returnEnvelope.evidence_decision_hash !== artifactHash(evidence) ||
      returnEnvelope.recipient_ref !== sourcePointRef ||
      returnEnvelope.carriage !== "LOCAL_FIXTURE_INBOX" ||
      !sameJson(returnEnvelope.remainder, REMAINDER) ||
      returnEnvelope.requested_disposition !== "RECEIVE_FOR_SOURCEPOINT_REVIEW" ||
      returnEnvelope.automatic_incorporation !== false ||
      returnEnvelope.succession_effect !== "NONE" ||
      returnEnvelope.learning_effect !== "NONE" ||
      returnEnvelope.future_authority_effect !== "NONE" ||
      returnEnvelope.sent_at !== "2026-08-04T00:00:06Z" ||
      returnEnvelope.claim_ceiling !== "RECIPIENT_SPECIFIC_LOCAL_RETURN_CARRIAGE"
    ) {
      fail("RETURN_ENVELOPE_BINDING_OR_CEILING_REJECTED");
    }
  }
  if (
    returnEnvelope &&
    returnFile &&
    artifactHash(returnEnvelope) !== artifactHash(returnFile)
  ) {
    fail("RETURN_JOURNAL_INBOX_DIVERGENCE");
  }

  if (acknowledgement && roles?.roles?.sourcepoint_recipient) {
    requireExactKeys(
      acknowledgement,
      [
        "schema_version",
        "type",
        "acknowledgement_id",
        "episode_id",
        "previous_record_hash",
        "return_ref",
        "return_hash",
        "recipient_ref",
        "disposition",
        "incorporated",
        "orientation_promoted",
        "succession_effect",
        "learning_effect",
        "future_authority_effect",
        "acknowledged_at",
        "claim_ceiling",
        "attestation",
      ],
      fail,
      "RETURN_ACK_SHAPE_REJECTED"
    );
    const checked = verifyArtifact(acknowledgement, roles.roles.sourcepoint_recipient);
    if (!checked.valid) fail("RETURN_ACK_ATTESTATION_REJECTED", checked.reason);
    const sourcePointRef = roles.roles.sourcepoint_recipient.sourcepoint_ref;
    if (
      !returnEnvelope ||
      acknowledgement.schema_version !==
        "one.local-return-acknowledgement.v0.1" ||
      acknowledgement.type !== "ReturnAcknowledgement" ||
      acknowledgement.acknowledgement_id !== `return-ack:${FIXTURE_ID}` ||
      acknowledgement.episode_id !== EPISODE_ID ||
      acknowledgement.previous_record_hash !== artifactHash(returnEnvelope) ||
      acknowledgement.return_ref !== returnEnvelope.return_id ||
      acknowledgement.return_hash !== artifactHash(returnEnvelope) ||
      acknowledgement.recipient_ref !== sourcePointRef ||
      acknowledgement.disposition !== "RECEIVED_FOR_DISPOSITION" ||
      acknowledgement.incorporated !== false ||
      acknowledgement.orientation_promoted !== false ||
      acknowledgement.succession_effect !== "NONE" ||
      acknowledgement.learning_effect !== "NONE" ||
      acknowledgement.future_authority_effect !== "NONE" ||
      acknowledgement.acknowledged_at !== "2026-08-04T00:00:07Z" ||
      acknowledgement.claim_ceiling !==
        "FIXTURE_SOURCEPOINT_RECEIPT_ACKNOWLEDGEMENT_ONLY"
    ) {
      fail("RETURN_ACK_BINDING_OR_CEILING_REJECTED");
    }
  }
  if (
    acknowledgement &&
    acknowledgementFile &&
    artifactHash(acknowledgement) !== artifactHash(acknowledgementFile)
  ) {
    fail("RETURN_ACK_JOURNAL_FILE_DIVERGENCE");
  }
  if (acknowledgement && expectedReturnHead !== artifactHash(acknowledgement)) {
    fail("RETURN_JOURNAL_HEAD_MISMATCH");
  }

  if (roles?.roles) {
    const keys = [
      roles.roles.vesper_executor,
      roles.roles.observer,
      roles.roles.evidence_assessor,
      roles.roles.mus_recorder,
      roles.roles.settlement_evaluator,
      roles.roles.sourcepoint_recipient,
    ].map((binding) => binding?.public_key);
    let fingerprints = [];
    try {
      fingerprints = keys.map(publicKeyFingerprint);
    } catch (error) {
      fail("ROLE_KEY_ENCODING_REJECTED", error.message);
    }
    if (
      keys.some((key) => !key) ||
      fingerprints.length !== keys.length ||
      new Set(fingerprints).size !== fingerprints.length
    ) {
      fail("ROLE_KEY_SEPARATION_REJECTED");
    }
  }

  const identifiers = [
    preDispatch?.record_id,
    attempt?.attempt_id,
    occurrence?.occurrence_id,
    sourceExecutionReceipt?.record_id,
    observation?.observation_id,
    evidence?.evidence_decision_id,
    receipt?.receipt_id,
    settlement?.settlement_id,
    returnEnvelope?.return_id,
    acknowledgement?.acknowledgement_id,
  ];
  if (
    identifiers.some((identifier) => typeof identifier !== "string") ||
    new Set(identifiers).size !== identifiers.length
  ) {
    fail("CAUSAL_IDENTITY_SEPARATION_REJECTED");
  }
  if (
    [observation, evidence, settlement, returnEnvelope, acknowledgement]
      .filter(Boolean)
      .some((artifact) => artifact.episode_id !== EPISODE_ID)
  ) {
    fail("EPISODE_ID_BINDING_REJECTED");
  }

  const ok = errors.length === 0;
  return {
    ok,
    errors,
    mus_ledger_head: ledgerEntries.at(-1)?.receipt_hash || null,
    return_journal_head: acknowledgement ? artifactHash(acknowledgement) : null,
    terminal_state: ok ? "RETURNED_UNPROMOTED" : "NOT_CLOSED",
    claim_ceiling: ok
      ? "SINGLE_DOMAIN_OCCURRENCE_TO_RETURN_FIXTURE_CLOSED_LOCAL_SYNTHETIC_ZERO_EGRESS"
      : "NO_CLOSURE_CLAIM",
    excluded_claims: [
      "live-human-authority",
      "os-level-egress-proof",
      "external-github-occurrence",
      "external-outcome",
      "production-security",
      "externally-governed-trust-root",
      "succession",
      "federation",
      "human-return",
    ],
  };
}

function main() {
  const [workspace, expectedReturnHead, expectedMusHead] = process.argv.slice(2);
  if (!workspace || !expectedReturnHead || !expectedMusHead) {
    console.error("usage: verify.js <workspace> <expected-return-head> <expected-mus-head>");
    process.exitCode = 2;
    return;
  }
  const result = verifyEpisode(workspace, expectedReturnHead, expectedMusHead);
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { verifyEpisode };
