/**
 * generate_receipt.js
 *
 * Generates receipts under the RIO Receipt Protocol
 * using the Rasmussen Receipt Construction method.
 *
 * Produces:
 *   examples/valid_receipt.json   (ALLOW case)
 *   examples/denied_receipt.json  (BLOCK case)
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// --- Key generation (Ed25519) ---

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

const pubKeyDer = publicKey.export({ type: "spki", format: "der" });
const pubKeyHex = pubKeyDer.toString("hex");

// --- Helpers ---

function sha256(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function canonicalize(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function sign(payload, privKey) {
  return crypto.sign(null, Buffer.from(payload, "utf8"), privKey).toString("hex");
}

function makeId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

// --- Execution Validation Layer ---

function validate(intent, executionInput) {
  const intentHash = sha256(canonicalize(intent));
  const executionHash = sha256(canonicalize(executionInput));

  const checks = {
    intent_match: intentHash === executionHash,
    context_match: true,
    scope_valid: true,
    execution_path_valid: true,
  };

  const allPass = Object.values(checks).every(Boolean);

  return {
    decision: allPass ? "ALLOW" : "BLOCK",
    checks,
    policy_version: "1.0.0",
  };
}

// --- Rasmussen Receipt Construction ---

function constructReceipt(intent, executionInput, approval, validation, previousReceiptHash) {
  const intentHash = sha256(canonicalize(intent));
  const executionHash = sha256(canonicalize(executionInput));

  const receiptBody = {
    receipt_id: makeId(),
    timestamp: now(),
    intent_hash: intentHash,
    execution_hash: executionHash,
    validation: {
      decision: validation.decision,
      checks: validation.checks,
      policy_version: validation.policy_version,
    },
    decision: validation.decision,
    approval: {
      approval_id: approval.approval_id,
      intent_hash: approval.intent_hash,
      authorizer: approval.authorizer,
      nonce: approval.nonce,
    },
    chain_reference: {
      previous_receipt_hash: previousReceiptHash,
    },
  };

  const payload = canonicalize(receiptBody);
  const receiptHash = sha256(payload);
  const signature = sign(payload, privateKey);

  return {
    ...receiptBody,
    receipt_hash: receiptHash,
    signature: signature,
    signature_algorithm: "Ed25519",
    public_key: pubKeyHex,
  };
}

// --- Build cases ---

// Case 1: Valid (ALLOW)
const validIntent = {
  action: "send_email",
  target: "user@example.com",
  parameters: { subject: "Hello", body: "Test message" },
};

const validApproval = {
  approval_id: makeId(),
  intent_hash: sha256(canonicalize(validIntent)),
  authorizer: "human:brian",
  nonce: crypto.randomUUID(),
  ttl: 300,
  scope: "send_email",
};

const validExecution = { ...validIntent }; // exact match
const validValidation = validate(validIntent, validExecution);
const validReceipt = constructReceipt(validIntent, validExecution, validApproval, validValidation, null);

// Case 2: Denied (BLOCK — drift case)
const deniedIntent = {
  action: "send_email",
  target: "user@example.com",
  parameters: { subject: "Hello", body: "Test message" },
};

const deniedApproval = {
  approval_id: makeId(),
  intent_hash: sha256(canonicalize(deniedIntent)),
  authorizer: "human:brian",
  nonce: crypto.randomUUID(),
  ttl: 300,
  scope: "send_email",
};

// Execution drifts from intent
const deniedExecution = {
  action: "send_email",
  target: "attacker@evil.com",
  parameters: { subject: "Hello", body: "Hijacked message" },
};

const deniedValidation = validate(deniedIntent, deniedExecution);
const deniedReceipt = constructReceipt(deniedIntent, deniedExecution, deniedApproval, deniedValidation, validReceipt.receipt_hash);

// --- Write output ---

const examplesDir = path.join(__dirname, "examples");
if (!fs.existsSync(examplesDir)) fs.mkdirSync(examplesDir, { recursive: true });

fs.writeFileSync(
  path.join(examplesDir, "valid_receipt.json"),
  JSON.stringify(validReceipt, null, 2) + "\n"
);

fs.writeFileSync(
  path.join(examplesDir, "denied_receipt.json"),
  JSON.stringify(deniedReceipt, null, 2) + "\n"
);

console.log("=== VALID CASE ===");
console.log("Decision:", validReceipt.decision);
console.log("Validation checks:", JSON.stringify(validReceipt.validation.checks));
console.log("Receipt hash:", validReceipt.receipt_hash);
console.log("Chain ref:", validReceipt.chain_reference.previous_receipt_hash);
console.log("");

console.log("=== DENIED CASE (drift) ===");
console.log("Decision:", deniedReceipt.decision);
console.log("Validation checks:", JSON.stringify(deniedReceipt.validation.checks));
console.log("Receipt hash:", deniedReceipt.receipt_hash);
console.log("Chain ref:", deniedReceipt.chain_reference.previous_receipt_hash);
console.log("");

console.log("Examples written to examples/valid_receipt.json and examples/denied_receipt.json");
