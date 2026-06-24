"use strict";

const assert = require("assert");
const crypto = require("crypto");
const demo = require("../demo_sourceboard_to_real_receipt");
const adapter = require("../sim-mus-adapter");

function makeEphemeralMusUnit() {
  const pair = crypto.generateKeyPairSync("ed25519");
  const privateKeyDer = pair.privateKey.export({ type: "pkcs8", format: "der" });
  const publicKeyDer = pair.publicKey.export({ type: "spki", format: "der" });
  const publicKeyHex = publicKeyDer.toString("hex");

  return {
    config: {
      mus_unit_id: "mus-test-unit",
      owner: "human:test",
    },
    signingKey: {
      private_key: privateKeyDer.toString("hex"),
      public_key: publicKeyHex,
    },
    trustedKeys: [publicKeyHex],
  };
}

function verifySignature(receipt) {
  const body = {
    receipt_id: receipt.receipt_id,
    timestamp: receipt.timestamp,
    intent_hash: receipt.intent_hash,
    execution_hash: receipt.execution_hash,
    mus_unit_id: receipt.mus_unit_id,
    validation: receipt.validation,
    decision: receipt.decision,
    approval: receipt.approval,
    chain_reference: receipt.chain_reference,
  };
  const payload = adapter.canonicalize(body);
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(receipt.public_key, "hex"),
    format: "der",
    type: "spki",
  });

  return crypto.verify(
    null,
    Buffer.from(payload, "utf8"),
    publicKey,
    Buffer.from(receipt.signature, "hex")
  );
}

function testBuildsSignedDraftOnlyReceipt() {
  const result = demo.buildSignedDraftOnlyReceipt({
    previousReceiptHash: null,
    musUnit: makeEphemeralMusUnit(),
  });

  assert.strictEqual(result.crossingPacket.crossing_type, "signal_to_draft_output");
  assert.strictEqual(result.receipt.decision, "ALLOW");
  assert.strictEqual(result.receipt.validation.checks.intent_match, true);
  assert.strictEqual(result.receipt.validation.checks.scope_valid, true);
  assert.strictEqual(result.receipt.validation.checks.execution_path_valid, true);
  assert.ok(result.receipt.receipt_hash);
  assert.ok(result.receipt.signature);
  assert.strictEqual(verifySignature(result.receipt), true);
  assert.strictEqual(result.sourcepointReturn.return_status, "returned_to_sourcepoint");
  assert.strictEqual(result.sourcepointReturn.signature_status, "trusted_key_present");
}

testBuildsSignedDraftOnlyReceipt();

console.log("SourceBoard to real receipt demo test passed");
