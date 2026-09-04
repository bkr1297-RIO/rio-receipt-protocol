#!/usr/bin/env node

const path = require("path");
const { artifactHash, createFixtureSigner, signArtifact, verifyVesperRecord } = require("./crypto");
const { readJson, writeJsonDurable } = require("./io");

function observePersistedVesperExport(exportPath) {
  const packet = readJson(exportPath);
  if (packet.schema_version !== "one.vesper-shadow-export.v0.1") {
    throw new Error("VESPER_EXPORT_SCHEMA_REJECTED");
  }
  const publicKey = packet.signer && packet.signer.public_key_spki_der_hex;
  if (!publicKey) {
    throw new Error("VESPER_EXPORT_PUBLIC_KEY_MISSING");
  }
  const attempt = packet.records.find((record) => record.type === "ExecutionAttempt");
  const occurrence = packet.records.find((record) => record.type === "TransitionOccurrence");
  if (!attempt) throw new Error("EXECUTION_ATTEMPT_MISSING");
  if (!occurrence) throw new Error("TRANSITION_OCCURRENCE_MISSING");
  for (const record of [attempt, occurrence]) {
    const verification = verifyVesperRecord(record, publicKey);
    if (!verification.valid) {
      throw new Error(verification.reason || "VESPER_RECORD_REJECTED");
    }
  }
  if (occurrence.attempt_ref !== attempt.attempt_id) {
    throw new Error("OCCURRENCE_ATTEMPT_BINDING_REJECTED");
  }
  if (
    attempt.mode !== "SIMULATED_NO_EGRESS" ||
    attempt.external_call_count !== 0 ||
    occurrence.target_ref !== attempt.target_ref ||
    occurrence.payload_hash !== attempt.payload_hash ||
    occurrence.effect_type !== "LOCAL_DENY_ALL_RESULT_RECORDED" ||
    occurrence.local_effect !== "FIXTURE_BOUNDARY_RETURNED_EGRESS_BLOCKED" ||
    occurrence.environment_evidence?.target_ref !== attempt.target_ref ||
    occurrence.environment_evidence?.payload_hash !== attempt.payload_hash ||
    occurrence.environment_evidence?.result !== "EGRESS_BLOCKED" ||
    occurrence.external_effect !== "NOT_CLAIMED"
  ) {
    throw new Error("LOCAL_OCCURRENCE_CLAIM_REJECTED");
  }
  const signer = createFixtureSigner(
    "LOCAL_OBSERVER",
    `observer-key:${packet.fixture_id}`
  );
  const observation = signArtifact(
    {
      schema_version: "one.local-occurrence-observation.v0.1",
      type: "Observation",
      observation_id: `observation:${packet.fixture_id}`,
      episode_id: `episode:${packet.fixture_id}`,
      attempt_ref: attempt.attempt_id,
      occurrence_ref: occurrence.occurrence_id,
      occurrence_hash: artifactHash(occurrence),
      observer_ref: `observer-process:${process.pid}`,
      observation_method: "PERSISTED_EXPORT_READBACK_AND_SIGNATURE_VERIFICATION",
      observed_proposition: "The fixture boundary returned EGRESS_BLOCKED for the declared payload.",
      completeness: "COMPLETE_FOR_DECLARED_LOCAL_OCCURRENCE",
      local_result: "EGRESS_BLOCKED",
      external_effect: "NOT_OBSERVED_OR_CLAIMED",
      observed_at: "2026-08-04T00:00:03Z",
      evidence_admission_effect: "NONE",
      truth_effect: "NONE",
      settlement_effect: "NONE",
      standing_effect: "NONE",
      claim_ceiling: "SEPARATELY_ATTRIBUTABLE_LOCAL_OBSERVATION",
    },
    signer
  );
  return observation;
}

function main() {
  const [exportPath, outputPath] = process.argv.slice(2);
  if (!exportPath || !outputPath) {
    console.error("usage: observer-process.js <vesper-export.json> <observation.json>");
    process.exitCode = 2;
    return;
  }
  const observation = observePersistedVesperExport(path.resolve(exportPath));
  writeJsonDurable(path.resolve(outputPath), observation);
  process.stdout.write(JSON.stringify({
    ok: true,
    observation_id: observation.observation_id,
    occurrence_ref: observation.occurrence_ref,
  }) + "\n");
}

if (require.main === module) main();

module.exports = { observePersistedVesperExport };
