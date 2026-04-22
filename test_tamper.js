/**
 * test_tamper.js
 *
 * Demonstrates tamper detection under the RIO Receipt Protocol.
 *
 * 1. Generates a valid receipt
 * 2. Verifies it (PASS)
 * 3. Tampers with the receipt (modifies execution target)
 * 4. Verifies again (FAIL)
 *
 * No external dependencies.
 */

const crypto = require("crypto");

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

// --- Key generation ---

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const pubKeyDer = publicKey.export({ type: "spki", format: "der" });
const pubKeyHex = pubKeyDer.toString("hex");

// --- Build a valid receipt ---

const intent = {
  action: "send_email",
  target: "user@example.com",
  parameters: { subject: "Hello", body: "Test message" },
};

const intentHash = sha256(canonicalize(intent));
const executionHash = sha256(canonicalize(intent)); // exact match

const approval = {
  approval_id: crypto.randomUUID(),
  intent_hash: intentHash,
  authorizer: "human:brian",
  nonce: crypto.randomUUID(),
};

const validation = {
  decision: "ALLOW",
  checks: {
    intent_match: true,
    context_match: true,
    scope_valid: true,
    execution_path_valid: true,
  },
  policy_version: "1.0.0",
};

const receiptBody = {
  receipt_id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  intent_hash: intentHash,
  execution_hash: executionHash,
  validation: validation,
  decision: "ALLOW",
  approval: approval,
  chain_reference: { previous_receipt_hash: null },
};

const payload = canonicalize(receiptBody);
const receiptHash = sha256(payload);
const signature = sign(payload, privateKey);

const receipt = {
  ...receiptBody,
  receipt_hash: receiptHash,
  signature: signature,
  signature_algorithm: "Ed25519",
  public_key: pubKeyHex,
};

// --- Verification function ---

function verify(r) {
  const body = {
    receipt_id: r.receipt_id,
    timestamp: r.timestamp,
    intent_hash: r.intent_hash,
    execution_hash: r.execution_hash,
    validation: r.validation,
    decision: r.decision,
    approval: r.approval,
    chain_reference: r.chain_reference,
  };

  const p = canonicalize(body);
  const hashValid = sha256(p) === r.receipt_hash;

  let sigValid = false;
  try {
    const pubKeyObj = crypto.createPublicKey({
      key: Buffer.from(r.public_key, "hex"),
      format: "der",
      type: "spki",
    });
    sigValid = crypto.verify(null, Buffer.from(p, "utf8"), pubKeyObj, Buffer.from(r.signature, "hex"));
  } catch (e) {
    sigValid = false;
  }

  return {
    receipt_hash_valid: hashValid,
    signature_valid: sigValid,
    overall: hashValid && sigValid ? "PASS" : "FAIL",
  };
}

// --- Test 1: Verify original (should PASS) ---

console.log("=== TEST 1: VERIFY ORIGINAL RECEIPT ===");
const result1 = verify(receipt);
console.log("receipt_hash_valid:", result1.receipt_hash_valid);
console.log("signature_valid:", result1.signature_valid);
console.log("RESULT:", result1.overall);
console.log("");

// --- Test 2: Tamper and verify (should FAIL) ---

console.log("=== TEST 2: TAMPER WITH RECEIPT ===");
const tampered = JSON.parse(JSON.stringify(receipt));
tampered.intent_hash = sha256("tampered_intent");
console.log("Tampered intent_hash to:", tampered.intent_hash);
console.log("");

const result2 = verify(tampered);
console.log("receipt_hash_valid:", result2.receipt_hash_valid);
console.log("signature_valid:", result2.signature_valid);
console.log("RESULT:", result2.overall);
console.log("");

// --- Summary ---

const pass = result1.overall === "PASS" && result2.overall === "FAIL";
console.log("=== SUMMARY ===");
console.log("Original receipt verification:", result1.overall);
console.log("Tampered receipt verification:", result2.overall);
console.log("TAMPER DETECTION:", pass ? "WORKING" : "BROKEN");

process.exit(pass ? 0 : 1);
