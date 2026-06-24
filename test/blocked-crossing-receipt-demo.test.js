"use strict";

const assert = require("assert");
const crypto = require("crypto");
const blockedDemo = require("../demo_blocked_crossing_receipt");
const adapter = require("../sim-mus-adapter");

function makeEphemeralMusUnit() {
  const pair = crypto.generateKeyPairSync("ed25519");
  const privateKeyDer = pair.privateKey.export({ type: "pkcs8", format: "der" });
  const publicKeyDer = pair.publicKey.export({ type: "spki", format: "der" });
  const publicKeyHex = publicKeyDer.toString("hex");

  return {
    config: {
      mus_unit_id: "mus-blocked-test-unit",
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

function assertBlockedReceipt(caseName, expectedCheck) {
  const result = blockedDemo.buildSignedBlockedReceipt({
    caseName,
    musUnit: makeEphemeralMusUnit(),
  });

  assert.strictEqual(result.receipt.decision, "BLOCK");
  assert.strictEqual(result.receipt.validation.decision, "BLOCK");
  assert.strictEqual(result.receipt.validation.checks.blocked_crossing_returned, true);
  assert.strictEqual(result.sourcepointReturn.decision, "BLOCK");
  assert.strictEqual(result.sourcepointReturn.return_status, "returned_to_sourcepoint");
  assert.strictEqual(result.sourcepointReturn.signature_status, "trusted_key_present");
  assert.ok(result.receipt.receipt_hash);
  assert.ok(result.receipt.signature);
  assert.strictEqual(verifySignature(result.receipt), true);

  if (expectedCheck) {
    assert.strictEqual(
      result.receipt.validation.checks[expectedCheck.name],
      expectedCheck.value
    );
  }
}

assertBlockedReceipt("missing_accountability", {
  name: "accountability_path_valid",
  value: false,
});

assertBlockedReceipt("c3_machine_execution_block", {
  name: "five_core_valid",
  value: false,
});

assertBlockedReceipt("draft_memory_mutation", {
  name: "execution_path_valid",
  value: false,
});

console.log("Blocked crossing receipt demo tests passed");
