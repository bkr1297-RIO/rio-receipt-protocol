#!/usr/bin/env node

// A bounded composition of the local receipt/return mechanics.  It is not a
// networked federation engine and produces no external effect.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { canonicalize, sha256, signReceipt, validateExecution, verifySignedReceipt } = require("../receipt-core");
const { createLedger } = require("../ledger");
const { verifyChain } = require("../verify-chain");
const { artifactHash, createFixtureSigner, signArtifact } = require("../occurrence-return/crypto");
const { appendJsonLineDurable, writeJsonDurable } = require("../occurrence-return/io");

const FIXTURE_ID = "FED-001-TWO-CAMPUS-LOCAL-ROUTE";
const EPISODE_ID = `episode:${FIXTURE_ID}`;
const ACTION = "convey_fixture_crossing_record";
const CEILING = "TWO_JURISDICTION_FEDERATED_CROSSING_FIXTURE_LOCAL_SYNTHETIC_ZERO_EGRESS";

function artifact(body, signer, file, root) {
  const value = signArtifact(body, signer);
  writeJsonDurable(path.join(root, file), value);
  return value;
}

function requireEmptyWorkspace(root) {
  if (fs.existsSync(root) && (!fs.statSync(root).isDirectory() || fs.readdirSync(root).length)) {
    throw new Error("FEDERATION_WORKSPACE_MUST_BE_EMPTY_DIRECTORY");
  }
  fs.mkdirSync(root, { recursive: true });
}

function produceFederatedCrossing(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  requireEmptyWorkspace(root);
  const signers = {
    campusA: createFixtureSigner("CAMPUS_JURISDICTION_STEWARD", "campus-a-key"),
    campusB: createFixtureSigner("CAMPUS_JURISDICTION_STEWARD", "campus-b-key"),
    world: createFixtureSigner("SHAREDWORLD_STEWARD", "sharedworld-key"),
    observer: createFixtureSigner("FEDERATED_CROSSING_OBSERVER", "observer-key"),
    evidence: createFixtureSigner("CROSSING_EVIDENCE_ASSESSOR", "evidence-key"),
    compliance: createFixtureSigner("COMPLIANCE_ASSESSMENT_RECORDER", "compliance-key"),
    mus: createFixtureSigner("MUS_RECORDER_AND_RETURN_CARRIER", "mus-key"),
    settlement: createFixtureSigner("FEDERATED_SETTLEMENT_EVALUATOR", "settlement-key"),
  };
  const roles = Object.fromEntries(Object.entries(signers).map(([name, signer]) => [name, {
    role: signer.role, key_id: signer.keyId, public_key: signer.publicKeyHex,
  }]));
  writeJsonDurable(path.join(root, "trust", "role-bindings.json"), {
    schema_version: "one.federation-fixture-role-bindings.v0.1",
    standing: "FIXTURE_GENERATED_TRUST_CONFIGURATION",
    roles,
    claim_ceiling: "Fixture keys establish local attribution only; they establish no independent jurisdiction or custody.",
  });
  writeJsonDurable(path.join(root, "trust", "receipt-keys.json"), { trusted_keys: [signers.mus.publicKeyHex] });

  const campusA = artifact({
    schema_version: "one.federation-campus-ref.v0.1", type: "CampusRef", campus_id: "campus:fixture-a",
    jurisdiction_envelope: "fixture-jurisdiction:a", authority_topology: "MULTI_ROLE_UNRESOLVED_FIXTURE",
    sourcepoint_ref: "sourcepoint:fixture-a", claim_ceiling: "DISTINCT_FIXTURE_JURISDICTION_REFERENCE_ONLY",
  }, signers.campusA, "campuses/campus-a.json", root);
  const campusB = artifact({
    schema_version: "one.federation-campus-ref.v0.1", type: "CampusRef", campus_id: "campus:fixture-b",
    jurisdiction_envelope: "fixture-jurisdiction:b", authority_topology: "MULTI_ROLE_UNRESOLVED_FIXTURE",
    sourcepoint_ref: "sourcepoint:fixture-b", claim_ceiling: "DISTINCT_FIXTURE_JURISDICTION_REFERENCE_ONLY",
  }, signers.campusB, "campuses/campus-b.json", root);
  const sharedWorld = artifact({
    schema_version: "one.shared-world.v0.1", type: "SharedWorld", shared_world_id: "shared-world:fixture-k",
    purpose: "Convey one inert fixture crossing record without merging either jurisdiction.",
    participant_refs: [campusA.campus_id, campusB.campus_id], participant_hashes: [artifactHash(campusA), artifactHash(campusB)],
    duration: { starts_at: "2026-09-04T00:00:00Z", expires_at: "2026-09-05T00:00:00Z" },
    scope: [ACTION], rules: ["NO_EXTERNAL_EFFECT", "NO_SHARED_SUCCESSION", "RECIPIENT_RETURNS_REMAIN_DISTINCT"],
    claim_ceiling: "PURPOSE_BOUND_LOCAL_SHARED_ENCOUNTER_SPACE_ONLY",
  }, signers.world, "shared-world.json", root);
  const entryDoor = artifact({
    schema_version: "one.federation-door.v0.1", type: "Door", door_id: "door:fixture-a-to-k",
    from_ref: campusA.campus_id, to_ref: sharedWorld.shared_world_id, authority_jurisdiction_ref: campusA.jurisdiction_envelope,
    scope: [ACTION], allowed_actions: [ACTION], allowed_disclosure: ["crossing-id", "receipt-hash", "local-zero-egress-standing"],
    expires_at: "2026-09-05T00:00:00Z", revocation_status: "NOT_REVOKED_FIXTURE", effect_capability: "INERT_SCHEMA_AND_FIXTURE_ADMISSION_ONLY",
    claim_ceiling: "DOOR_DEFINES_POSSIBILITY_NOT_OCCURRENCE",
  }, signers.campusA, "doors/door-a-to-k.json", root);
  const exitDoor = artifact({
    schema_version: "one.federation-door.v0.1", type: "Door", door_id: "door:fixture-k-to-b",
    from_ref: sharedWorld.shared_world_id, to_ref: campusB.campus_id, authority_jurisdiction_ref: campusB.jurisdiction_envelope,
    scope: [ACTION], allowed_actions: [ACTION], allowed_disclosure: ["crossing-id", "receipt-hash", "local-zero-egress-standing"],
    expires_at: "2026-09-05T00:00:00Z", revocation_status: "NOT_REVOKED_FIXTURE", effect_capability: "INERT_SCHEMA_AND_FIXTURE_ADMISSION_ONLY",
    claim_ceiling: "DOOR_DEFINES_POSSIBILITY_NOT_OCCURRENCE",
  }, signers.campusB, "doors/door-k-to-b.json", root);
  const crossing = artifact({
    schema_version: "one.federated-crossing.v0.1", type: "Crossing", crossing_id: `crossing:${FIXTURE_ID}`, episode_id: EPISODE_ID,
    source_campus_ref: campusA.campus_id, target_campus_ref: campusB.campus_id,
    shared_world_ref: sharedWorld.shared_world_id, shared_world_hash: artifactHash(sharedWorld),
    entry_door_ref: entryDoor.door_id, entry_door_hash: artifactHash(entryDoor), exit_door_ref: exitDoor.door_id, exit_door_hash: artifactHash(exitDoor),
    action: ACTION, occurred_at: "2026-09-04T00:00:01Z", occurrence_mode: "LOCAL_SYNTHETIC_NO_EGRESS",
    occurrence_effect: "FIXTURE_RECORD_CONVEYED_ONLY", external_effect: "NOT_CLAIMED", succession_effect: "NONE", future_authority_effect: "NONE",
    claim_ceiling: "CROSSING_OCCURRENCE_IS_LOCAL_SYNTHETIC_ONLY",
  }, signers.world, "crossing.json", root);
  const trace = artifact({
    schema_version: "one.federated-crossing-trace.v0.1", type: "CrossingTrace", trace_id: `trace:${FIXTURE_ID}`, crossing_ref: crossing.crossing_id,
    crossing_hash: artifactHash(crossing), interfaces: [entryDoor.door_id, sharedWorld.shared_world_id, exitDoor.door_id],
    reconstructed_at: "2026-09-04T00:00:02Z", trace_claim: "RECONSTRUCTS_DECLARED_FIXTURE_ROUTE_ONLY",
    lawfulness_status: "NOT_PROVEN_BY_TRACE", claim_ceiling: "TRACE_IS_NOT_PROOF_OF_LAWFULNESS",
  }, signers.observer, "crossing-trace.json", root);
  const observation = artifact({
    schema_version: "one.federated-crossing-observation.v0.1", type: "Observation", observation_id: `observation:${FIXTURE_ID}`,
    crossing_ref: crossing.crossing_id, crossing_hash: artifactHash(crossing), trace_ref: trace.trace_id, trace_hash: artifactHash(trace),
    observed_proposition: "The declared local fixture crossing links two distinct fixture jurisdiction envelopes through the declared SharedWorld and Doors.",
    local_result: "OBSERVED_LOCAL_FIXTURE_RECORD", external_effect: "NOT_OBSERVED_OR_CLAIMED", observed_at: "2026-09-04T00:00:03Z",
    truth_effect: "NONE", settlement_effect: "NONE", standing_effect: "NONE", claim_ceiling: "SEPARATE_LOCAL_OBSERVATION_ONLY",
  }, signers.observer, "observation.json", root);
  const evidence = artifact({
    schema_version: "one.federated-crossing-evidence.v0.1", type: "CrossingEvidence", evidence_id: `evidence:${FIXTURE_ID}`,
    crossing_ref: crossing.crossing_id, crossing_hash: artifactHash(crossing), observation_ref: observation.observation_id, observation_hash: artifactHash(observation),
    proposition: observation.observed_proposition, verdict: "SUPPORT", strength: "STRONG_FOR_DECLARED_LOCAL_PROPOSITION",
    external_outcome_evidence: "NOT_ESTABLISHED", human_authority_evidence: "NOT_ESTABLISHED", lawful_compliance_evidence: "NOT_ESTABLISHED",
    claim_ceiling: "EVIDENCE_DOES_NOT_DETERMINE_LAWFULNESS_OR_SUCCESSION",
  }, signers.evidence, "crossing-evidence.json", root);
  const compliance = artifact({
    schema_version: "one.federation-compliance-assessment.v0.1", type: "ComplianceAssessment", assessment_id: `compliance:${FIXTURE_ID}`,
    crossing_ref: crossing.crossing_id, crossing_hash: artifactHash(crossing), evidence_ref: evidence.evidence_id, evidence_hash: artifactHash(evidence),
    determination: "NOT_ASSESSED_FOR_CONSTITUTIONAL_LAWFULNESS", reason: "Fixture has no live authority topology, external observation, or governing law evaluator.",
    succession_effect: "NONE", claim_ceiling: "COMPLIANCE_DECISION_REMAINS_UNESTABLISHED",
  }, signers.compliance, "compliance-assessment.json", root);

  const intent = { action: ACTION, target: "mus:fixture-federated-ledger", parameters: { crossing_hash: artifactHash(crossing), evidence_hash: artifactHash(evidence), compliance_hash: artifactHash(compliance) } };
  const approval = { approval_id: crypto.randomUUID(), intent_hash: sha256(canonicalize(intent)), authorizer: "fixture-coordinator", nonce: crypto.randomUUID(), scope: ACTION, authority_standing: "SYNTHETIC_FIXTURE_ONLY" };
  const validation = validateExecution(intent, structuredClone(intent), approval, [ACTION]);
  if (validation.decision !== "ALLOW") throw new Error("FEDERATED_MUS_ADMISSION_REJECTED");
  const receipt = signReceipt({ receipt_id: crypto.randomUUID(), timestamp: "2026-09-04T00:00:04Z", intent_hash: sha256(canonicalize(intent)), execution_hash: sha256(canonicalize(intent)), mus_unit_id: `mus-unit:${FIXTURE_ID}`, validation: { ...validation, profile: "one.federated-crossing-record.v0.1", claim_ceiling: "LOCAL_FIXTURE_RECORD_ONLY" }, decision: validation.decision, approval, chain_reference: { previous_receipt_hash: null } }, signers.mus.privateKey, signers.mus.publicKey);
  writeJsonDurable(path.join(root, "mus-receipt.json"), receipt);
  if (!verifySignedReceipt(receipt, signers.mus.publicKey).valid) throw new Error("MUS_RECEIPT_REJECTED");
  const ledgerPath = path.join(root, "ledger", "ledger.jsonl");
  createLedger({ ledgerPath, trustedKeys: [signers.mus.publicKeyHex] }).appendReceipt(receipt);
  if (!verifyChain({ ledgerPath, trustedKeysPath: path.join(root, "trust", "receipt-keys.json"), expectedHeadHash: receipt.receipt_hash, expectedRecordCount: 1 }).valid) throw new Error("MUS_CHAIN_REJECTED");
  const settlement = artifact({
    schema_version: "one.federated-crossing-settlement.v0.1", type: "SettlementDecision", settlement_id: `settlement:${FIXTURE_ID}`,
    crossing_ref: crossing.crossing_id, crossing_hash: artifactHash(crossing), evidence_ref: evidence.evidence_id, evidence_hash: artifactHash(evidence),
    mus_receipt_ref: receipt.receipt_id, mus_receipt_hash: receipt.receipt_hash, mus_signed_receipt_hash: sha256(canonicalize(receipt)),
    disposition: "SETTLED_LOCAL_FEDERATED_FIXTURE_RECORD", settled_scope: ["two-distinct-fixture-jurisdictions", "typed-shared-world-and-doors", "local-crossing-observed-evidenced-and-receipted"],
    unresolved_scope: ["constitutional-lawfulness", "shared-succession", "external-effect", "human-authority", "production-federation"], succession_effect: "NONE", future_authority_effect: "NONE", claim_ceiling: "FIXTURE_LOCAL_SETTLEMENT_ONLY",
  }, signers.settlement, "settlement.json", root);
  const journalPath = path.join(root, "return-journal.jsonl"); appendJsonLineDurable(journalPath, settlement);
  const returns = [["a", campusA, signers.campusA], ["b", campusB, signers.campusB]].map(([side, campus, signer]) => {
    const envelope = artifact({ schema_version: "one.federated-return-envelope.v0.1", type: "ReturnEnvelope", return_id: `return:${FIXTURE_ID}:${side}`, recipient_campus_ref: campus.campus_id, crossing_ref: crossing.crossing_id, crossing_hash: artifactHash(crossing), settlement_ref: settlement.settlement_id, settlement_hash: artifactHash(settlement), mus_receipt_hash: receipt.receipt_hash, requested_disposition: "RECEIVE_FOR_LOCAL_JURISDICTION_REVIEW", automatic_incorporation: false, shared_succession: false, future_authority_effect: "NONE", claim_ceiling: "RECIPIENT_SPECIFIC_RETURN_NOT_SHARED_SUCCESSION" }, signers.mus, `returns/return-${side}.json`, root);
    appendJsonLineDurable(journalPath, envelope);
    const acknowledgement = artifact({ schema_version: "one.federated-return-acknowledgement.v0.1", type: "ReturnAcknowledgement", acknowledgement_id: `ack:${FIXTURE_ID}:${side}`, return_ref: envelope.return_id, return_hash: artifactHash(envelope), recipient_campus_ref: campus.campus_id, disposition: "RECEIVED_FOR_LOCAL_DISPOSITION", incorporated: false, shared_succession: false, future_authority_effect: "NONE", claim_ceiling: "LOCAL_RECIPIENT_ACKNOWLEDGEMENT_ONLY" }, signer, `acknowledgements/ack-${side}.json`, root);
    appendJsonLineDurable(journalPath, acknowledgement); return acknowledgement;
  });
  return { ok: true, workspace: root, episode_id: EPISODE_ID, mus_ledger_head: receipt.receipt_hash, return_journal_head: artifactHash(returns[1]), return_journal_count: 5, terminal_state_candidate: "FEDERATED_RETURNED_UNPROMOTED", claim_ceiling: CEILING };
}

if (require.main === module) { const root = process.argv[2]; if (!root) { console.error("usage: produce.js <workspace-directory>"); process.exitCode = 2; } else { try { console.log(JSON.stringify(produceFederatedCrossing(root))); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; } } }
module.exports = { CEILING, EPISODE_ID, FIXTURE_ID, produceFederatedCrossing };
