/**
 * verify_receipt.js
 *
 * Verifies a receipt under the RIO Receipt Protocol.
 *
 * Phase 2 checks:
 *   1. Recomputes receipt_hash from receipt body
 *   2. Validates Ed25519 signature
 *   3. Confirms public_key is in trusted_keys.json (trust anchor)
 *   4. Confirms nonce has not been previously verified (replay protection)
 *   5. Confirms validation block is present and complete
 *   6. Reports PASS or FAIL
 *
 * Usage: node verify_receipt.js <path_to_receipt.json>
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
  return JSON.stringify(obj, Object.keys(obj).sort());
}

// --- Trust anchor ---

function loadTrustedKeys() {
  if (fs.existsSync(TRUSTED_KEYS_PATH)) {
    return JSON.parse(fs.readFileSync(TRUSTED_KEYS_PATH, "utf8")).trusted_keys || [];
  }
  return [];
}

// --- Nonce store ---

function loadNonces() {
  if (fs.existsSync(NONCE_STORE_PATH)) {
    return JSON.parse(fs.readFileSync(NONCE_STORE_PATH, "utf8"));
  }
  return { used_nonces: [] };
}

function saveNonces(store) {
  fs.writeFileSync(NONCE_STORE_PATH, JSON.stringify(store, null, 2) + "\n");
}

// --- Verification ---

function verifyReceipt(receipt) {
  const results = {
    receipt_hash_valid: false,
    signature_valid: false,
    key_trusted: false,
    nonce_unique: false,
    validation_present: false,
    validation_complete: false,
    overall: "FAIL",
  };

  // 1. Recompute receipt_hash
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
  const computedHash = sha256(payload);
  results.receipt_hash_valid = computedHash === receipt.receipt_hash;

  // 2. Validate signature
  try {
    const pubKeyObj = crypto.createPublicKey({
      key: Buffer.from(receipt.public_key, "hex"),
      format: "der",
      type: "spki",
    });

    results.signature_valid = crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      pubKeyObj,
      Buffer.from(receipt.signature, "hex")
    );
  } catch (e) {
    results.signature_valid = false;
  }

  // 3. Trust anchor — public key must be in trusted_keys.json
  const trustedKeys = loadTrustedKeys();
  results.key_trusted = trustedKeys.includes(receipt.public_key);

  // 4. Nonce replay check
  const nonceStore = loadNonces();
  const receiptNonce = receipt.approval && receipt.approval.nonce;
  if (receiptNonce && !nonceStore.used_nonces.includes(receiptNonce)) {
    results.nonce_unique = true;
    // Record nonce as verified
    nonceStore.used_nonces.push(receiptNonce);
    saveNonces(nonceStore);
  } else if (!receiptNonce) {
    results.nonce_unique = false;
  } else {
    results.nonce_unique = false; // replay detected
  }

  // 5. Validation block present
  results.validation_present = !!(
    receipt.validation &&
    receipt.validation.decision &&
    receipt.validation.checks &&
    receipt.validation.policy_version
  );

  // 6. Validation complete (all required checks present)
  if (receipt.validation && receipt.validation.checks) {
    const requiredChecks = ["intent_match", "context_match", "scope_valid", "execution_path_valid"];
    results.validation_complete = requiredChecks.every(
      (c) => typeof receipt.validation.checks[c] === "boolean"
    );
  }

  // Overall — ALL must pass
  results.overall =
    results.receipt_hash_valid &&
    results.signature_valid &&
    results.key_trusted &&
    results.nonce_unique &&
    results.validation_present &&
    results.validation_complete
      ? "PASS"
      : "FAIL";

  return results;
}

// --- Main ---

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node verify_receipt.js <path_to_receipt.json>");
  process.exit(1);
}

const receipt = JSON.parse(fs.readFileSync(filePath, "utf8"));
const results = verifyReceipt(receipt);

console.log("=== VERIFICATION RESULTS ===");
console.log("File:", filePath);
console.log("Receipt ID:", receipt.receipt_id);
console.log("Decision:", receipt.decision);
console.log("");
console.log("receipt_hash_valid:", results.receipt_hash_valid);
console.log("signature_valid:", results.signature_valid);
console.log("key_trusted:", results.key_trusted);
console.log("nonce_unique:", results.nonce_unique);
console.log("validation_present:", results.validation_present);
console.log("validation_complete:", results.validation_complete);
console.log("");
console.log("OVERALL:", results.overall);

process.exit(results.overall === "PASS" ? 0 : 1);
