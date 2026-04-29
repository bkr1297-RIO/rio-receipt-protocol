/**
 * ledger.js
 *
 * Append-only hash-chained JSONL ledger for the Local Receipt Engine.
 *
 * Provides:
 *   - appendReceipt(receipt) — append a signed receipt to the local ledger
 *   - readLedger() — read all ledger entries
 *   - getLastHash() — get the previous_receipt_hash for the next entry
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

const LEDGER_PATH = path.join(__dirname, "ledger", "ledger.jsonl");

/**
 * Read all ledger entries from the JSONL file.
 * Returns an array of ledger entry objects.
 */
function readLedger() {
  if (!fs.existsSync(LEDGER_PATH)) {
    return [];
  }

  const content = fs.readFileSync(LEDGER_PATH, "utf8").trim();
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
function getLastHash() {
  const entries = readLedger();
  if (entries.length === 0) return null;
  return entries[entries.length - 1].receipt_hash;
}

/**
 * Append a signed receipt to the ledger.
 *
 * Validates:
 *   - receipt has receipt_hash
 *   - receipt has signature
 *   - receipt.chain_reference.previous_receipt_hash matches ledger tail
 *
 * Throws on validation failure (fail-closed).
 */
function appendReceipt(receipt) {
  if (!receipt || !receipt.receipt_hash) {
    throw new Error("Cannot append: receipt missing receipt_hash");
  }
  if (!receipt.signature) {
    throw new Error("Cannot append: receipt missing signature");
  }

  const expectedPrevHash = getLastHash();
  const receiptPrevHash = receipt.chain_reference
    ? receipt.chain_reference.previous_receipt_hash
    : null;

  if (expectedPrevHash !== receiptPrevHash) {
    throw new Error(
      `Chain link mismatch: expected previous_receipt_hash "${expectedPrevHash}" but receipt has "${receiptPrevHash}"`
    );
  }

  const entry = {
    receipt_hash: receipt.receipt_hash,
    previous_receipt_hash: receiptPrevHash,
    appended_at: new Date().toISOString(),
    receipt: receipt,
  };

  // Append-only: write one JSON line
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(LEDGER_PATH, line);

  return entry;
}

/**
 * Get the ledger file path (for external tools).
 */
function getLedgerPath() {
  return LEDGER_PATH;
}

module.exports = {
  readLedger,
  getLastHash,
  appendReceipt,
  getLedgerPath,
};
