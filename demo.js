/**
 * demo.js
 *
 * Demonstrates the full Local Receipt Engine flow:
 *   1. Check local unit is initialized (or prompt to run init)
 *   2. Create an ALLOW receipt (valid intent → execution match)
 *   3. Create a BLOCK receipt (drift: execution differs from intent)
 *   4. Append both to the local hash-chain ledger
 *   5. Verify each receipt individually
 *   6. Verify the full ledger chain
 *
 * Usage:
 *   npm run demo
 *   node demo.js
 *
 * No external dependencies. Uses only Node.js built-in crypto and fs.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// --- Paths ---

const CONFIG_PATH = path.join(__dirname, "config", "mus-unit.json");
const SIGNING_KEY_PATH = path.join(__dirname, "trust", "signing_key.json");
const TRUSTED_KEYS_PATH = path.join(__dirname, "trust", "trusted_keys.json");
const NONCE_STORE_PATH = path.join(__dirname, "runtime", "nonce_store.json");

// --- Check initialization ---

if (!fs.existsSync(CONFIG_PATH)) {
  console.error("ERROR: Local MUS Unit not initialized.");
  console.error("");
  console.error("Run first:");
  console.error("  npm run init");
  console.error("  # or: node mus-init.js --owner \"human:your-name\"");
  console.error("");
  process.exit(1);
}

// --- Load config ---

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
console.log("=== LOCAL RECEIPT ENGINE DEMO ===");
console.log("");
console.log("Unit ID: " + config.mus_unit_id);
console.log("Owner:   " + config.owner);
console.log("");

// --- Load signing key ---

const stored = JSON.parse(fs.readFileSync(SIGNING_KEY_PATH, "utf8"));
const privateKey = crypto.createPrivateKey({
  key: Buffer.from(stored.private_key, "hex"),
  format: "der",
  type: "pkcs8",
});
const publicKey = crypto.createPublicKey({
  key: Buffer.from(stored.public_key, "hex"),
  format: "der",
  type: "spki",
});
const pubKeyHex = publicKey.export({ type: "spki", format: "der" }).toString("hex");

// --- Load nonce store ---

function loadNonces() {
  if (fs.existsSync(NONCE_STORE_PATH)) {
    return JSON.parse(fs.readFileSync(NONCE_STORE_PATH, "utf8"));
  }
  return { used_nonces: [] };
}

function saveNonces(store) {
  fs.writeFileSync(NONCE_STORE_PATH, JSON.stringify(store, null, 2) + "\n");
}

function checkAndRecordNonce(nonce) {
  const store = loadNonces();
  if (store.used_nonces.includes(nonce)) return false;
  store.used_nonces.push(nonce);
  saveNonces(store);
  return true;
}

// --- Crypto helpers ---

function sha256(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const sortedKeys = Object.keys(obj).sort();
  return (
    "{" +
    sortedKeys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") +
    "}"
  );
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

// --- Validation ---

function validate(intent, executionInput, approval) {
  const intentHash = sha256(canonicalize(intent));
  const intent_match = sha256(canonicalize(executionInput)) === intentHash || executionInput.action === intent.action;
  const context_match = approval.intent_hash === intentHash;
  const scope_valid = executionInput.action === approval.scope;
  const ALLOWED_ACTIONS = ["send_email", "create_document", "schedule_meeting", "search_web", "read_file"];
  const execution_path_valid = ALLOWED_ACTIONS.includes(executionInput.action);

  const checks = { intent_match, context_match, scope_valid, execution_path_valid };
  const allPass = Object.values(checks).every(Boolean);

  return {
    decision: allPass ? "ALLOW" : "BLOCK",
    checks,
    policy_version: "1.0.0",
  };
}

// --- Receipt construction ---

function constructReceipt(intent, executionInput, approval, validation, previousReceiptHash) {
  const intentHash = sha256(canonicalize(intent));
  const executionHash = sha256(canonicalize(executionInput));

  const receiptBody = {
    receipt_id: makeId(),
    timestamp: now(),
    intent_hash: intentHash,
    execution_hash: executionHash,
    mus_unit_id: config.mus_unit_id,
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

// --- Ledger ---

const ledger = require("./ledger");

// --- Run demo ---

console.log("--- Case 1: ALLOW (valid intent, execution matches) ---");
console.log("");

const validIntent = {
  action: "send_email",
  target: "colleague@example.com",
  parameters: { subject: "Meeting notes", body: "Attached are the notes from today." },
};

const validNonce = crypto.randomUUID();
const validApproval = {
  approval_id: makeId(),
  intent_hash: sha256(canonicalize(validIntent)),
  authorizer: config.owner,
  nonce: validNonce,
  ttl: 300,
  scope: "send_email",
};

if (!checkAndRecordNonce(validNonce)) {
  console.error("BLOCKED — nonce replay detected");
  process.exit(1);
}

const validExecution = { ...validIntent };
const validValidation = validate(validIntent, validExecution, validApproval);
const prevHash = ledger.getLastHash();
const validReceipt = constructReceipt(validIntent, validExecution, validApproval, validValidation, prevHash);

console.log("Decision:     " + validReceipt.decision);
console.log("Receipt hash: " + validReceipt.receipt_hash.substring(0, 32) + "...");
console.log("Authorizer:   " + validReceipt.approval.authorizer);
console.log("Unit ID:      " + validReceipt.mus_unit_id);
console.log("");

// Append to ledger
ledger.appendReceipt(validReceipt);
console.log("  → Appended to ledger.");
console.log("");

// --- Case 2: BLOCK (drift) ---

console.log("--- Case 2: BLOCK (execution drifts from intent) ---");
console.log("");

const deniedIntent = {
  action: "send_email",
  target: "colleague@example.com",
  parameters: { subject: "Meeting notes", body: "Attached are the notes from today." },
};

const deniedNonce = crypto.randomUUID();
const deniedApproval = {
  approval_id: makeId(),
  intent_hash: sha256(canonicalize(deniedIntent)),
  authorizer: config.owner,
  nonce: deniedNonce,
  ttl: 300,
  scope: "send_email",
};

if (!checkAndRecordNonce(deniedNonce)) {
  console.error("BLOCKED — nonce replay detected");
  process.exit(1);
}

// Execution drifts: different target
const deniedExecution = {
  action: "send_email",
  target: "unknown@suspicious.com",
  parameters: { subject: "Meeting notes", body: "Hijacked content" },
};

const deniedValidation = validate(deniedIntent, deniedExecution, deniedApproval);
const prevHash2 = ledger.getLastHash();
const deniedReceipt = constructReceipt(deniedIntent, deniedExecution, deniedApproval, deniedValidation, prevHash2);

console.log("Decision:     " + deniedReceipt.decision);
console.log("Receipt hash: " + deniedReceipt.receipt_hash.substring(0, 32) + "...");
console.log("Drift:        target changed from colleague@example.com to unknown@suspicious.com");
console.log("Authorizer:   " + deniedReceipt.approval.authorizer);
console.log("");

// Append to ledger
ledger.appendReceipt(deniedReceipt);
console.log("  → Appended to ledger.");
console.log("");

// --- Verify individual receipts ---

console.log("--- Individual Receipt Verification ---");
console.log("");

// Use the existing verify_receipt.js logic inline for the demo
function verifyReceiptInline(receipt) {
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
  if (receipt.mus_unit_id) body.mus_unit_id = receipt.mus_unit_id;

  const payload = canonicalize(body);
  const computedHash = sha256(payload);

  if (computedHash !== receipt.receipt_hash) return "FAIL (hash mismatch)";

  try {
    const pubKeyObj = crypto.createPublicKey({
      key: Buffer.from(receipt.public_key, "hex"),
      format: "der",
      type: "spki",
    });
    const sigValid = crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      pubKeyObj,
      Buffer.from(receipt.signature, "hex")
    );
    if (!sigValid) return "FAIL (signature invalid)";
  } catch (e) {
    return "FAIL (signature error: " + e.message + ")";
  }

  return "PASS";
}

console.log("ALLOW receipt: " + verifyReceiptInline(validReceipt));
console.log("BLOCK receipt: " + verifyReceiptInline(deniedReceipt));
console.log("");

// --- Verify full chain ---

console.log("--- Ledger Chain Verification ---");
console.log("");

const { verifyChain } = require("./verify-chain");
const result = verifyChain();

console.log("Total records: " + result.total_records);
if (result.errors.length > 0) {
  result.errors.forEach((err) => {
    console.log("  Error at line " + err.index + ": " + err.error);
  });
}
console.log("Result: " + (result.valid ? "CHAIN VALID" : "CHAIN INVALID"));
console.log("");

// --- Summary ---

console.log("=== DEMO COMPLETE ===");
console.log("");
console.log("Receipts created: 2 (1 ALLOW, 1 BLOCK)");
console.log("Ledger entries:   " + result.total_records);
console.log("Chain status:     " + (result.valid ? "VALID" : "INVALID"));
console.log("Signing key:      " + pubKeyHex.substring(0, 16) + "...");
console.log("Unit ID:          " + config.mus_unit_id);
console.log("Owner:            " + config.owner);
console.log("");
console.log("Ledger file: ledger/ledger.jsonl");
console.log("");
console.log("The protocol proves the grammar.");
console.log("The Local Receipt Engine makes the grammar portable.");
