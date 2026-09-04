/**
 * ledger.js
 *
 * Append-only hash-chained JSONL ledger for the Local Receipt Engine.
 *
 * Provides:
 *   - appendReceipt(receipt) — append a signed receipt to the local ledger
 *   - readLedger() — read all ledger entries
 *   - getLastHash() — get the previous_receipt_hash for the next entry
 *   - createLedger(options) — bind the same API to a configured ledger/trust set
 *
 * The ledger stores one JSON object per line. Each entry includes:
 *   - receipt_hash (from the receipt)
 *   - previous_receipt_hash (chain link to prior entry)
 *   - appended_at (timestamp of append)
 *   - The full receipt object
 *
 * First entry uses previous_receipt_hash: null (GENESIS).
 *
 * No external dependencies. Uses only Node.js built-in fs.
 */

const fs = require("fs");
const path = require("path");
const {
  hashSignedReceiptBody,
  verifyReceiptSignature,
} = require("./receipt-core");

const DEFAULT_LEDGER_PATH = path.join(__dirname, "ledger", "ledger.jsonl");

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

function resolveLedgerOptions(options) {
  if (typeof options === "string") {
    return { ledgerPath: requirePath(options, "ledgerPath") };
  }

  const configured = options || {};
  const hasTrustedKeys =
    hasDefined(configured, "trustedKeys") || hasDefined(configured, "trusted_keys");
  const hasTrustedKeysPath =
    hasDefined(configured, "trustedKeysPath") ||
    hasDefined(configured, "trusted_keys_path");

  return {
    ledgerPath: requirePath(
      configuredValue(configured, "ledgerPath", "ledger_path", DEFAULT_LEDGER_PATH),
      "ledgerPath"
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
    ...(hasTrustedKeysPath
      ? {
          trustedKeysPath: requirePath(
            configuredValue(configured, "trustedKeysPath", "trusted_keys_path"),
            "trustedKeysPath"
          ),
        }
      : {}),
  };
}

function resolveLedgerPath(options) {
  return resolveLedgerOptions(options).ledgerPath;
}

function loadAppendTrustedKeys(options) {
  if (Object.prototype.hasOwnProperty.call(options, "trustedKeys")) {
    if (!Array.isArray(options.trustedKeys)) {
      throw new TypeError("trustedKeys must be an array");
    }
    return options.trustedKeys;
  }
  if (Object.prototype.hasOwnProperty.call(options, "trustedKeysPath")) {
    if (
      typeof options.trustedKeysPath !== "string" ||
      options.trustedKeysPath.length === 0
    ) {
      throw new TypeError("trustedKeysPath must be a non-empty string");
    }
    const parsed = JSON.parse(fs.readFileSync(options.trustedKeysPath, "utf8"));
    if (!Array.isArray(parsed.trusted_keys)) {
      throw new TypeError("trusted keys file must contain a trusted_keys array");
    }
    return parsed.trusted_keys;
  }
  return null;
}

/**
 * Read all ledger entries from the JSONL file.
 * Returns an array of ledger entry objects.
 */
function readLedger(options) {
  const ledgerPath = resolveLedgerPath(options);
  if (!fs.existsSync(ledgerPath)) {
    return [];
  }

  const content = fs.readFileSync(ledgerPath, "utf8").trim();
  if (!content) return [];

  const lines = content.split("\n");
  const entries = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch (e) {
      throw new Error(`Malformed JSON at ledger line ${i + 1}: ${e.message}`);
    }
  }

  return entries;
}

/**
 * Get the receipt_hash of the last entry in the ledger.
 * Returns null if the ledger is empty (GENESIS case).
 */
function getLastHash(options) {
  const entries = readLedger(options);
  if (entries.length === 0) return null;
  return entries[entries.length - 1].receipt_hash;
}

function receiptPreviousHash(receipt) {
  return receipt && receipt.chain_reference
    ? receipt.chain_reference.previous_receipt_hash
    : null;
}

function assertReplayIdentifiers(receipt, context) {
  if (
    typeof receipt.receipt_id !== "string" ||
    receipt.receipt_id.trim().length === 0
  ) {
    throw new Error(`Cannot append: ${context} receipt_id must be a non-empty string`);
  }
  const nonce = receipt.approval && receipt.approval.nonce;
  if (typeof nonce !== "string" || nonce.trim().length === 0) {
    throw new Error(
      `Cannot append: ${context} approval.nonce must be a non-empty string`
    );
  }
  return { receiptId: receipt.receipt_id, nonce };
}

function assertLedgerIntegrity(entries, trustedKeys = null) {
  let previousHash = null;
  const receiptIds = new Set();
  const approvalNonces = new Set();

  for (let i = 0; i < entries.length; i++) {
    const lineNum = i + 1;
    const entry = entries[i];
    const receipt = entry && entry.receipt;

    if (!entry || !entry.receipt_hash || !receipt) {
      throw new Error(`Cannot append: existing ledger is invalid at line ${lineNum}`);
    }
    const { receiptId, nonce } = assertReplayIdentifiers(
      receipt,
      `existing line ${lineNum}`
    );
    if (entry.previous_receipt_hash !== previousHash) {
      throw new Error(`Cannot append: existing ledger chain is broken at line ${lineNum}`);
    }
    if (entry.receipt_hash !== receipt.receipt_hash) {
      throw new Error(`Cannot append: receipt hash envelope mismatch at line ${lineNum}`);
    }
    if (receiptPreviousHash(receipt) !== entry.previous_receipt_hash) {
      throw new Error(`Cannot append: receipt chain reference mismatch at line ${lineNum}`);
    }
    if (hashSignedReceiptBody(receipt) !== receipt.receipt_hash) {
      throw new Error(`Cannot append: existing receipt hash is invalid at line ${lineNum}`);
    }
    if (!verifyReceiptSignature(receipt)) {
      throw new Error(`Cannot append: existing receipt signature is invalid at line ${lineNum}`);
    }
    if (trustedKeys && !trustedKeys.includes(receipt.public_key)) {
      throw new Error(
        `Cannot append: existing receipt public_key is not trusted at line ${lineNum}`
      );
    }

    if (receiptIds.has(receiptId)) {
        throw new Error(`Cannot append: duplicate receipt_id already exists at line ${lineNum}`);
    }
    receiptIds.add(receiptId);

    if (approvalNonces.has(nonce)) {
        throw new Error(`Cannot append: duplicate approval.nonce already exists at line ${lineNum}`);
    }
    approvalNonces.add(nonce);

    previousHash = entry.receipt_hash;
  }

  return { previousHash, receiptIds, approvalNonces };
}

/**
 * Append a signed receipt to the ledger.
 *
 * Validates:
 *   - receipt has receipt_hash
 *   - receipt has signature
 *   - signed-body hash and Ed25519 signature are valid
 *   - receipt.chain_reference.previous_receipt_hash matches ledger tail
 *   - the existing ledger is intact and contains no replay identifiers
 *   - receipt_id and approval.nonce are not already present
 *   - public_key is trusted when trustedKeys/trustedKeysPath is configured
 *
 * The append is fsynced before success is returned. Throws on validation
 * failure (fail-closed).
 */
function appendReceipt(receipt, options) {
  if (!receipt || !receipt.receipt_hash) {
    throw new Error("Cannot append: receipt missing receipt_hash");
  }
  if (!receipt.signature) {
    throw new Error("Cannot append: receipt missing signature");
  }

  const configured = resolveLedgerOptions(options);
  const ledgerPath = configured.ledgerPath;
  const trustedKeys = loadAppendTrustedKeys(configured);
  const entries = readLedger({ ledgerPath });
  const { previousHash: expectedPrevHash, receiptIds, approvalNonces } =
    assertLedgerIntegrity(entries, trustedKeys);
  const receiptPrevHash = receiptPreviousHash(receipt);

  if (expectedPrevHash !== receiptPrevHash) {
    throw new Error(
      `Chain link mismatch: expected previous_receipt_hash "${expectedPrevHash}" but receipt has "${receiptPrevHash}"`
    );
  }

  if (hashSignedReceiptBody(receipt) !== receipt.receipt_hash) {
    throw new Error("Cannot append: receipt_hash does not match signed receipt body");
  }
  if (!verifyReceiptSignature(receipt)) {
    throw new Error("Cannot append: receipt signature verification failed");
  }
  if (trustedKeys && !trustedKeys.includes(receipt.public_key)) {
    throw new Error("Cannot append: receipt public_key is not trusted");
  }
  const { receiptId, nonce } = assertReplayIdentifiers(receipt, "incoming");
  if (receiptIds.has(receiptId)) {
    throw new Error(`Cannot append: duplicate receipt_id "${receipt.receipt_id}"`);
  }

  if (approvalNonces.has(nonce)) {
    throw new Error(`Cannot append: duplicate approval.nonce "${nonce}"`);
  }

  const entry = {
    receipt_hash: receipt.receipt_hash,
    previous_receipt_hash: receiptPrevHash,
    appended_at: new Date().toISOString(),
    receipt: receipt,
  };

  // Append-only and locally durable: write one JSON line, then flush it to the
  // filesystem before reporting success to the caller.
  const line = Buffer.from(JSON.stringify(entry) + "\n", "utf8");
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  let descriptor;
  try {
    descriptor = fs.openSync(ledgerPath, "a");
    let offset = 0;
    while (offset < line.length) {
      const written = fs.writeSync(descriptor, line, offset, line.length - offset);
      if (written === 0) throw new Error("Cannot append: ledger write made no progress");
      offset += written;
    }
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }

  return entry;
}

/**
 * Get the ledger file path (for external tools).
 */
function getLedgerPath(options) {
  return resolveLedgerPath(options);
}

function createLedger(options = {}) {
  const configured = resolveLedgerOptions(options);
  const ledgerPath = configured.ledgerPath;

  return {
    appendReceipt: (receipt) => appendReceipt(receipt, configured),
    getLastHash: () => getLastHash(configured),
    getLedgerPath: () => ledgerPath,
    readLedger: () => readLedger(configured),
  };
}

module.exports = {
  appendReceipt,
  createLedger,
  getLastHash,
  getLedgerPath,
  readLedger,
};
