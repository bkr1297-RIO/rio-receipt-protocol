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
 *   7. receipt_id and approval.nonce are unique
 *   8. Optional expected head and record-count anchors match
 *
 * Detects:
 *   - Modified receipt (hash mismatch)
 *   - Broken signature
 *   - Deleted record / chain gap (previous_receipt_hash mismatch)
 *   - Reordered records (previous_receipt_hash mismatch)
 *   - Broken previous_receipt_hash link
 *   - Malformed JSON line
 *   - Untrusted public key
 *   - Clean-prefix truncation when expectedHeadHash/expectedRecordCount are set
 *
 * Output:
 *   CHAIN VALID or CHAIN INVALID
 *   Total records checked
 *   Errors by line/index
 *
 * No external dependencies. Uses only Node.js built-in crypto and fs.
 */

const fs = require("fs");
const path = require("path");
const {
  buildSignedReceiptBody,
  canonicalize,
  sha256,
  verifyReceiptSignature,
} = require("./receipt-core");

// --- Paths ---

const DEFAULT_LEDGER_PATH = path.join(__dirname, "ledger", "ledger.jsonl");
const DEFAULT_TRUSTED_KEYS_PATH = path.join(__dirname, "trust", "trusted_keys.json");

// --- Helpers ---

function hasDefined(configured, key) {
  return (
    Object.prototype.hasOwnProperty.call(configured, key) &&
    configured[key] !== undefined
  );
}

function configuredValue(configured, camelKey, snakeKey, fallback) {
  if (hasDefined(configured, camelKey)) return configured[camelKey];
  if (hasDefined(configured, snakeKey)) return configured[snakeKey];
  return fallback;
}

function requirePath(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function resolveOptions(options) {
  if (typeof options === "string") {
    return {
      ledgerPath: requirePath(options, "ledgerPath"),
      trustedKeysPath: DEFAULT_TRUSTED_KEYS_PATH,
    };
  }

  const configured = options || {};
  const hasTrustedKeys =
    hasDefined(configured, "trustedKeys") || hasDefined(configured, "trusted_keys");
  const hasExpectedHeadHash =
    hasDefined(configured, "expectedHeadHash") ||
    hasDefined(configured, "expected_head_hash");
  const hasExpectedRecordCount =
    hasDefined(configured, "expectedRecordCount") ||
    hasDefined(configured, "expected_record_count");
  const resolved = {
    ledgerPath: requirePath(
      configuredValue(configured, "ledgerPath", "ledger_path", DEFAULT_LEDGER_PATH),
      "ledgerPath"
    ),
    trustedKeysPath: requirePath(
      configuredValue(
        configured,
        "trustedKeysPath",
        "trusted_keys_path",
        DEFAULT_TRUSTED_KEYS_PATH
      ),
      "trustedKeysPath"
    ),
    ...(hasTrustedKeys
      ? {
          trustedKeys: configuredValue(
            configured,
            "trustedKeys",
            "trusted_keys"
          ),
        }
      : {}),
    ...(hasExpectedHeadHash
      ? {
          expectedHeadHash: configuredValue(
            configured,
            "expectedHeadHash",
            "expected_head_hash"
          ),
        }
      : {}),
    ...(hasExpectedRecordCount
      ? {
          expectedRecordCount: configuredValue(
            configured,
            "expectedRecordCount",
            "expected_record_count"
          ),
        }
      : {}),
  };
  if (
    hasExpectedHeadHash &&
    resolved.expectedHeadHash !== null &&
    typeof resolved.expectedHeadHash !== "string"
  ) {
    throw new TypeError("expectedHeadHash must be a string or null");
  }
  if (
    hasExpectedRecordCount &&
    (!Number.isInteger(resolved.expectedRecordCount) ||
      resolved.expectedRecordCount < 0)
  ) {
    throw new TypeError("expectedRecordCount must be a non-negative integer");
  }
  return resolved;
}

function loadTrustedKeys(options) {
  if (Object.prototype.hasOwnProperty.call(options, "trustedKeys")) {
    if (!Array.isArray(options.trustedKeys)) {
      throw new TypeError("trustedKeys must be an array");
    }
    return options.trustedKeys;
  }
  if (fs.existsSync(options.trustedKeysPath)) {
    const parsed = JSON.parse(fs.readFileSync(options.trustedKeysPath, "utf8"));
    if (!Array.isArray(parsed.trusted_keys)) {
      throw new TypeError("trusted keys file must contain a trusted_keys array");
    }
    return parsed.trusted_keys;
  }
  return [];
}

function appendExpectationErrors(errors, configured, totalRecords, headHash) {
  if (
    Object.prototype.hasOwnProperty.call(configured, "expectedRecordCount") &&
    totalRecords !== configured.expectedRecordCount
  ) {
    errors.push({
      index: 0,
      error: `Record count mismatch: expected ${configured.expectedRecordCount} but found ${totalRecords}`,
    });
  }

  if (
    Object.prototype.hasOwnProperty.call(configured, "expectedHeadHash") &&
    headHash !== configured.expectedHeadHash
  ) {
    errors.push({
      index: 0,
      error: `Ledger head mismatch: expected "${configured.expectedHeadHash}" but found "${headHash}"`,
    });
  }
}

// --- Verification ---

function verifyChain(options) {
  const configured = resolveOptions(options);
  const errors = [];

  // Check ledger exists
  if (!fs.existsSync(configured.ledgerPath)) {
    return {
      valid: false,
      total_records: 0,
      head_hash: null,
      errors: [
        { index: 0, error: "Ledger file not found: " + configured.ledgerPath },
      ],
    };
  }

  let content;
  try {
    content = fs.readFileSync(configured.ledgerPath, "utf8").trim();
  } catch (error) {
    return {
      valid: false,
      total_records: 0,
      head_hash: null,
      errors: [
        {
          index: 0,
          error: `Ledger file cannot be read: ${error.message}`,
        },
      ],
    };
  }
  if (!content) {
    appendExpectationErrors(errors, configured, 0, null);
    return {
      valid: errors.length === 0,
      total_records: 0,
      head_hash: null,
      errors,
      message: "Ledger is empty (no records to verify).",
    };
  }

  const lines = content.split("\n");
  let trustedKeys;
  try {
    trustedKeys = loadTrustedKeys(configured);
  } catch (e) {
    return {
      valid: false,
      total_records: lines.filter((line) => line.trim()).length,
      head_hash: null,
      errors: [{ index: 0, error: `Trusted keys file is invalid: ${e.message}` }],
    };
  }
  let previousHash = null;
  const receiptIds = new Set();
  const approvalNonces = new Set();

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

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push({
        index: lineNum,
        error: "Ledger entry must be a JSON object",
      });
      break;
    }

    // 2. Check structure
    if (!entry.receipt_hash) {
      errors.push({ index: lineNum, error: "Missing receipt_hash" });
      continue;
    }

    if (!isCanonicalIsoTimestamp(entry.appended_at)) {
      errors.push({
        index: lineNum,
        error: "appended_at must be a canonical ISO-8601 UTC timestamp",
      });
    }

    if (
      !entry.receipt ||
      typeof entry.receipt !== "object" ||
      Array.isArray(entry.receipt)
    ) {
      errors.push({ index: lineNum, error: "Missing receipt object" });
      continue;
    }

    const receipt = entry.receipt;

    const receiptIdValid =
      typeof receipt.receipt_id === "string" &&
      receipt.receipt_id.trim().length > 0;
    const nonce = receipt.approval && receipt.approval.nonce;
    const nonceValid = typeof nonce === "string" && nonce.trim().length > 0;
    if (!receiptIdValid) {
      errors.push({
        index: lineNum,
        error: "receipt_id must be a non-empty string",
      });
    }
    if (!nonceValid) {
      errors.push({
        index: lineNum,
        error: "approval.nonce must be a non-empty string",
      });
    }

    if (entry.receipt_hash !== receipt.receipt_hash) {
      errors.push({
        index: lineNum,
        error: "Receipt hash envelope does not match nested receipt_hash",
      });
    }

    // 3. Verify previous_receipt_hash chain link
    if (entry.previous_receipt_hash !== previousHash) {
      errors.push({
        index: lineNum,
        error: `Chain link broken: expected previous_receipt_hash "${previousHash}" but found "${entry.previous_receipt_hash}"`,
      });
    }

    const receiptPreviousHash = receipt.chain_reference
      ? receipt.chain_reference.previous_receipt_hash
      : null;
    if (receiptPreviousHash !== entry.previous_receipt_hash) {
      errors.push({
        index: lineNum,
        error: "Receipt chain_reference does not match ledger envelope",
      });
    }

    // 4. Recompute receipt_hash
    const computedHash = sha256(canonicalize(buildSignedReceiptBody(receipt)));

    if (computedHash !== receipt.receipt_hash) {
      errors.push({
        index: lineNum,
        error: `Receipt hash mismatch: computed "${computedHash.substring(0, 16)}..." but stored "${String(receipt.receipt_hash).substring(0, 16)}..."`,
      });
    }

    // 5. Verify signature
    if (receipt.signature && receipt.public_key) {
      if (!verifyReceiptSignature(receipt)) {
        errors.push({ index: lineNum, error: "Signature verification failed" });
      }

      // 6. Check trusted key
      if (!trustedKeys.includes(receipt.public_key)) {
        errors.push({
          index: lineNum,
          error: `Untrusted public key: ${String(receipt.public_key).substring(0, 16)}...`,
        });
      }
    } else {
      errors.push({ index: lineNum, error: "Missing signature or public_key" });
    }

    if (receiptIdValid) {
      if (receiptIds.has(receipt.receipt_id)) {
        errors.push({ index: lineNum, error: "Duplicate receipt_id" });
      }
      receiptIds.add(receipt.receipt_id);
    }

    if (nonceValid) {
      if (approvalNonces.has(nonce)) {
        errors.push({ index: lineNum, error: "Duplicate approval.nonce" });
      }
      approvalNonces.add(nonce);
    }

    // Update chain state
    previousHash = entry.receipt_hash;
  }

  const totalRecords = lines.filter((l) => l.trim()).length;
  appendExpectationErrors(errors, configured, totalRecords, previousHash);

  return {
    valid: errors.length === 0,
    total_records: totalRecords,
    head_hash: previousHash,
    errors: errors,
  };
}

function createChainVerifier(options = {}) {
  const configured = resolveOptions(options);
  return () => verifyChain(configured);
}

// --- Main ---

if (require.main === module) {
  console.log("=== LEDGER CHAIN VERIFICATION ===");
  console.log("");

  const result = verifyChain({
    ledgerPath: process.argv[2],
    trustedKeysPath: process.argv[3],
  });

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

module.exports = { createChainVerifier, verifyChain };
