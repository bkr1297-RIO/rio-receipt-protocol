/**
 * verify_receipt.js
 *
 * Verifies a receipt under the RIO Receipt Protocol.
 *
 * Checks:
 *   1. Recomputes receipt_hash from receipt body
 *   2. Validates Ed25519 signature
 *   3. Confirms validation block is present and complete
 *   4. Reports PASS or FAIL
 *
 * Usage: node verify_receipt.js <path_to_receipt.json>
 */

const crypto = require("crypto");
const fs = require("fs");

// --- Helpers ---

function sha256(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function canonicalize(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

// --- Verification ---

function verifyReceipt(receipt) {
  const results = {
    receipt_hash_valid: false,
    signature_valid: false,
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

  // 3. Validation block present
  results.validation_present = !!(
    receipt.validation &&
    receipt.validation.decision &&
    receipt.validation.checks &&
    receipt.validation.policy_version
  );

  // 4. Validation complete (all required checks present)
  if (receipt.validation && receipt.validation.checks) {
    const requiredChecks = ["intent_match", "context_match", "scope_valid", "execution_path_valid"];
    results.validation_complete = requiredChecks.every(
      (c) => typeof receipt.validation.checks[c] === "boolean"
    );
  }

  // Overall
  results.overall =
    results.receipt_hash_valid &&
    results.signature_valid &&
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
console.log("validation_present:", results.validation_present);
console.log("validation_complete:", results.validation_complete);
console.log("");
console.log("OVERALL:", results.overall);

process.exit(results.overall === "PASS" ? 0 : 1);
