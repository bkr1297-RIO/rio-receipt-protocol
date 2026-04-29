/**
 * verify-chain.js
 *
 * Verify the full local receipt chain (ledger/ledger.jsonl).
 *
 * Checks for each entry:
 *   1. Valid JSON structure
 *   2. receipt_hash present
 *   3. previous_receipt_hash links correctly to prior entry
 *   4. Receipt body hash recomputes correctly
 *   5. Ed25519 signature is valid
 *   6. Public key is in trusted_keys.json
 *
 * Detects:
 *   - Modified receipt (hash mismatch)
 *   - Broken signature
 *   - Deleted record / chain gap (previous_receipt_hash mismatch)
 *   - Reordered records (previous_receipt_hash mismatch)
 *   - Broken previous_receipt_hash link
 *   - Malformed JSON line
 *   - Untrusted public key
 *
 * Output:
 *   CHAIN VALID or CHAIN INVALID
 *   Total records checked
 *   Errors by line/index
 *
 * No external dependencies. Uses only Node.js built-in crypto and fs.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// --- Paths ---

const LEDGER_PATH = path.join(__dirname, "ledger", "ledger.jsonl");
const TRUSTED_KEYS_PATH = path.join(__dirname, "trust", "trusted_keys.json");

// --- Helpers ---

function sha256(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalize).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj).sort();

  return (
    "{" +
    sortedKeys
      .map((key) => {
        return JSON.stringify(key) + ":" + canonicalize(obj[key]);
      })
      .join(",") +
    "}"
  );
}

function loadTrustedKeys() {
  if (fs.existsSync(TRUSTED_KEYS_PATH)) {
    return (
      JSON.parse(fs.readFileSync(TRUSTED_KEYS_PATH, "utf8")).trusted_keys || []
    );
  }
  return [];
}

// --- Verification ---

function verifyChain() {
  const errors = [];

  // Check ledger exists
  if (!fs.existsSync(LEDGER_PATH)) {
    return {
      valid: false,
      total_records: 0,
      errors: [{ index: 0, error: "Ledger file not found: " + LEDGER_PATH }],
    };
  }

  const content = fs.readFileSync(LEDGER_PATH, "utf8").trim();
  if (!content) {
    return {
      valid: true,
      total_records: 0,
      errors: [],
      message: "Ledger is empty (no records to verify).",
    };
  }

  const lines = content.split("\n");
  const trustedKeys = loadTrustedKeys();
  let previousHash = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();

    if (!line) continue;

    // 1. Parse JSON
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (e) {
      errors.push({
        index: lineNum,
        error: `Malformed JSON: ${e.message}`,
      });
      // Cannot continue chain verification after malformed line
      break;
    }

    // 2. Check structure
    if (!entry.receipt_hash) {
      errors.push({ index: lineNum, error: "Missing receipt_hash" });
      continue;
    }

    if (!entry.receipt) {
      errors.push({ index: lineNum, error: "Missing receipt object" });
      continue;
    }

    const receipt = entry.receipt;

    // 3. Verify previous_receipt_hash chain link
    if (entry.previous_receipt_hash !== previousHash) {
      errors.push({
        index: lineNum,
        error: `Chain link broken: expected previous_receipt_hash "${previousHash}" but found "${entry.previous_receipt_hash}"`,
      });
    }

    // 4. Recompute receipt_hash
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

    // Include mus_unit_id if present
    if (receipt.mus_unit_id) {
      body.mus_unit_id = receipt.mus_unit_id;
    }

    const payload = canonicalize(body);
    const computedHash = sha256(payload);

    if (computedHash !== receipt.receipt_hash) {
      errors.push({
        index: lineNum,
        error: `Receipt hash mismatch: computed "${computedHash.substring(0, 16)}..." but stored "${receipt.receipt_hash.substring(0, 16)}..."`,
      });
    }

    // 5. Verify signature
    if (receipt.signature && receipt.public_key) {
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

        if (!sigValid) {
          errors.push({ index: lineNum, error: "Signature verification failed" });
        }
      } catch (e) {
        errors.push({
          index: lineNum,
          error: `Signature verification error: ${e.message}`,
        });
      }

      // 6. Check trusted key
      if (!trustedKeys.includes(receipt.public_key)) {
        errors.push({
          index: lineNum,
          error: `Untrusted public key: ${receipt.public_key.substring(0, 16)}...`,
        });
      }
    } else {
      errors.push({ index: lineNum, error: "Missing signature or public_key" });
    }

    // Update chain state
    previousHash = entry.receipt_hash;
  }

  const totalRecords = lines.filter((l) => l.trim()).length;

  return {
    valid: errors.length === 0,
    total_records: totalRecords,
    errors: errors,
  };
}

// --- Main ---

if (require.main === module) {
  console.log("=== LEDGER CHAIN VERIFICATION ===");
  console.log("");

  const result = verifyChain();

  console.log("Total records: " + result.total_records);
  console.log("");

  if (result.errors.length > 0) {
    console.log("Errors found:");
    result.errors.forEach((err) => {
      console.log(`  Line ${err.index}: ${err.error}`);
    });
    console.log("");
  }

  if (result.valid) {
    console.log("CHAIN VALID");
    if (result.message) console.log(result.message);
  } else {
    console.log("CHAIN INVALID");
  }

  process.exit(result.valid ? 0 : 1);
}

module.exports = { verifyChain };
