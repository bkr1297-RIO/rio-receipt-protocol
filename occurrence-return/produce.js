#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const {
  canonicalize,
  sha256,
  signReceipt,
  validateExecution,
  verifySignedReceipt,
} = require("../receipt-core");
const { createLedger } = require("../ledger");
const { verifyChain } = require("../verify-chain");
const {
  artifactHash,
  createFixtureSigner,
  signArtifact,
  verifyArtifact,
  verifyVesperRecord,
} = require("./crypto");
const {
  appendJsonLineDurable,
  readJson,
  writeJsonDurable,
} = require("./io");

const FIXTURE_ID = "VSF-001-HAPPY-SHADOW-ROUTE";
const EPISODE_ID = `episode:${FIXTURE_ID}`;
const LOCAL_ACTION = "record_vesper_occurrence_return_closure";

function requireSuccessfulProcess(result, label) {
  if (result.error || result.signal || result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${label}_FAILED${detail ? `:${detail}` : ""}`);
  }
}

function requireArtifact(verification, code) {
  if (!verification.valid) {
    throw new Error(`${code}:${verification.reason || "UNKNOWN"}`);
  }
}

function evidenceDecisionFor({ attempt, occurrence, observation, signer }) {
  requireArtifact(
    verifyArtifact(observation, {
      key_id: observation.attestation.key_id,
      public_key: observation.attestation.public_key,
      role: "LOCAL_OBSERVER",
    }),
    "OBSERVATION_REJECTED"
  );
  if (
    observation.occurrence_ref !== occurrence.occurrence_id ||
    observation.occurrence_hash !== artifactHash(occurrence) ||
    observation.attempt_ref !== attempt.attempt_id ||
    observation.local_result !== "EGRESS_BLOCKED" ||
    observation.external_effect !== "NOT_OBSERVED_OR_CLAIMED"
  ) {
    throw new Error("OBSERVATION_BINDING_REJECTED");
  }
  return signArtifact(
    {
      schema_version: "one.local-evidence-decision.v0.1",
      type: "EvidenceDecision",
      evidence_decision_id: `evidence:${FIXTURE_ID}`,
      episode_id: EPISODE_ID,
      attempt_ref: attempt.attempt_id,
      attempt_hash: artifactHash(attempt),
      occurrence_ref: occurrence.occurrence_id,
      occurrence_hash: artifactHash(occurrence),
      observation_ref: observation.observation_id,
      observation_hash: artifactHash(observation),
      proposition: "The fixture boundary returned EGRESS_BLOCKED for the declared payload.",
      verdict: "SUPPORT",
      strength: "STRONG_FOR_DECLARED_LOCAL_PROPOSITION",
      admission_status: "ADMITTED",
      admission_basis: [
        "VESPER_RECORD_SIGNATURES_VALID",
        "PERSISTED_EXPORT_READBACK",
        "ATTEMPT_OCCURRENCE_OBSERVATION_LINKS_EXACT",
      ],
      external_effect_evidence: "NOT_ESTABLISHED",
      external_outcome_evidence: "NOT_ESTABLISHED",
      human_authority_evidence: "NOT_ESTABLISHED",
      settlement_effect: "NONE",
      standing_effect: "NONE",
      assessed_at: "2026-08-04T00:00:04Z",
      claim_ceiling: "BOUNDED_LOCAL_OCCURRENCE_EVIDENCE",
    },
    signer
  );
}

function settlementFor({ receipt, receiptVerified, chainVerified, evidence, signer }) {
  if (!receiptVerified || !chainVerified) {
    throw new Error("SETTLEMENT_REQUIRES_VERIFIED_MUS_RECEIPT");
  }
  if (
    evidence.type !== "EvidenceDecision" ||
    evidence.admission_status !== "ADMITTED" ||
    evidence.verdict !== "SUPPORT" ||
    evidence.strength !== "STRONG_FOR_DECLARED_LOCAL_PROPOSITION"
  ) {
    throw new Error("SETTLEMENT_REQUIRES_ADMITTED_LOCAL_EVIDENCE");
  }
  return signArtifact(
    {
      schema_version: "one.local-crossing-settlement.v0.1",
      type: "SettlementDecision",
      settlement_id: `settlement:${FIXTURE_ID}`,
      episode_id: EPISODE_ID,
      previous_record_hash: sha256(canonicalize(receipt)),
      mus_receipt_ref: receipt.receipt_id,
      mus_receipt_hash: receipt.receipt_hash,
      mus_signed_receipt_hash: sha256(canonicalize(receipt)),
      evidence_decision_ref: evidence.evidence_decision_id,
      evidence_decision_hash: artifactHash(evidence),
      settled_proposition: evidence.proposition,
      disposition: "SETTLED_LOCAL_ZERO_EGRESS_OBSERVATION",
      settled_scope: [
        "fixture-local-attempt-attributable",
        "fixture-local-deny-all-result-occurred",
        "persisted-result-separately-observed",
        "mus-record-admitted-and-ledgered",
      ],
      unresolved_scope: [
        "os-level-egress-enforcement",
        "external-github-occurrence",
        "external-outcome",
        "human-authority",
        "production-security",
        "succession",
        "federation",
      ],
      remainder: {
        unexecuted_live_effect: true,
        external_outcome: "UNRESOLVED",
        non_exportable_authority: true,
        unpromoted_return: true,
      },
      succession_effect: "NONE",
      future_authority_effect: "NONE",
      decided_at: "2026-08-04T00:00:05Z",
      claim_ceiling: "FIXTURE_LOCAL_SETTLEMENT_ONLY",
    },
    signer
  );
}

function returnEnvelopeFor({ receipt, evidence, settlement, sourcePointRef, signer }) {
  return signArtifact(
    {
      schema_version: "one.local-return-envelope.v0.1",
      type: "ReturnEnvelope",
      return_id: `return:${FIXTURE_ID}`,
      episode_id: EPISODE_ID,
      previous_record_hash: artifactHash(settlement),
      recipient_ref: sourcePointRef,
      carriage: "LOCAL_FIXTURE_INBOX",
      mus_receipt_ref: receipt.receipt_id,
      mus_receipt_hash: receipt.receipt_hash,
      mus_signed_receipt_hash: sha256(canonicalize(receipt)),
      evidence_decision_ref: evidence.evidence_decision_id,
      evidence_decision_hash: artifactHash(evidence),
      settlement_ref: settlement.settlement_id,
      settlement_hash: artifactHash(settlement),
      remainder: structuredClone(settlement.remainder),
      requested_disposition: "RECEIVE_FOR_SOURCEPOINT_REVIEW",
      automatic_incorporation: false,
      succession_effect: "NONE",
      learning_effect: "NONE",
      future_authority_effect: "NONE",
      sent_at: "2026-08-04T00:00:06Z",
      claim_ceiling: "RECIPIENT_SPECIFIC_LOCAL_RETURN_CARRIAGE",
    },
    signer
  );
}

function acknowledgeReturn({ envelope, sourcePointRef, signer }) {
  if (
    envelope.type !== "ReturnEnvelope" ||
    envelope.recipient_ref !== sourcePointRef ||
    envelope.future_authority_effect !== "NONE" ||
    envelope.succession_effect !== "NONE" ||
    envelope.automatic_incorporation !== false
  ) {
    throw new Error("RETURN_ENVELOPE_NOT_ACKNOWLEDGEABLE");
  }
  return signArtifact(
    {
      schema_version: "one.local-return-acknowledgement.v0.1",
      type: "ReturnAcknowledgement",
      acknowledgement_id: `return-ack:${FIXTURE_ID}`,
      episode_id: EPISODE_ID,
      previous_record_hash: artifactHash(envelope),
      return_ref: envelope.return_id,
      return_hash: artifactHash(envelope),
      recipient_ref: sourcePointRef,
      disposition: "RECEIVED_FOR_DISPOSITION",
      incorporated: false,
      orientation_promoted: false,
      succession_effect: "NONE",
      learning_effect: "NONE",
      future_authority_effect: "NONE",
      acknowledged_at: "2026-08-04T00:00:07Z",
      claim_ceiling: "FIXTURE_SOURCEPOINT_RECEIPT_ACKNOWLEDGEMENT_ONLY",
    },
    signer
  );
}

function produceEpisode(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  if (fs.existsSync(root)) {
    if (!fs.statSync(root).isDirectory()) {
      throw new Error("CLOSURE_WORKSPACE_NOT_A_DIRECTORY");
    }
    if (fs.readdirSync(root).length !== 0) {
      throw new Error("CLOSURE_WORKSPACE_MUST_BE_EMPTY");
    }
  } else {
    fs.mkdirSync(root, { recursive: true });
  }
  const exportPath = path.join(root, "vesper-export.json");
  const observationPath = path.join(root, "observation.json");
  const evidencePath = path.join(root, "evidence-decision.json");
  const admissionPath = path.join(root, "mus-record-admission.json");
  const receiptPath = path.join(root, "mus-occurrence-receipt.json");
  const ledgerPath = path.join(root, "ledger", "ledger.jsonl");
  const receiptTrustPath = path.join(root, "trust", "receipt-keys.json");
  const roleTrustPath = path.join(root, "trust", "role-bindings.json");
  const journalPath = path.join(root, "return-journal.jsonl");
  const settlementPath = path.join(root, "settlement-decision.json");
  const returnPath = path.join(root, "return-inbox", "return-envelope.json");
  const acknowledgementPath = path.join(root, "return-acknowledgement.json");

  const runnerPath = path.resolve(__dirname, "..", "vesper_shadow_runner.py");
  const vesper = spawnSync(
    process.env.PYTHON || "python3",
    [runnerPath, "--fixture", FIXTURE_ID, "--output", exportPath],
    { encoding: "utf8" }
  );
  requireSuccessfulProcess(vesper, "VESPER_EXPORT");

  const observer = spawnSync(
    process.execPath,
    [path.join(__dirname, "observer-process.js"), exportPath, observationPath],
    { encoding: "utf8" }
  );
  requireSuccessfulProcess(observer, "OBSERVER_PROCESS");

  const exportPacket = readJson(exportPath);
  const observation = readJson(observationPath);
  const attempt = exportPacket.records.find((record) => record.type === "ExecutionAttempt");
  const occurrence = exportPacket.records.find((record) => record.type === "TransitionOccurrence");
  const preDispatch = exportPacket.records.find(
    (record) => record.type === "PreDispatchCrossingRecord"
  );
  const sourceExecutionReceipt = exportPacket.records.find(
    (record) => record.type === "ExecutionReceipt"
  );
  if (!attempt || !occurrence || !preDispatch || !sourceExecutionReceipt) {
    throw new Error("VESPER_CAUSAL_RECORDS_INCOMPLETE");
  }
  for (const record of [preDispatch, attempt, occurrence, sourceExecutionReceipt]) {
    const checked = verifyVesperRecord(
      record,
      exportPacket.signer.public_key_spki_der_hex
    );
    if (!checked.valid) throw new Error(checked.reason || "VESPER_RECORD_REJECTED");
  }

  const evidenceSigner = createFixtureSigner(
    "EVIDENCE_ASSESSOR",
    `evidence-key:${FIXTURE_ID}`
  );
  const musSigner = createFixtureSigner(
    "MUS_RECORDER_AND_RETURN_CARRIER",
    `mus-key:${FIXTURE_ID}`
  );
  const settlementSigner = createFixtureSigner(
    "LOCAL_SETTLEMENT_EVALUATOR",
    `settlement-key:${FIXTURE_ID}`
  );
  const sourcePointSigner = createFixtureSigner(
    "FIXTURE_SOURCEPOINT_RECIPIENT",
    `sourcepoint-key:${FIXTURE_ID}`
  );
  const sourcePointRef = `fixture-sourcepoint:${FIXTURE_ID}`;

  const evidence = evidenceDecisionFor({
    attempt,
    occurrence,
    observation,
    signer: evidenceSigner,
  });
  writeJsonDurable(evidencePath, evidence);

  const roleBindings = {
    schema_version: "one.occurrence-return-role-bindings.v0.1",
    standing: "FIXTURE_GENERATED_TRUST_CONFIGURATION",
    roles: {
      vesper_executor: {
        role: "PROCESS_SCOPED_TEST_SIGNER",
        key_id: exportPacket.signer.key_id,
        public_key: exportPacket.signer.public_key_spki_der_hex,
      },
      observer: {
        role: "LOCAL_OBSERVER",
        key_id: observation.attestation.key_id,
        public_key: observation.attestation.public_key,
      },
      evidence_assessor: {
        role: evidenceSigner.role,
        key_id: evidenceSigner.keyId,
        public_key: evidenceSigner.publicKeyHex,
      },
      mus_recorder: {
        role: musSigner.role,
        key_id: musSigner.keyId,
        public_key: musSigner.publicKeyHex,
      },
      settlement_evaluator: {
        role: settlementSigner.role,
        key_id: settlementSigner.keyId,
        public_key: settlementSigner.publicKeyHex,
      },
      sourcepoint_recipient: {
        role: sourcePointSigner.role,
        key_id: sourcePointSigner.keyId,
        public_key: sourcePointSigner.publicKeyHex,
        sourcepoint_ref: sourcePointRef,
      },
    },
    claim_ceiling: "Generated test keys establish fixture attribution only.",
  };
  writeJsonDurable(roleTrustPath, roleBindings);
  const receiptTrust = { trusted_keys: [musSigner.publicKeyHex] };
  writeJsonDurable(receiptTrustPath, receiptTrust);

  const localRecord = {
    action: LOCAL_ACTION,
    target: "mus:fixture-local-ledger",
    parameters: {
      episode_id: EPISODE_ID,
      vesper_export_hash: sha256(canonicalize(exportPacket)),
      role_bindings_hash: sha256(canonicalize(roleBindings)),
      receipt_trust_hash: sha256(canonicalize(receiptTrust)),
      pre_dispatch_ref: preDispatch.record_id,
      pre_dispatch_hash: artifactHash(preDispatch),
      attempt_ref: attempt.attempt_id,
      attempt_hash: artifactHash(attempt),
      occurrence_ref: occurrence.occurrence_id,
      occurrence_hash: artifactHash(occurrence),
      source_execution_receipt_ref: sourceExecutionReceipt.record_id,
      source_execution_receipt_hash: artifactHash(sourceExecutionReceipt),
      observation_ref: observation.observation_id,
      observation_hash: artifactHash(observation),
      evidence_decision_ref: evidence.evidence_decision_id,
      evidence_decision_hash: artifactHash(evidence),
      admitted_proposition: evidence.proposition,
      external_effect: "NOT_CLAIMED",
    },
  };
  const approval = {
    approval_id: crypto.randomUUID(),
    intent_hash: sha256(canonicalize(localRecord)),
    authorizer: `fixture-coordinator:${FIXTURE_ID}`,
    nonce: crypto.randomUUID(),
    scope: LOCAL_ACTION,
    authority_standing: "SYNTHETIC_FIXTURE_ONLY",
  };
  const validation = validateExecution(
    localRecord,
    structuredClone(localRecord),
    approval,
    [LOCAL_ACTION]
  );
  if (validation.decision !== "ALLOW") {
    throw new Error("MUS_RECORD_ADMISSION_REJECTED");
  }
  const admission = {
    schema_version: "one.mus-local-record-admission.v0.1",
    intent: localRecord,
    execution_input: structuredClone(localRecord),
    approval,
    claim_ceiling: "ALLOW admits an exact local record; it proves no external occurrence or lawful human authority.",
  };
  writeJsonDurable(admissionPath, admission);

  const receipt = signReceipt(
    {
      receipt_id: crypto.randomUUID(),
      timestamp: "2026-08-04T00:00:04.500Z",
      intent_hash: sha256(canonicalize(admission.intent)),
      execution_hash: sha256(canonicalize(admission.execution_input)),
      mus_unit_id: `mus-unit:fixture:${FIXTURE_ID}`,
      validation: {
        ...validation,
        profile: "one.mus-local-occurrence-record.v0.1",
        claim_ceiling: admission.claim_ceiling,
        admission_hash: sha256(canonicalize(admission)),
      },
      decision: validation.decision,
      approval,
      chain_reference: { previous_receipt_hash: null },
    },
    musSigner.privateKey,
    musSigner.publicKey
  );
  writeJsonDurable(receiptPath, receipt);
  const receiptVerification = verifySignedReceipt(receipt, musSigner.publicKey);
  if (!receiptVerification.valid) throw new Error("MUS_RECEIPT_SELF_VERIFICATION_FAILED");
  const ledger = createLedger({ ledgerPath, trustedKeys: [musSigner.publicKeyHex] });
  ledger.appendReceipt(receipt);
  const chain = verifyChain({
    ledgerPath,
    trustedKeysPath: receiptTrustPath,
    expectedHeadHash: receipt.receipt_hash,
    expectedRecordCount: 1,
  });
  if (!chain.valid) throw new Error(`MUS_CHAIN_REJECTED:${JSON.stringify(chain.errors)}`);

  const settlement = settlementFor({
    receipt,
    receiptVerified: receiptVerification.valid,
    chainVerified: chain.valid,
    evidence,
    signer: settlementSigner,
  });
  writeJsonDurable(settlementPath, settlement);
  appendJsonLineDurable(journalPath, settlement);

  const returnEnvelope = returnEnvelopeFor({
    receipt,
    evidence,
    settlement,
    sourcePointRef,
    signer: musSigner,
  });
  writeJsonDurable(returnPath, returnEnvelope);
  appendJsonLineDurable(journalPath, returnEnvelope);

  const deliveredEnvelope = readJson(returnPath);
  requireArtifact(
    verifyArtifact(deliveredEnvelope, roleBindings.roles.mus_recorder),
    "DELIVERED_RETURN_REJECTED"
  );
  const acknowledgement = acknowledgeReturn({
    envelope: deliveredEnvelope,
    sourcePointRef,
    signer: sourcePointSigner,
  });
  writeJsonDurable(acknowledgementPath, acknowledgement);
  appendJsonLineDurable(journalPath, acknowledgement);

  const expectedHeadHash = artifactHash(acknowledgement);
  return {
    ok: true,
    episode_id: EPISODE_ID,
    workspace: root,
    mus_ledger_head: receipt.receipt_hash,
    mus_ledger_count: 1,
    return_journal_head: expectedHeadHash,
    return_journal_count: 3,
    terminal_state_candidate: "RETURNED_UNPROMOTED",
    claim_ceiling: "SINGLE_DOMAIN_OCCURRENCE_TO_RETURN_FIXTURE_CLOSED_LOCAL_SYNTHETIC_ZERO_EGRESS",
  };
}

function main() {
  const workspace = process.argv[2];
  if (!workspace) {
    console.error("usage: produce.js <workspace-directory>");
    process.exitCode = 2;
    return;
  }
  try {
    process.stdout.write(JSON.stringify(produceEpisode(workspace)) + "\n");
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  EPISODE_ID,
  FIXTURE_ID,
  LOCAL_ACTION,
  acknowledgeReturn,
  evidenceDecisionFor,
  produceEpisode,
  returnEnvelopeFor,
  settlementFor,
};
