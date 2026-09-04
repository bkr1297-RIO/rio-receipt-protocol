const assert = require("assert");
const crypto = require("crypto");
const {
  buildSignedReceiptBody,
  canonicalize,
  sha256,
  validateExecution,
} = require("../receipt-core");

const intent = {
  action: "send_email",
  target: "approved@example.com",
  parameters: { subject: "Approved", body: "Approved body" },
};
const approval = {
  intent_hash: sha256(canonicalize(intent)),
  scope: "send_email",
};

const drift = {
  ...intent,
  target: "attacker@example.com",
};
const driftResult = validateExecution(intent, drift, approval, ["send_email"]);
assert.strictEqual(driftResult.decision, "BLOCK");
assert.strictEqual(driftResult.checks.intent_match, false);

const exactResult = validateExecution(intent, { ...intent }, approval, ["send_email"]);
assert.strictEqual(exactResult.decision, "ALLOW");

const receipt = {
  receipt_id: "receipt-regression",
  timestamp: "2026-08-30T00:00:00.000Z",
  intent_hash: approval.intent_hash,
  execution_hash: approval.intent_hash,
  mus_unit_id: "unit-regression",
  validation: exactResult,
  decision: exactResult.decision,
  approval: {
    approval_id: "approval-regression",
    intent_hash: approval.intent_hash,
    authorizer: "human:test",
    nonce: "nonce-regression",
  },
  chain_reference: { previous_receipt_hash: null },
};
const body = buildSignedReceiptBody(receipt);
assert.strictEqual(body.mus_unit_id, "unit-regression");

const pair = crypto.generateKeyPairSync("ed25519");
const payload = canonicalize(body);
const signature = crypto.sign(null, Buffer.from(payload, "utf8"), pair.privateKey);
assert.strictEqual(
  crypto.verify(null, Buffer.from(payload, "utf8"), pair.publicKey, signature),
  true
);

console.log("receipt core regressions: 5 assertions passed");
