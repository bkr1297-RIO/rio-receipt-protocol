/**
 * generate_receipt.js
 *
 * Generates receipts under the RIO Receipt Protocol
 * using the Rasmussen Receipt Construction method.
 *
 * Phase 2 enforcement:
 *   - Persistent signing identity (trust/signing_key.json)
 *   - Trust anchor alignment (trust/trusted_keys.json)
 *   - Nonce enforcement (runtime/nonce_store.json)
 *   - Deterministic validation (no mocked checks)
 *
 * Produces:
 *   examples/valid_receipt.json   (ALLOW case)
 *   examples/denied_receipt.json  (BLOCK case — drift)
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// --- Paths ---

const SIGNING_KEY_PATH = path.join(__dirname, "trust", "signing_key.json");
const TRUSTED_KEYS_PATH = path.join(__dirname, "trust", "trusted_keys.json");
const NONCE_STORE_PATH = path.join(__dirname, "runtime", "nonce_store.json");

// --- Persistent signing key (1A) ---

let privateKey, publicKey;

if (fs.existsSync(SIGNING_KEY_PATH)) {
  // Load existing keypair
  const stored = JSON.parse(fs.readFileSync(SIGNING_KEY_PATH, "utf8"));
  privateKey = crypto.createPrivateKey({
    key: Buffer.from(stored.private_key, "hex"),
    format: "der",
    type: "pkcs8",
  });
  publicKey = crypto.createPublicKey({
    key: Buffer.from(stored.public_key, "hex"),
    format: "der",
    type: "spki",
  });
} else {
  // Generate new keypair and persist
  const pair = crypto.generateKeyPairSync("ed25519");
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;

  const privKeyDer = privateKey.export({ type: "pkcs8", format: "der" });
  const pubKeyDer = publicKey.export({ type: "spki", format: "der" });

  fs.mkdirSync(path.dirname(SIGNING_KEY_PATH), { recursive: true });
  fs.writeFileSync(
    SIGNING_KEY_PATH,
    JSON.stringify(
      {
        private_key: privKeyDer.toString("hex"),
        public_key: pubKeyDer.toString("hex"),
      },
      null,
      2
    ) + "\n"
  );
}

const pubKeyDer = publicKey.export({ type: "spki", format: "der" });
const pubKeyHex = pubKeyDer.toString("hex");

// --- Trust anchor alignment (1) ---

fs.mkdirSync(path.dirname(TRUSTED_KEYS_PATH), { recursive: true });
fs.writeFileSync(
  TRUSTED_KEYS_PATH,
  JSON.stringify({ trusted_keys: [pubKeyHex] }, null, 2) + "\n"
);

// --- Nonce store (2) ---

function loadNonces() {
  if (fs.existsSync(NONCE_STORE_PATH)) {
    return JSON.parse(fs.readFileSync(NONCE_STORE_PATH, "utf8"));
  }
  return { used_nonces: [] };
}

function saveNonces(store) {
  fs.mkdirSync(path.dirname(NONCE_STORE_PATH), { recursive: true });
  fs.writeFileSync(NONCE_STORE_PATH, JSON.stringify(store, null, 2) + "\n");
}

function checkAndRecordNonce(nonce) {
  const store = loadNonces();
  if (store.used_nonces.includes(nonce)) {
    return false; // replay — BLOCK
  }
  store.used_nonces.push(nonce);
  saveNonces(store);
  return true;
}

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

// --- Execution Validation Layer (3 — real checks) ---

function validate(intent, executionInput, approval) {
  const intentHash = sha256(canonicalize(intent));
  const executionHash = sha256(canonicalize(executionInput));

  // intent_match: deep equality between approved intent and execution input
  const intent_match = intentHash === executionHash;

  // context_match: approval intent_hash matches the intent being executed
  const context_match = approval.intent_hash === intentHash;

  // scope_valid: execution action is within approved scope
  const scope_valid = executionInput.action === approval.scope;

  // execution_path_valid: execution uses an allowed action
  const ALLOWED_ACTIONS = ["send_email", "create_document", "schedule_meeting"];
  const execution_path_valid = ALLOWED_ACTIONS.includes(executionInput.action);

  const checks = {
    intent_match,
    context_match,
    scope_valid,
    execution_path_valid,
  };

  // Fail-closed: ANY check fails → BLOCK (4)
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

// --- Reset nonce store for clean demo run ---

saveNonces({ used_nonces: [] });

// --- Build cases ---

// Case 1: Valid (ALLOW)
const validIntent = {
  action: "send_email",
  target: "user@example.com",
  parameters: { subject: "Hello", body: "Test message" },
};

const validNonce = crypto.randomUUID();

const validApproval = {
  approval_id: makeId(),
  intent_hash: sha256(canonicalize(validIntent)),
  authorizer: "human:brian",
  nonce: validNonce,
  ttl: 300,
  scope: "send_email",
};

// Nonce check
if (!checkAndRecordNonce(validNonce)) {
  console.log("VALID CASE: BLOCKED — nonce replay detected");
  process.exit(1);
}

const validExecution = { ...validIntent }; // exact match
const validValidation = validate(validIntent, validExecution, validApproval);
const validReceipt = constructReceipt(validIntent, validExecution, validApproval, validValidation, null);

// Case 2: Denied (BLOCK — drift case)
const deniedIntent = {
  action: "send_email",
  target: "user@example.com",
  parameters: { subject: "Hello", body: "Test message" },
};

const deniedNonce = crypto.randomUUID();

const deniedApproval = {
  approval_id: makeId(),
  intent_hash: sha256(canonicalize(deniedIntent)),
  authorizer: "human:brian",
  nonce: deniedNonce,
  ttl: 300,
  scope: "send_email",
};

// Nonce check
if (!checkAndRecordNonce(deniedNonce)) {
  console.log("DENIED CASE: BLOCKED — nonce replay detected");
  process.exit(1);
}

// Execution drifts from intent
const deniedExecution = {
  action: "send_email",
  target: "attacker@evil.com",
  parameters: { subject: "Hello", body: "Hijacked message" },
};

const deniedValidation = validate(deniedIntent, deniedExecution, deniedApproval);
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

console.log("Signing key:", fs.existsSync(SIGNING_KEY_PATH) ? "persistent (loaded)" : "ERROR");
console.log("Trust anchor:", pubKeyHex.substring(0, 16) + "...");
console.log("Nonces recorded:", loadNonces().used_nonces.length);
console.log("");

console.log("Examples written to examples/valid_receipt.json and examples/denied_receipt.json");
