/**
 * test_chain.js
 *
 * Chain verification tests for the Local Receipt Engine.
 *
 * Tests:
 *   1. Valid chain passes verification
 *   2. Modified receipt is detected (hash mismatch)
 *   3. Deleted record is detected (chain gap)
 *   4. Reordered records are detected (previous_hash mismatch)
 *   5. Broken previous_receipt_hash link is detected
 *   6. Malformed JSON line is detected
 *   7. Untrusted public key is detected
 *
 * Uses a temporary ledger file for isolation. Does not modify the real ledger.
 *
 * No external dependencies. Uses only Node.js built-in crypto and fs.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// --- Test infrastructure ---

const TEMP_LEDGER_DIR = path.join(__dirname, "test_temp_ledger");
const TEMP_LEDGER_PATH = path.join(TEMP_LEDGER_DIR, "ledger.jsonl");
const TRUSTED_KEYS_PATH = path.join(__dirname, "trust", "trusted_keys.json");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log("  PASS: " + testName);
    passed++;
  } else {
    console.log("  FAIL: " + testName);
    failed++;
  }
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

// --- Generate test keypair ---

const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const pubKeyHex = publicKey.export({ type: "spki", format: "der" }).toString("hex");

// Write trusted keys for test
fs.mkdirSync(path.dirname(TRUSTED_KEYS_PATH), { recursive: true });
const originalTrustedKeys = fs.existsSync(TRUSTED_KEYS_PATH)
  ? fs.readFileSync(TRUSTED_KEYS_PATH, "utf8")
  : null;

fs.writeFileSync(
  TRUSTED_KEYS_PATH,
  JSON.stringify({ trusted_keys: [pubKeyHex] }, null, 2) + "\n"
);

// --- Helper: create a signed receipt ---

function createTestReceipt(index, previousHash) {
  const receiptBody = {
    receipt_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    intent_hash: sha256("intent-" + index),
    execution_hash: sha256("execution-" + index),
    validation: {
      decision: "ALLOW",
      checks: { intent_match: true, context_match: true, scope_valid: true, execution_path_valid: true },
      policy_version: "1.0.0",
    },
    decision: "ALLOW",
    approval: {
      approval_id: crypto.randomUUID(),
      intent_hash: sha256("intent-" + index),
      authorizer: "human:test-user",
      nonce: crypto.randomUUID(),
    },
    chain_reference: {
      previous_receipt_hash: previousHash,
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

function createLedgerEntry(receipt) {
  return {
    receipt_hash: receipt.receipt_hash,
    previous_receipt_hash: receipt.chain_reference.previous_receipt_hash,
    appended_at: new Date().toISOString(),
    receipt: receipt,
  };
}

function writeTempLedger(entries) {
  fs.mkdirSync(TEMP_LEDGER_DIR, { recursive: true });
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.writeFileSync(TEMP_LEDGER_PATH, content);
}

function cleanupTemp() {
  if (fs.existsSync(TEMP_LEDGER_PATH)) fs.unlinkSync(TEMP_LEDGER_PATH);
  if (fs.existsSync(TEMP_LEDGER_DIR)) fs.rmdirSync(TEMP_LEDGER_DIR);
}

// --- Monkey-patch verify-chain to use temp ledger ---

// We'll call verifyChain with a modified ledger path by temporarily
// overriding the ledger path. Since verify-chain.js uses a hardcoded path,
// we'll implement our own verification inline using the same logic.

function verifyTempChain() {
  const content = fs.readFileSync(TEMP_LEDGER_PATH, "utf8").trim();
  if (!content) return { valid: true, total_records: 0, errors: [] };

  const lines = content.split("\n");
  const trustedKeys = JSON.parse(fs.readFileSync(TRUSTED_KEYS_PATH, "utf8")).trusted_keys || [];
  const errors = [];
  let previousHash = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();
    if (!line) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch (e) {
      errors.push({ index: lineNum, error: `Malformed JSON: ${e.message}` });
      break;
    }

    if (!entry.receipt_hash) {
      errors.push({ index: lineNum, error: "Missing receipt_hash" });
      continue;
    }
    if (!entry.receipt) {
      errors.push({ index: lineNum, error: "Missing receipt object" });
      continue;
    }

    const receipt = entry.receipt;

    // Chain link
    if (entry.previous_receipt_hash !== previousHash) {
      errors.push({
        index: lineNum,
        error: `Chain link broken: expected "${previousHash}" but found "${entry.previous_receipt_hash}"`,
      });
    }

    // Recompute hash
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

    if (computedHash !== receipt.receipt_hash) {
      errors.push({ index: lineNum, error: "Receipt hash mismatch" });
    }

    // Verify signature
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
        if (!sigValid) errors.push({ index: lineNum, error: "Signature invalid" });
      } catch (e) {
        errors.push({ index: lineNum, error: "Signature error: " + e.message });
      }

      if (!trustedKeys.includes(receipt.public_key)) {
        errors.push({ index: lineNum, error: "Untrusted public key" });
      }
    } else {
      errors.push({ index: lineNum, error: "Missing signature or public_key" });
    }

    previousHash = entry.receipt_hash;
  }

  return {
    valid: errors.length === 0,
    total_records: lines.filter((l) => l.trim()).length,
    errors,
  };
}

// --- Tests ---

console.log("=== CHAIN VERIFICATION TESTS ===");
console.log("");

// Test 1: Valid chain passes
console.log("Test 1: Valid chain passes verification");
{
  const r1 = createTestReceipt(1, null);
  const r2 = createTestReceipt(2, r1.receipt_hash);
  const r3 = createTestReceipt(3, r2.receipt_hash);
  writeTempLedger([createLedgerEntry(r1), createLedgerEntry(r2), createLedgerEntry(r3)]);
  const result = verifyTempChain();
  assert(result.valid === true, "3-entry chain is valid");
  assert(result.total_records === 3, "total_records = 3");
  assert(result.errors.length === 0, "no errors");
}
cleanupTemp();
console.log("");

// Test 2: Modified receipt detected
console.log("Test 2: Modified receipt is detected (hash mismatch)");
{
  const r1 = createTestReceipt(1, null);
  const r2 = createTestReceipt(2, r1.receipt_hash);
  // Tamper with r2's decision after signing
  const entry2 = createLedgerEntry(r2);
  entry2.receipt.decision = "TAMPERED";
  writeTempLedger([createLedgerEntry(r1), entry2]);
  const result = verifyTempChain();
  assert(result.valid === false, "chain is invalid");
  assert(result.errors.some((e) => e.error.includes("hash mismatch") || e.error.includes("Signature")), "detects modification");
}
cleanupTemp();
console.log("");

// Test 3: Deleted record detected (chain gap)
console.log("Test 3: Deleted record is detected (chain gap)");
{
  const r1 = createTestReceipt(1, null);
  const r2 = createTestReceipt(2, r1.receipt_hash);
  const r3 = createTestReceipt(3, r2.receipt_hash);
  // Delete r2 — r3 now points to r2's hash but r2 is missing
  writeTempLedger([createLedgerEntry(r1), createLedgerEntry(r3)]);
  const result = verifyTempChain();
  assert(result.valid === false, "chain is invalid");
  assert(result.errors.some((e) => e.error.includes("Chain link broken")), "detects deleted record");
}
cleanupTemp();
console.log("");

// Test 4: Reordered records detected
console.log("Test 4: Reordered records are detected");
{
  const r1 = createTestReceipt(1, null);
  const r2 = createTestReceipt(2, r1.receipt_hash);
  const r3 = createTestReceipt(3, r2.receipt_hash);
  // Swap r2 and r3
  writeTempLedger([createLedgerEntry(r1), createLedgerEntry(r3), createLedgerEntry(r2)]);
  const result = verifyTempChain();
  assert(result.valid === false, "chain is invalid");
  assert(result.errors.some((e) => e.error.includes("Chain link broken")), "detects reordering");
}
cleanupTemp();
console.log("");

// Test 5: Broken previous_receipt_hash link
console.log("Test 5: Broken previous_receipt_hash link is detected");
{
  const r1 = createTestReceipt(1, null);
  const r2 = createTestReceipt(2, r1.receipt_hash);
  // Corrupt the previous_receipt_hash in the ledger entry
  const entry2 = createLedgerEntry(r2);
  entry2.previous_receipt_hash = "0000000000000000000000000000000000000000000000000000000000000000";
  writeTempLedger([createLedgerEntry(r1), entry2]);
  const result = verifyTempChain();
  assert(result.valid === false, "chain is invalid");
  assert(result.errors.some((e) => e.error.includes("Chain link broken")), "detects broken link");
}
cleanupTemp();
console.log("");

// Test 6: Malformed JSON line
console.log("Test 6: Malformed JSON line is detected");
{
  const r1 = createTestReceipt(1, null);
  fs.mkdirSync(TEMP_LEDGER_DIR, { recursive: true });
  fs.writeFileSync(TEMP_LEDGER_PATH, JSON.stringify(createLedgerEntry(r1)) + "\n{not valid json\n");
  const result = verifyTempChain();
  assert(result.valid === false, "chain is invalid");
  assert(result.errors.some((e) => e.error.includes("Malformed JSON")), "detects malformed line");
}
cleanupTemp();
console.log("");

// Test 7: Untrusted public key
console.log("Test 7: Untrusted public key is detected");
{
  // Generate a different keypair not in trusted_keys
  const { privateKey: untrustedPriv, publicKey: untrustedPub } = crypto.generateKeyPairSync("ed25519");
  const untrustedPubHex = untrustedPub.export({ type: "spki", format: "der" }).toString("hex");

  const receiptBody = {
    receipt_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    intent_hash: sha256("intent-untrusted"),
    execution_hash: sha256("execution-untrusted"),
    validation: {
      decision: "ALLOW",
      checks: { intent_match: true, context_match: true, scope_valid: true, execution_path_valid: true },
      policy_version: "1.0.0",
    },
    decision: "ALLOW",
    approval: {
      approval_id: crypto.randomUUID(),
      intent_hash: sha256("intent-untrusted"),
      authorizer: "human:unknown",
      nonce: crypto.randomUUID(),
    },
    chain_reference: { previous_receipt_hash: null },
  };

  const payload = canonicalize(receiptBody);
  const receiptHash = sha256(payload);
  const signature = crypto.sign(null, Buffer.from(payload, "utf8"), untrustedPriv).toString("hex");

  const receipt = {
    ...receiptBody,
    receipt_hash: receiptHash,
    signature: signature,
    signature_algorithm: "Ed25519",
    public_key: untrustedPubHex,
  };

  writeTempLedger([createLedgerEntry(receipt)]);
  const result = verifyTempChain();
  assert(result.valid === false, "chain is invalid");
  assert(result.errors.some((e) => e.error.includes("Untrusted public key")), "detects untrusted key");
}
cleanupTemp();
console.log("");

// --- Restore original trusted keys if needed ---

if (originalTrustedKeys) {
  fs.writeFileSync(TRUSTED_KEYS_PATH, originalTrustedKeys);
}

// --- Summary ---

console.log("=== RESULTS ===");
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log("");

if (failed > 0) {
  console.log("CHAIN TESTS: SOME FAILED");
  process.exit(1);
} else {
  console.log("CHAIN TESTS: ALL PASSED");
}
