/**
 * test_tamper.js
 *
 * Demonstrates enforcement under the RIO Receipt Protocol.
 *
 * 5 test cases:
 *   1. Valid receipt → PASS
 *   2. Drift (execution differs from intent) → BLOCK
 *   3. Tamper (receipt modified after signing) → FAIL
 *   4. Forged receipt (untrusted key) → FAIL
 *   5. Replay (reused nonce) → BLOCK
 *
 * No external dependencies.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// --- Paths ---

const TRUSTED_KEYS_PATH = path.join(__dirname, "trust", "trusted_keys.json");
const NONCE_STORE_PATH = path.join(__dirname, "runtime", "verified_nonces.json");

// --- Helpers ---

function sha256(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj).sort();

  return '{' + sortedKeys.map(key => {
    return JSON.stringify(key) + ':' + canonicalize(obj[key]);
  }).join(',') + '}';
}

function sign(payload, privKey) {
  return crypto.sign(null, Buffer.from(payload, "utf8"), privKey).toString("hex");
}

// --- Load trusted key from signing_key.json ---

const SIGNING_KEY_PATH = path.join(__dirname, "trust", "signing_key.json");
let trustedPrivateKey, trustedPublicKey, trustedPubKeyHex;

if (fs.existsSync(SIGNING_KEY_PATH)) {
  const stored = JSON.parse(fs.readFileSync(SIGNING_KEY_PATH, "utf8"));
  trustedPrivateKey = crypto.createPrivateKey({
    key: Buffer.from(stored.private_key, "hex"),
    format: "der",
    type: "pkcs8",
  });
  trustedPublicKey = crypto.createPublicKey({
    key: Buffer.from(stored.public_key, "hex"),
    format: "der",
    type: "spki",
  });
  trustedPubKeyHex = stored.public_key;
} else {
  console.error("ERROR: trust/signing_key.json not found. Run generate_receipt.js first.");
  process.exit(1);
}

// --- Load trusted keys ---

function loadTrustedKeys() {
  if (fs.existsSync(TRUSTED_KEYS_PATH)) {
    return JSON.parse(fs.readFileSync(TRUSTED_KEYS_PATH, "utf8")).trusted_keys || [];
  }
  return [];
}

// --- Nonce helpers ---

function resetNonces() {
  fs.writeFileSync(NONCE_STORE_PATH, JSON.stringify({ used_nonces: [] }, null, 2) + "\n");
}

function loadNonces() {
  if (fs.existsSync(NONCE_STORE_PATH)) {
    return JSON.parse(fs.readFileSync(NONCE_STORE_PATH, "utf8"));
  }
  return { used_nonces: [] };
}

function saveNonces(store) {
  fs.writeFileSync(NONCE_STORE_PATH, JSON.stringify(store, null, 2) + "\n");
}

// --- Validation (real checks) ---

function validate(intent, executionInput, approval) {
  const intentHash = sha256(canonicalize(intent));
  const executionHash = sha256(canonicalize(executionInput));

  const intent_match = intentHash === executionHash;
  const context_match = approval.intent_hash === intentHash;
  const scope_valid = executionInput.action === approval.scope;
  const ALLOWED_ACTIONS = ["send_email", "create_document", "schedule_meeting"];
  const execution_path_valid = ALLOWED_ACTIONS.includes(executionInput.action);

  const checks = { intent_match, context_match, scope_valid, execution_path_valid };
  const allPass = Object.values(checks).every(Boolean);

  return {
    decision: allPass ? "ALLOW" : "BLOCK",
    checks,
    policy_version: "1.0.0",
  };
}

// --- Build receipt ---

function buildReceipt(intent, executionInput, approval, privKey, pubHex, prevHash) {
  const validation = validate(intent, executionInput, approval);
  const intentHash = sha256(canonicalize(intent));
  const executionHash = sha256(canonicalize(executionInput));

  const receiptBody = {
    receipt_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
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
    chain_reference: { previous_receipt_hash: prevHash },
  };

  const payload = canonicalize(receiptBody);
  const receiptHash = sha256(payload);
  const signature = sign(payload, privKey);

  return {
    ...receiptBody,
    receipt_hash: receiptHash,
    signature: signature,
    signature_algorithm: "Ed25519",
    public_key: pubHex,
  };
}

// --- Verification (full Phase 2) ---

function verify(receipt) {
  const body = {
    receipt_id: receipt.receipt_id,
    timestamp: receipt.timestamp,
    intent_hash: receipt.intent_hash,
    execution_hash: receipt.execution_hash,
    validation: receipt.validation,
    decision: receipt.decision,
    approval: receipt.approval,
    chain_reference: receipt.chain_reference,
  };

  const payload = canonicalize(body);
  const hashValid = sha256(payload) === receipt.receipt_hash;

  let sigValid = false;
  try {
    const pubKeyObj = crypto.createPublicKey({
      key: Buffer.from(receipt.public_key, "hex"),
      format: "der",
      type: "spki",
    });
    sigValid = crypto.verify(null, Buffer.from(payload, "utf8"), pubKeyObj, Buffer.from(receipt.signature, "hex"));
  } catch (e) {
    sigValid = false;
  }

  const trustedKeys = loadTrustedKeys();
  const keyTrusted = trustedKeys.includes(receipt.public_key);

  const nonceStore = loadNonces();
  const nonce = receipt.approval && receipt.approval.nonce;
  let nonceUnique = false;
  if (nonce && !nonceStore.used_nonces.includes(nonce)) {
    nonceUnique = true;
    nonceStore.used_nonces.push(nonce);
    saveNonces(nonceStore);
  }

  return {
    receipt_hash_valid: hashValid,
    signature_valid: sigValid,
    key_trusted: keyTrusted,
    nonce_unique: nonceUnique,
    overall: hashValid && sigValid && keyTrusted && nonceUnique ? "PASS" : "FAIL",
  };
}

// ============================================================
// TESTS
// ============================================================

let allPass = true;

// Reset nonce store for clean test run
resetNonces();

// --- TEST 1: VALID CASE ---

console.log("=== TEST 1: VALID CASE ===");

const validIntent = {
  action: "send_email",
  target: "user@example.com",
  parameters: { subject: "Hello", body: "Test message" },
};

const validNonce = crypto.randomUUID();
const validApproval = {
  approval_id: crypto.randomUUID(),
  intent_hash: sha256(canonicalize(validIntent)),
  authorizer: "human:brian",
  nonce: validNonce,
  scope: "send_email",
};

const validReceipt = buildReceipt(validIntent, validIntent, validApproval, trustedPrivateKey, trustedPubKeyHex, null);

console.log("Decision:", validReceipt.decision);
const r1 = verify(validReceipt);
console.log("receipt_hash_valid:", r1.receipt_hash_valid);
console.log("signature_valid:", r1.signature_valid);
console.log("key_trusted:", r1.key_trusted);
console.log("nonce_unique:", r1.nonce_unique);
console.log("RESULT:", r1.overall);
if (validReceipt.decision !== "ALLOW" || r1.overall !== "PASS") allPass = false;
console.log("");

// --- TEST 2: DRIFT CASE ---

console.log("=== TEST 2: DRIFT CASE (execution differs from intent) ===");

const driftIntent = {
  action: "send_email",
  target: "user@example.com",
  parameters: { subject: "Hello", body: "Test message" },
};

const driftExecution = {
  action: "send_email",
  target: "attacker@evil.com",
  parameters: { subject: "Hello", body: "Hijacked" },
};

const driftNonce = crypto.randomUUID();
const driftApproval = {
  approval_id: crypto.randomUUID(),
  intent_hash: sha256(canonicalize(driftIntent)),
  authorizer: "human:brian",
  nonce: driftNonce,
  scope: "send_email",
};

const driftReceipt = buildReceipt(driftIntent, driftExecution, driftApproval, trustedPrivateKey, trustedPubKeyHex, validReceipt.receipt_hash);

console.log("Decision:", driftReceipt.decision);
console.log("intent_match:", driftReceipt.validation.checks.intent_match);
console.log("RESULT:", driftReceipt.decision === "BLOCK" ? "BLOCKED (correct)" : "ERROR");
if (driftReceipt.decision !== "BLOCK") allPass = false;
console.log("");

// --- TEST 3: TAMPER CASE ---

console.log("=== TEST 3: TAMPER CASE (receipt modified after signing) ===");

// Reset nonces so the tamper test nonce is fresh
const tamperNonce = crypto.randomUUID();
const tamperApproval = {
  approval_id: crypto.randomUUID(),
  intent_hash: sha256(canonicalize(validIntent)),
  authorizer: "human:brian",
  nonce: tamperNonce,
  scope: "send_email",
};

const tamperReceipt = buildReceipt(validIntent, validIntent, tamperApproval, trustedPrivateKey, trustedPubKeyHex, null);

// Tamper with the receipt
const tampered = JSON.parse(JSON.stringify(tamperReceipt));
tampered.intent_hash = sha256("tampered_intent");
console.log("Tampered intent_hash to:", tampered.intent_hash);

const r3 = verify(tampered);
console.log("receipt_hash_valid:", r3.receipt_hash_valid);
console.log("signature_valid:", r3.signature_valid);
console.log("RESULT:", r3.overall);
if (r3.overall !== "FAIL") allPass = false;
console.log("");

// --- TEST 4: FORGED RECEIPT (untrusted key) ---

console.log("=== TEST 4: FORGED RECEIPT (untrusted key) ===");

// Generate a new keypair (not in trusted_keys.json)
const forgedPair = crypto.generateKeyPairSync("ed25519");
const forgedPubHex = forgedPair.publicKey.export({ type: "spki", format: "der" }).toString("hex");

const forgedNonce = crypto.randomUUID();
const forgedApproval = {
  approval_id: crypto.randomUUID(),
  intent_hash: sha256(canonicalize(validIntent)),
  authorizer: "human:brian",
  nonce: forgedNonce,
  scope: "send_email",
};

const forgedReceipt = buildReceipt(validIntent, validIntent, forgedApproval, forgedPair.privateKey, forgedPubHex, null);

console.log("Forged key:", forgedPubHex.substring(0, 16) + "...");
console.log("Trusted key:", trustedPubKeyHex.substring(0, 16) + "...");
console.log("Keys match:", forgedPubHex === trustedPubKeyHex);

const r4 = verify(forgedReceipt);
console.log("receipt_hash_valid:", r4.receipt_hash_valid);
console.log("signature_valid:", r4.signature_valid);
console.log("key_trusted:", r4.key_trusted);
console.log("RESULT:", r4.overall);
if (r4.overall !== "FAIL" || r4.key_trusted !== false) allPass = false;
console.log("");

// --- TEST 5: REPLAY CASE (reused nonce) ---

console.log("=== TEST 5: REPLAY CASE (reused nonce) ===");

// Build a receipt with the same nonce as test 1 (already recorded)
const replayApproval = {
  approval_id: crypto.randomUUID(),
  intent_hash: sha256(canonicalize(validIntent)),
  authorizer: "human:brian",
  nonce: validNonce, // REUSE nonce from test 1
  scope: "send_email",
};

const replayReceipt = buildReceipt(validIntent, validIntent, replayApproval, trustedPrivateKey, trustedPubKeyHex, null);

console.log("Reused nonce:", validNonce);
const r5 = verify(replayReceipt);
console.log("receipt_hash_valid:", r5.receipt_hash_valid);
console.log("signature_valid:", r5.signature_valid);
console.log("key_trusted:", r5.key_trusted);
console.log("nonce_unique:", r5.nonce_unique);
console.log("RESULT:", r5.overall);
if (r5.overall !== "FAIL" || r5.nonce_unique !== false) allPass = false;
console.log("");

// --- TEST 6: NESTED FIELD TAMPER (Phase 3 — canonicalization coverage) ---

console.log("=== TEST 6: NESTED FIELD TAMPER (parameters.body changed) ===");

const nestedNonce = crypto.randomUUID();
const nestedApproval = {
  approval_id: crypto.randomUUID(),
  intent_hash: sha256(canonicalize(validIntent)),
  authorizer: "human:brian",
  nonce: nestedNonce,
  scope: "send_email",
};

const nestedReceipt = buildReceipt(validIntent, validIntent, nestedApproval, trustedPrivateKey, trustedPubKeyHex, null);

// Tamper with a NESTED field (parameters.body) — must invalidate hash + signature
const nestedTampered = JSON.parse(JSON.stringify(nestedReceipt));
// Recompute execution_hash with different parameters to simulate what the old bug allowed
const tamperedExecution = {
  action: "send_email",
  target: "user@example.com",
  parameters: { subject: "Hello", body: "HIJACKED MESSAGE" },
};
nestedTampered.execution_hash = sha256(canonicalize(tamperedExecution));

console.log("Original execution_hash:", nestedReceipt.execution_hash);
console.log("Tampered execution_hash:", nestedTampered.execution_hash);
console.log("Hashes differ:", nestedReceipt.execution_hash !== nestedTampered.execution_hash);

const r6 = verify(nestedTampered);
console.log("receipt_hash_valid:", r6.receipt_hash_valid);
console.log("signature_valid:", r6.signature_valid);
console.log("RESULT:", r6.overall);
if (r6.overall !== "FAIL" || r6.receipt_hash_valid !== false) allPass = false;
console.log("");

// --- SUMMARY ---

console.log("=== SUMMARY ===");
console.log("Test 1 (Valid):        ", validReceipt.decision === "ALLOW" && r1.overall === "PASS" ? "PASS" : "FAIL");
console.log("Test 2 (Drift):        ", driftReceipt.decision === "BLOCK" ? "BLOCKED" : "FAIL");
console.log("Test 3 (Tamper):       ", r3.overall === "FAIL" ? "DETECTED" : "FAIL");
console.log("Test 4 (Forged):       ", r4.overall === "FAIL" && !r4.key_trusted ? "REJECTED" : "FAIL");
console.log("Test 5 (Replay):       ", r5.overall === "FAIL" && !r5.nonce_unique ? "BLOCKED" : "FAIL");
console.log("Test 6 (Nested tamper):", r6.overall === "FAIL" && !r6.receipt_hash_valid ? "DETECTED" : "FAIL");
console.log("");
console.log("ALL TESTS:", allPass ? "PASS" : "FAIL");

process.exit(allPass ? 0 : 1);
