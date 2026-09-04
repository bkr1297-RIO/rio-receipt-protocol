const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { createLedger } = require("../ledger");
const { canonicalize, sha256, signReceipt } = require("../receipt-core");
const {
  acknowledgeReturn,
  produceEpisode,
  settlementFor,
} = require("../occurrence-return/produce");
const {
  artifactBody,
  artifactHash,
  createFixtureSigner,
  signArtifact,
  verifyArtifact,
  verifyVesperRecord,
} = require("../occurrence-return/crypto");
const {
  readJson,
  readJsonLines,
  writeJsonDurable,
} = require("../occurrence-return/io");
const { verifyEpisode } = require("../occurrence-return/verify");

function episode(t) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "one-otr-test-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  return { workspace, produced: produceEpisode(workspace) };
}

function verifyFresh({ workspace, produced }) {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve(__dirname, "..", "occurrence-return", "verify.js"),
      workspace,
      produced.return_journal_head,
      produced.mus_ledger_head,
    ],
    { encoding: "utf8" }
  );
  const line = result.stdout.trim().split("\n").filter(Boolean).at(-1);
  return {
    process: result,
    report: line ? JSON.parse(line) : null,
  };
}

function rewriteJsonLinesDurable(filePath, values) {
  const descriptor = fs.openSync(filePath, "w", 0o600);
  try {
    fs.writeFileSync(
      descriptor,
      values.map((value) => JSON.stringify(value)).join("\n") + "\n",
      "utf8"
    );
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

test("a fresh verifier derives only the bounded returned-unpromoted state", (t) => {
  const fixture = episode(t);
  const checked = verifyFresh(fixture);

  assert.equal(checked.process.status, 0, checked.process.stderr);
  assert.equal(checked.report.ok, true);
  assert.equal(checked.report.terminal_state, "RETURNED_UNPROMOTED");
  assert.equal(
    checked.report.claim_ceiling,
    "SINGLE_DOMAIN_OCCURRENCE_TO_RETURN_FIXTURE_CLOSED_LOCAL_SYNTHETIC_ZERO_EGRESS"
  );
  assert.ok(checked.report.excluded_claims.includes("federation"));
  assert.ok(checked.report.excluded_claims.includes("human-return"));
});

test("attempt, occurrence, observation, evidence, receipt, settlement, return, and acknowledgement stay distinct", (t) => {
  const { workspace } = episode(t);
  const exported = readJson(path.join(workspace, "vesper-export.json"));
  const attempt = exported.records.find((record) => record.type === "ExecutionAttempt");
  const occurrence = exported.records.find(
    (record) => record.type === "TransitionOccurrence"
  );
  const sourceExecutionReceipt = exported.records.find(
    (record) => record.type === "ExecutionReceipt"
  );
  const identifiers = [
    attempt.attempt_id,
    occurrence.occurrence_id,
    sourceExecutionReceipt.record_id,
    readJson(path.join(workspace, "observation.json")).observation_id,
    readJson(path.join(workspace, "evidence-decision.json")).evidence_decision_id,
    readJson(path.join(workspace, "mus-occurrence-receipt.json")).receipt_id,
    readJson(path.join(workspace, "settlement-decision.json")).settlement_id,
    readJson(path.join(workspace, "return-inbox", "return-envelope.json")).return_id,
    readJson(path.join(workspace, "return-acknowledgement.json")).acknowledgement_id,
  ];

  assert.equal(new Set(identifiers).size, identifiers.length);
  assert.equal(occurrence.external_effect, "NOT_CLAIMED");
});

test("tampering with the persisted occurrence prevents closure", (t) => {
  const fixture = episode(t);
  const exportPath = path.join(fixture.workspace, "vesper-export.json");
  const exported = readJson(exportPath);
  exported.records.find(
    (record) => record.type === "TransitionOccurrence"
  ).local_effect = "EXTERNAL_EFFECT_COMPLETED";
  writeJsonDurable(exportPath, exported);

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.equal(checked.report.ok, false);
  assert.ok(checked.report.errors.some((error) => error.includes("OCCURRENCE")));
});

test("duplicate or contradictory Vesper records cannot hide behind first-match lookup", (t) => {
  const fixture = episode(t);
  const exportPath = path.join(fixture.workspace, "vesper-export.json");
  const exported = readJson(exportPath);
  exported.records.push({
    type: "TransitionOccurrence",
    occurrence_id: "hostile-duplicate",
    external_effect: "EXTERNAL_EFFECT_COMPLETED",
    standing_effect: "GRANT",
  });
  writeJsonDurable(exportPath, exported);

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.ok(
    checked.report.errors.some((error) => error.includes("VESPER_RECORD_SET_REJECTED"))
  );
});

test("non-canonical signature encodings are rejected rather than truncated", (t) => {
  const { workspace } = episode(t);
  const observation = readJson(path.join(workspace, "observation.json"));
  const exported = readJson(path.join(workspace, "vesper-export.json"));
  const occurrence = exported.records.find(
    (record) => record.type === "TransitionOccurrence"
  );

  assert.equal(
    verifyArtifact(
      {
        ...observation,
        attestation: {
          ...observation.attestation,
          signature: `${observation.attestation.signature}zz`,
        },
      },
      {
        role: observation.attestation.signer_role,
        key_id: observation.attestation.key_id,
        public_key: observation.attestation.public_key,
      }
    ).valid,
    false
  );
  const trailingKey = {
    ...observation,
    attestation: {
      ...observation.attestation,
      public_key: `${observation.attestation.public_key}00`,
    },
  };
  assert.equal(
    verifyArtifact(trailingKey, {
      role: trailingKey.attestation.signer_role,
      key_id: trailingKey.attestation.key_id,
      public_key: trailingKey.attestation.public_key,
    }).valid,
    false
  );
  assert.equal(
    verifyVesperRecord(
      { ...occurrence, signature_hex: `${occurrence.signature_hex}zz` },
      exported.signer.public_key_spki_der_hex
    ).valid,
    false
  );

  const rsaPair = require("node:crypto").generateKeyPairSync("rsa", {
    modulusLength: 512,
  });
  const mislabeled = signArtifact(artifactBody(observation), {
    role: observation.attestation.signer_role,
    keyId: observation.attestation.key_id,
    privateKey: rsaPair.privateKey,
    publicKeyHex: rsaPair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex"),
  });
  assert.equal(
    verifyArtifact(mislabeled, {
      role: mislabeled.attestation.signer_role,
      key_id: mislabeled.attestation.key_id,
      public_key: mislabeled.attestation.public_key,
    }).valid,
    false
  );
});

test("unbound admission metadata and authority escalation are rejected", (t) => {
  const fixture = episode(t);
  const admissionPath = path.join(fixture.workspace, "mus-record-admission.json");
  const admission = readJson(admissionPath);
  admission.schema_version = "hostile";
  admission.claim_ceiling = "GLOBAL_PRODUCTION_EXECUTION";
  admission.approval.authority_standing = "LIVE_HUMAN_SOVEREIGN_AUTHORITY";
  writeJsonDurable(admissionPath, admission);

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.ok(
    checked.report.errors.some((error) =>
      error.includes("MUS_ADMISSION_CEILING_REJECTED")
    )
  );
});

test("fully re-signed and freshly anchored upstream and settlement overclaims still cannot close", (t) => {
  const fixture = episode(t);
  const exportPath = path.join(fixture.workspace, "vesper-export.json");
  const rolesPath = path.join(fixture.workspace, "trust", "role-bindings.json");
  const receiptTrustPath = path.join(
    fixture.workspace,
    "trust",
    "receipt-keys.json"
  );
  const admissionPath = path.join(fixture.workspace, "mus-record-admission.json");
  const receiptPath = path.join(fixture.workspace, "mus-occurrence-receipt.json");
  const ledgerPath = path.join(fixture.workspace, "ledger", "ledger.jsonl");
  const settlementPath = path.join(fixture.workspace, "settlement-decision.json");
  const returnPath = path.join(
    fixture.workspace,
    "return-inbox",
    "return-envelope.json"
  );
  const acknowledgementPath = path.join(
    fixture.workspace,
    "return-acknowledgement.json"
  );
  const journalPath = path.join(fixture.workspace, "return-journal.jsonl");

  const exported = readJson(exportPath);
  const metroEnvelope = exported.records.find(
    (record) => record.type === "MetroEnvelope"
  );
  metroEnvelope.scope = "GLOBAL_LIVE_AUTHORITY";
  metroEnvelope.provenance = "LIVE_HUMAN_AUTHORIZATION";
  const grant = exported.records.find(
    (record) => record.type === "AuthorizationGrant"
  );
  grant.method = "DELETE";
  grant.path_and_query = "/production/github/repos";
  writeJsonDurable(exportPath, exported);

  const newMus = createFixtureSigner(
    "MUS_RECORDER_AND_RETURN_CARRIER",
    "replacement-mus-key"
  );
  const newSettlement = createFixtureSigner(
    "LOCAL_SETTLEMENT_EVALUATOR",
    "replacement-settlement-key"
  );
  const newSourcePoint = createFixtureSigner(
    "FIXTURE_SOURCEPOINT_RECIPIENT",
    "replacement-sourcepoint-key"
  );
  const roles = readJson(rolesPath);
  for (const [roleName, signer] of [
    ["mus_recorder", newMus],
    ["settlement_evaluator", newSettlement],
    ["sourcepoint_recipient", newSourcePoint],
  ]) {
    roles.roles[roleName].role = signer.role;
    roles.roles[roleName].key_id = signer.keyId;
    roles.roles[roleName].public_key = signer.publicKeyHex;
  }
  const receiptTrust = { trusted_keys: [newMus.publicKeyHex] };
  writeJsonDurable(rolesPath, roles);
  writeJsonDurable(receiptTrustPath, receiptTrust);

  const admission = readJson(admissionPath);
  admission.intent.parameters.vesper_export_hash = sha256(canonicalize(exported));
  admission.intent.parameters.role_bindings_hash = sha256(canonicalize(roles));
  admission.intent.parameters.receipt_trust_hash = sha256(
    canonicalize(receiptTrust)
  );
  admission.execution_input = structuredClone(admission.intent);
  admission.approval.intent_hash = sha256(canonicalize(admission.intent));
  writeJsonDurable(admissionPath, admission);

  const oldReceipt = readJson(receiptPath);
  const {
    receipt_hash: _oldHash,
    signature: _oldSignature,
    signature_algorithm: _oldAlgorithm,
    public_key: _oldPublicKey,
    ...receiptBody
  } = oldReceipt;
  receiptBody.intent_hash = sha256(canonicalize(admission.intent));
  receiptBody.execution_hash = sha256(canonicalize(admission.execution_input));
  receiptBody.approval = structuredClone(admission.approval);
  receiptBody.validation.admission_hash = sha256(canonicalize(admission));
  const receipt = signReceipt(
    receiptBody,
    newMus.privateKey,
    newMus.publicKey
  );
  writeJsonDurable(receiptPath, receipt);
  const oldLedger = readJsonLines(ledgerPath)[0];
  rewriteJsonLinesDurable(ledgerPath, [
    {
      receipt_hash: receipt.receipt_hash,
      previous_receipt_hash: null,
      appended_at: oldLedger.appended_at,
      receipt,
    },
  ]);

  const settlementBody = artifactBody(readJson(settlementPath));
  settlementBody.previous_record_hash = sha256(canonicalize(receipt));
  settlementBody.mus_receipt_ref = receipt.receipt_id;
  settlementBody.mus_receipt_hash = receipt.receipt_hash;
  settlementBody.mus_signed_receipt_hash = sha256(canonicalize(receipt));
  settlementBody.claim_ceiling = "GLOBAL_PRODUCTION_SETTLEMENT";
  settlementBody.production_standing = "ESTABLISHED";
  settlementBody.authority_effect = "GRANT_GLOBAL_AUTHORITY";
  const settlement = signArtifact(settlementBody, newSettlement);
  writeJsonDurable(settlementPath, settlement);

  const returnBody = artifactBody(readJson(returnPath));
  returnBody.previous_record_hash = artifactHash(settlement);
  returnBody.settlement_hash = artifactHash(settlement);
  returnBody.mus_receipt_ref = receipt.receipt_id;
  returnBody.mus_receipt_hash = receipt.receipt_hash;
  returnBody.mus_signed_receipt_hash = sha256(canonicalize(receipt));
  const returned = signArtifact(returnBody, newMus);
  writeJsonDurable(returnPath, returned);

  const acknowledgementBody = artifactBody(readJson(acknowledgementPath));
  acknowledgementBody.previous_record_hash = artifactHash(returned);
  acknowledgementBody.return_hash = artifactHash(returned);
  const acknowledgement = signArtifact(acknowledgementBody, newSourcePoint);
  writeJsonDurable(acknowledgementPath, acknowledgement);
  rewriteJsonLinesDurable(journalPath, [settlement, returned, acknowledgement]);

  const checked = verifyFresh({
    workspace: fixture.workspace,
    produced: {
      ...fixture.produced,
      mus_ledger_head: receipt.receipt_hash,
      return_journal_head: artifactHash(acknowledgement),
    },
  });
  assert.equal(checked.process.status, 1);
  assert.ok(
    checked.report.errors.some((error) =>
      error.includes("VESPER_METRO_ENVELOPE_REJECTED")
    )
  );
  assert.ok(
    checked.report.errors.some((error) =>
      error.includes("VESPER_GRANT_SEMANTICS_REJECTED")
    )
  );
  assert.ok(
    checked.report.errors.some((error) => error.includes("SETTLEMENT_SHAPE_REJECTED"))
  );
  assert.ok(
    checked.report.errors.some((error) =>
      error.includes("SETTLEMENT_BINDING_OR_CEILING_REJECTED")
    )
  );
  assert.ok(
    checked.report.errors.every(
      (error) =>
        error.startsWith("SETTLEMENT_") ||
        error.startsWith("VESPER_METRO_ENVELOPE_") ||
        error.startsWith("VESPER_GRANT_SEMANTICS_")
    ),
    checked.report.errors.join("\n")
  );
});

test("unsigned ledger-envelope authority metadata is rejected", (t) => {
  const fixture = episode(t);
  const ledgerPath = path.join(fixture.workspace, "ledger", "ledger.jsonl");
  const ledger = readJsonLines(ledgerPath);
  ledger[0].human_authority = "ESTABLISHED";
  rewriteJsonLinesDurable(ledgerPath, ledger);

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.ok(
    checked.report.errors.some((error) =>
      error.includes("MUS_LEDGER_ENVELOPE_SHAPE_REJECTED")
    )
  );

  const nestedFixture = episode(t);
  const nestedLedgerPath = path.join(
    nestedFixture.workspace,
    "ledger",
    "ledger.jsonl"
  );
  const nestedLedger = readJsonLines(nestedLedgerPath);
  nestedLedger[0].appended_at = {
    human_authority: "ESTABLISHED",
    authority_effect: "GRANT_GLOBAL_AUTHORITY",
  };
  rewriteJsonLinesDurable(nestedLedgerPath, nestedLedger);

  const nestedChecked = verifyFresh(nestedFixture);
  assert.equal(nestedChecked.process.status, 1);
  assert.ok(
    nestedChecked.report.errors.some((error) =>
      error.includes("appended_at must be a canonical ISO-8601 UTC timestamp") ||
      error.includes("MUS_LEDGER_RECEIPT_IDENTITY_REJECTED")
    )
  );
});

test("required standalone artifacts must be JSON objects", (t) => {
  for (const relative of [
    "settlement-decision.json",
    path.join("return-inbox", "return-envelope.json"),
    "return-acknowledgement.json",
  ]) {
    const fixture = episode(t);
    writeJsonDurable(path.join(fixture.workspace, relative), null);

    const checked = verifyFresh(fixture);
    assert.equal(checked.process.status, 1, relative);
    assert.equal(checked.report.ok, false, relative);
    assert.equal(checked.report.terminal_state, "NOT_CLOSED", relative);
    assert.ok(
      checked.report.errors.some((error) =>
        error.includes("EXPECTED_JSON_OBJECT")
      ),
      relative
    );
  }
});

test("a malformed Vesper signer yields NOT_CLOSED rather than a verifier crash", (t) => {
  const fixture = episode(t);
  const exportPath = path.join(fixture.workspace, "vesper-export.json");
  const exported = readJson(exportPath);
  exported.signer = null;
  writeJsonDurable(exportPath, exported);

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.equal(checked.report.ok, false);
  assert.equal(checked.report.terminal_state, "NOT_CLOSED");
  assert.ok(
    checked.report.errors.some((error) =>
      error.includes("VESPER_SIGNER_SHAPE_REJECTED")
    )
  );
});

test("observer identity must match the closed process-reference grammar", (t) => {
  const fixture = episode(t);
  const observationPath = path.join(fixture.workspace, "observation.json");
  const observation = readJson(observationPath);
  observation.observer_ref =
    "observer-process:123:human_authority=ESTABLISHED";
  writeJsonDurable(observationPath, observation);

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.equal(checked.report.terminal_state, "NOT_CLOSED");
  assert.ok(
    checked.report.errors.some((error) =>
      error.includes("OBSERVATION_BINDING_OR_CEILING_REJECTED")
    )
  );
});

test("an unreadable ledger path yields NOT_CLOSED rather than a verifier crash", (t) => {
  const fixture = episode(t);
  const ledgerPath = path.join(fixture.workspace, "ledger", "ledger.jsonl");
  fs.unlinkSync(ledgerPath);
  fs.mkdirSync(ledgerPath);

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.equal(checked.report.ok, false);
  assert.equal(checked.report.terminal_state, "NOT_CLOSED");
  assert.ok(
    checked.report.errors.some((error) => error.includes("MUS_CHAIN_REJECTED"))
  );
});

test("both independently supplied ledger heads are mandatory", (t) => {
  const fixture = episode(t);
  const noMusHead = verifyEpisode(
    fixture.workspace,
    fixture.produced.return_journal_head,
    undefined
  );
  assert.equal(noMusHead.ok, false);
  assert.ok(noMusHead.errors.includes("EXPECTED_MUS_HEAD_REQUIRED"));

  const noReturnHead = verifyEpisode(
    fixture.workspace,
    undefined,
    fixture.produced.mus_ledger_head
  );
  assert.equal(noReturnHead.ok, false);
  assert.ok(noReturnHead.errors.includes("EXPECTED_RETURN_HEAD_REQUIRED"));
});

test("malformed receipt and deleted environment evidence yield NOT_CLOSED, not a crash", (t) => {
  const malformed = episode(t);
  writeJsonDurable(path.join(malformed.workspace, "mus-occurrence-receipt.json"), []);
  const malformedCheck = verifyFresh(malformed);
  assert.equal(malformedCheck.process.status, 1);
  assert.equal(malformedCheck.report.terminal_state, "NOT_CLOSED");

  const malformedAdmission = episode(t);
  writeJsonDurable(
    path.join(malformedAdmission.workspace, "mus-record-admission.json"),
    []
  );
  const malformedAdmissionCheck = verifyFresh(malformedAdmission);
  assert.equal(malformedAdmissionCheck.process.status, 1);
  assert.equal(malformedAdmissionCheck.report.terminal_state, "NOT_CLOSED");

  const missingEvidence = episode(t);
  const exportPath = path.join(missingEvidence.workspace, "vesper-export.json");
  const exported = readJson(exportPath);
  delete exported.records.find(
    (record) => record.type === "TransitionOccurrence"
  ).environment_evidence;
  writeJsonDurable(exportPath, exported);
  const missingEvidenceCheck = verifyFresh(missingEvidence);
  assert.equal(missingEvidenceCheck.process.status, 1);
  assert.equal(missingEvidenceCheck.report.terminal_state, "NOT_CLOSED");

  const nullSourceRecord = episode(t);
  const nullSourcePath = path.join(
    nullSourceRecord.workspace,
    "vesper-export.json"
  );
  const nullSourceExport = readJson(nullSourcePath);
  nullSourceExport.records[0] = null;
  writeJsonDurable(nullSourcePath, nullSourceExport);
  const nullSourceCheck = verifyFresh(nullSourceRecord);
  assert.equal(nullSourceCheck.process.status, 1);
  assert.equal(nullSourceCheck.report.terminal_state, "NOT_CLOSED");
});

test("observation and evidence are required rather than inferred from a receipt", (t) => {
  const fixture = episode(t);
  fs.unlinkSync(path.join(fixture.workspace, "observation.json"));
  fs.unlinkSync(path.join(fixture.workspace, "evidence-decision.json"));

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.equal(checked.report.ok, false);
  assert.ok(checked.report.errors.some((error) => error.startsWith("OBSERVATION_")));
  assert.ok(checked.report.errors.some((error) => error.startsWith("EVIDENCE_")));
});

test("an untrusted MUS signer prevents chain admission from supporting closure", (t) => {
  const fixture = episode(t);
  const roles = readJson(path.join(fixture.workspace, "trust", "role-bindings.json"));
  writeJsonDurable(path.join(fixture.workspace, "trust", "receipt-keys.json"), {
    trusted_keys: [roles.roles.evidence_assessor.public_key],
  });

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.ok(checked.report.errors.some((error) => error.includes("MUS_CHAIN_REJECTED")));
});

test("a clean-prefix return-journal truncation fails against the supplied head and count", (t) => {
  const fixture = episode(t);
  const journalPath = path.join(fixture.workspace, "return-journal.jsonl");
  const records = readJsonLines(journalPath);
  rewriteJsonLinesDurable(journalPath, records.slice(0, 2));

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.ok(
    checked.report.errors.some((error) =>
      error.includes("RETURN_JOURNAL_COUNT_MISMATCH")
    )
  );
});

test("an absent recipient acknowledgement prevents closure", (t) => {
  const fixture = episode(t);
  fs.unlinkSync(path.join(fixture.workspace, "return-acknowledgement.json"));

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.ok(
    checked.report.errors.some((error) =>
      error.startsWith("RETURN_ACKNOWLEDGEMENT_MISSING_OR_INVALID")
    )
  );
});

test("the external Return head detects recipient signer substitution", (t) => {
  const fixture = episode(t);
  const acknowledgementPath = path.join(
    fixture.workspace,
    "return-acknowledgement.json"
  );
  const rolesPath = path.join(fixture.workspace, "trust", "role-bindings.json");
  const journalPath = path.join(fixture.workspace, "return-journal.jsonl");
  const attacker = createFixtureSigner(
    "FIXTURE_SOURCEPOINT_RECIPIENT",
    "substituted-sourcepoint-key"
  );
  const substituted = signArtifact(
    artifactBody(readJson(acknowledgementPath)),
    attacker
  );
  const roles = readJson(rolesPath);
  roles.roles.sourcepoint_recipient.key_id = attacker.keyId;
  roles.roles.sourcepoint_recipient.public_key = attacker.publicKeyHex;
  writeJsonDurable(rolesPath, roles);
  writeJsonDurable(acknowledgementPath, substituted);
  const journal = readJsonLines(journalPath);
  journal[2] = substituted;
  rewriteJsonLinesDurable(journalPath, journal);

  const checked = verifyFresh(fixture);
  assert.equal(checked.process.status, 1);
  assert.ok(
    checked.report.errors.some((error) =>
      error.includes("RETURN_JOURNAL_HEAD_MISMATCH")
    )
  );
});

test("return acknowledgement refuses an envelope that tries to create authority", (t) => {
  const { workspace } = episode(t);
  const envelope = readJson(
    path.join(workspace, "return-inbox", "return-envelope.json")
  );
  envelope.future_authority_effect = "GRANT";

  assert.throws(
    () =>
      acknowledgeReturn({
        envelope,
        sourcePointRef: envelope.recipient_ref,
        signer: createFixtureSigner("FIXTURE_SOURCEPOINT_RECIPIENT", "attack-key"),
      }),
    /RETURN_ENVELOPE_NOT_ACKNOWLEDGEABLE/
  );
});

test("settlement cannot be produced before receipt and chain verification", () => {
  assert.throws(
    () =>
      settlementFor({
        receipt: {},
        receiptVerified: false,
        chainVerified: true,
        evidence: {},
        signer: createFixtureSigner("LOCAL_SETTLEMENT_EVALUATOR", "test-key"),
      }),
    /SETTLEMENT_REQUIRES_VERIFIED_MUS_RECEIPT/
  );
});

test("the exact MUS receipt cannot be appended twice", (t) => {
  const { workspace } = episode(t);
  const receipt = readJson(path.join(workspace, "mus-occurrence-receipt.json"));
  const ledger = createLedger({
    ledgerPath: path.join(workspace, "ledger", "ledger.jsonl"),
    trustedKeys: [receipt.public_key],
  });

  assert.throws(() => ledger.appendReceipt(receipt), /Chain link mismatch|duplicate/);
  assert.equal(ledger.readLedger().length, 1);
});

test("a closure workspace is single-use and refuses mixed-packet overwrite", (t) => {
  const fixture = episode(t);
  assert.throws(
    () => produceEpisode(fixture.workspace),
    /CLOSURE_WORKSPACE_MUST_BE_EMPTY/
  );
});

test("the published closure artifact schema is closed around fixed claim ceilings", () => {
  const schema = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "..",
        "spec",
        "occurrence-return",
        "closure-artifacts.schema.json"
      ),
      "utf8"
    )
  );
  assert.equal(schema.$id, "https://one.example/schema/occurrence-return/closure-artifacts-v0.1.json");
  for (const name of [
    "observation",
    "evidenceDecision",
    "settlementDecision",
    "returnEnvelope",
    "returnAcknowledgement",
  ]) {
    assert.equal(schema.$defs[name].unevaluatedProperties, false);
  }
  assert.equal(
    schema.$defs.observation.allOf[1].properties.claim_ceiling.const,
    "SEPARATELY_ATTRIBUTABLE_LOCAL_OBSERVATION"
  );
  assert.ok(
    schema.$defs.settlementDecision.allOf[1].required.includes(
      "mus_signed_receipt_hash"
    )
  );
  assert.equal(schema.$defs.attestation.additionalProperties, false);
  assert.equal(
    schema.$defs.attestation.properties.signature.pattern,
    "^[0-9a-f]{128}$"
  );
});
