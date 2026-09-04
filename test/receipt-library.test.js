const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  signReceipt,
  verifyReceiptSignature,
  verifySignedReceipt,
} = require("../receipt-core");
const {
  appendReceipt,
  createLedger,
  getLastHash,
  readLedger,
} = require("../ledger");
const { createChainVerifier, verifyChain } = require("../verify-chain");

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rio-receipt-library-"));
  const ledgerPath = path.join(directory, "ledger", "ledger.jsonl");
  const trustedKeysPath = path.join(directory, "trust", "trusted_keys.json");
  const pair = crypto.generateKeyPairSync("ed25519");
  const publicKeyHex = pair.publicKey
    .export({ type: "spki", format: "der" })
    .toString("hex");

  fs.mkdirSync(path.dirname(trustedKeysPath), { recursive: true });
  fs.writeFileSync(
    trustedKeysPath,
    JSON.stringify({ trusted_keys: [publicKeyHex] }) + "\n"
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  return {
    ledgerPath,
    pair,
    publicKeyHex,
    trustedKeysPath,
  };
}

function stableUuid(label) {
  const digits = crypto
    .createHash("sha256")
    .update(label)
    .digest("hex")
    .slice(0, 32)
    .split("");
  digits[12] = "4";
  digits[16] = "8";
  const value = digits.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function receiptBody({ id, nonce, previousHash }) {
  return {
    receipt_id: stableUuid(`receipt:${id}`),
    timestamp: "2026-09-04T00:00:00.000Z",
    intent_hash: crypto.createHash("sha256").update(`intent:${id}`).digest("hex"),
    execution_hash: crypto
      .createHash("sha256")
      .update(`execution:${id}`)
      .digest("hex"),
    validation: {
      decision: "ALLOW",
      checks: {
        context_match: true,
        execution_path_valid: true,
        intent_match: true,
        scope_valid: true,
      },
      policy_version: "1.0.0",
    },
    decision: "ALLOW",
    approval: {
      approval_id: stableUuid(`approval:${id}`),
      authorizer: "fixture:sourcepoint",
      intent_hash: crypto.createHash("sha256").update(`intent:${id}`).digest("hex"),
      nonce: stableUuid(`nonce:${nonce}`),
    },
    chain_reference: { previous_receipt_hash: previousHash },
  };
}

test("generic Ed25519 helpers sign and verify the canonical receipt body", (t) => {
  const { pair } = fixture(t);
  const signed = signReceipt(
    receiptBody({ id: "receipt-1", nonce: "nonce-1", previousHash: null }),
    pair.privateKey
  );

  assert.equal(verifyReceiptSignature(signed), true);
  assert.deepEqual(verifySignedReceipt(signed), {
    valid: true,
    receipt_hash_valid: true,
    signature_valid: true,
    computed_hash: signed.receipt_hash,
  });

  const tampered = { ...signed, decision: "BLOCK" };
  assert.equal(verifyReceiptSignature(tampered), false);
  assert.equal(verifySignedReceipt(tampered).valid, false);

  const extended = signReceipt(
    {
      ...receiptBody({ id: "receipt-extra", nonce: "nonce-extra", previousHash: null }),
      custom_claim: "LOCAL_ONLY",
    },
    pair.privateKey
  );
  assert.equal(
    verifySignedReceipt({ ...extended, custom_claim: "GLOBAL_AUTHORITY" }).valid,
    false
  );
  assert.equal(
    verifySignedReceipt({ ...signed, signature: `${signed.signature}zz` }).valid,
    false
  );
  assert.equal(verifySignedReceipt(signed, `${signed.public_key}00`).valid, false);
  const withoutAlgorithmLabel = { ...signed };
  delete withoutAlgorithmLabel.signature_algorithm;
  assert.equal(verifySignedReceipt(withoutAlgorithmLabel).valid, true);
  assert.equal(verifySignedReceipt([]).valid, false);
});

test("configurable ledger and trust paths support a fresh valid chain", (t) => {
  const { ledgerPath, pair, trustedKeysPath } = fixture(t);
  const publicKeyHex = pair.publicKey
    .export({ type: "spki", format: "der" })
    .toString("hex");
  const ledger = createLedger({ ledgerPath, trustedKeys: [publicKeyHex] });
  const first = signReceipt(
    receiptBody({ id: "receipt-1", nonce: "nonce-1", previousHash: null }),
    pair.privateKey
  );
  ledger.appendReceipt(first);
  const second = signReceipt(
    receiptBody({
      id: "receipt-2",
      nonce: "nonce-2",
      previousHash: first.receipt_hash,
    }),
    pair.privateKey
  );
  ledger.appendReceipt(second);

  assert.equal(ledger.getLastHash(), second.receipt_hash);
  assert.equal(getLastHash({ ledgerPath }), second.receipt_hash);
  assert.equal(readLedger(ledgerPath).length, 2);

  const result = verifyChain({
    ledgerPath,
    trustedKeysPath,
    expectedHeadHash: second.receipt_hash,
    expectedRecordCount: 2,
  });
  assert.equal(result.valid, true);
  assert.equal(result.total_records, 2);
  assert.equal(result.head_hash, second.receipt_hash);
  assert.equal(
    createChainVerifier({
      ledgerPath,
      trustedKeysPath,
      expectedHeadHash: second.receipt_hash,
      expectedRecordCount: 2,
    })().valid,
    true
  );

  const [firstEntry] = readLedger({ ledgerPath });
  fs.writeFileSync(ledgerPath, JSON.stringify(firstEntry) + "\n");
  const truncated = verifyChain({
    ledgerPath,
    trustedKeysPath,
    expectedHeadHash: second.receipt_hash,
    expectedRecordCount: 2,
  });
  assert.equal(truncated.valid, false);
  assert.ok(truncated.errors.some(({ error }) => error.includes("Record count mismatch")));
  assert.ok(truncated.errors.some(({ error }) => error.includes("Ledger head mismatch")));
});

test("append rejects a valid signature from a key outside the configured trust set", (t) => {
  const { ledgerPath, pair, publicKeyHex } = fixture(t);
  const untrustedPair = crypto.generateKeyPairSync("ed25519");
  const receipt = signReceipt(
    receiptBody({ id: "receipt-untrusted", nonce: "nonce-1", previousHash: null }),
    untrustedPair.privateKey
  );

  assert.throws(
    () => appendReceipt(receipt, { ledgerPath, trusted_keys: [publicKeyHex] }),
    /public_key is not trusted/
  );
  assert.equal(readLedger({ ledgerPath }).length, 0);

  const trusted = signReceipt(
    receiptBody({ id: "receipt-trusted", nonce: "nonce-2", previousHash: null }),
    pair.privateKey
  );
  appendReceipt(trusted, { ledgerPath, trustedKeys: [publicKeyHex] });
  assert.equal(readLedger({ ledgerPath }).length, 1);
});

test("append rejects a duplicate receipt_id without changing the ledger", (t) => {
  const { ledgerPath, pair } = fixture(t);
  const first = signReceipt(
    receiptBody({ id: "receipt-replay", nonce: "nonce-1", previousHash: null }),
    pair.privateKey
  );
  appendReceipt(first, { ledgerPath });
  const duplicate = signReceipt(
    receiptBody({
      id: "receipt-replay",
      nonce: "nonce-2",
      previousHash: first.receipt_hash,
    }),
    pair.privateKey
  );

  assert.throws(
    () => appendReceipt(duplicate, { ledgerPath }),
    /duplicate receipt_id/
  );
  assert.equal(readLedger({ ledgerPath }).length, 1);
});

test("append rejects a duplicate approval nonce without changing the ledger", (t) => {
  const { ledgerPath, pair } = fixture(t);
  const first = signReceipt(
    receiptBody({ id: "receipt-1", nonce: "nonce-replay", previousHash: null }),
    pair.privateKey
  );
  appendReceipt(first, { ledgerPath });
  const duplicate = signReceipt(
    receiptBody({
      id: "receipt-2",
      nonce: "nonce-replay",
      previousHash: first.receipt_hash,
    }),
    pair.privateKey
  );

  assert.throws(
    () => appendReceipt(duplicate, { ledgerPath }),
    /duplicate approval\.nonce/
  );
  assert.equal(readLedger({ ledgerPath }).length, 1);
});

test("append fails closed when the existing ledger chain is broken", (t) => {
  const { ledgerPath, pair } = fixture(t);
  const first = signReceipt(
    receiptBody({ id: "receipt-1", nonce: "nonce-1", previousHash: null }),
    pair.privateKey
  );
  appendReceipt(first, { ledgerPath });
  const second = signReceipt(
    receiptBody({
      id: "receipt-2",
      nonce: "nonce-2",
      previousHash: first.receipt_hash,
    }),
    pair.privateKey
  );
  appendReceipt(second, { ledgerPath });

  const entries = readLedger({ ledgerPath });
  entries[1].previous_receipt_hash = "0".repeat(64);
  fs.writeFileSync(
    ledgerPath,
    entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
  );

  const third = signReceipt(
    receiptBody({
      id: "receipt-3",
      nonce: "nonce-3",
      previousHash: second.receipt_hash,
    }),
    pair.privateKey
  );
  assert.throws(
    () => appendReceipt(third, { ledgerPath }),
    /existing ledger chain is broken/
  );
  assert.equal(readLedger({ ledgerPath }).length, 2);
});

test("append applies the configured trust set to the existing chain", (t) => {
  const { ledgerPath, pair, publicKeyHex } = fixture(t);
  const untrustedPair = crypto.generateKeyPairSync("ed25519");
  const untrusted = signReceipt(
    receiptBody({ id: "untrusted-seed", nonce: "untrusted-seed", previousHash: null }),
    untrustedPair.privateKey
  );
  appendReceipt(untrusted, { ledgerPath });
  const trusted = signReceipt(
    receiptBody({
      id: "trusted-next",
      nonce: "trusted-next",
      previousHash: untrusted.receipt_hash,
    }),
    pair.privateKey
  );

  assert.throws(
    () => appendReceipt(trusted, { ledgerPath, trustedKeys: [publicKeyHex] }),
    /existing receipt public_key is not trusted/
  );
  assert.equal(readLedger({ ledgerPath }).length, 1);
});

test("the configurable verifier detects replay records in a manually forged chain", (t) => {
  const { ledgerPath, pair, trustedKeysPath } = fixture(t);
  const first = signReceipt(
    receiptBody({ id: "receipt-replay", nonce: "nonce-replay", previousHash: null }),
    pair.privateKey
  );
  const second = signReceipt(
    receiptBody({
      id: "receipt-replay",
      nonce: "nonce-replay",
      previousHash: first.receipt_hash,
    }),
    pair.privateKey
  );
  const entries = [first, second].map((receipt) => ({
    receipt_hash: receipt.receipt_hash,
    previous_receipt_hash: receipt.chain_reference.previous_receipt_hash,
    appended_at: "2026-09-04T00:00:00.000Z",
    receipt,
  }));
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(
    ledgerPath,
    entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
  );

  const result = verifyChain({ ledgerPath, trustedKeysPath });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(({ error }) => error === "Duplicate receipt_id"));
  assert.ok(result.errors.some(({ error }) => error === "Duplicate approval.nonce"));
});

test("malformed ledger values return invalid instead of throwing", (t) => {
  const { ledgerPath, trustedKeysPath } = fixture(t);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, "null\n");

  const result = verifyChain({ ledgerPath, trustedKeysPath });
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(({ error }) => error === "Ledger entry must be a JSON object")
  );
});

test("missing or non-string replay identifiers fail closed", (t) => {
  const { ledgerPath, pair, trustedKeysPath } = fixture(t);
  const missingBody = receiptBody({
    id: "missing-id",
    nonce: "missing-nonce",
    previousHash: null,
  });
  delete missingBody.receipt_id;
  const missing = signReceipt(missingBody, pair.privateKey);
  assert.throws(
    () => appendReceipt(missing, { ledgerPath }),
    /receipt_id must be a non-empty string/
  );

  const malformed = signReceipt(
    {
      ...receiptBody({ id: "object-id", nonce: "array-nonce", previousHash: null }),
      receipt_id: { value: "same" },
      approval: {
        ...receiptBody({ id: "approval", nonce: "nonce", previousHash: null })
          .approval,
        nonce: ["same"],
      },
    },
    pair.privateKey
  );
  const entry = {
    receipt_hash: malformed.receipt_hash,
    previous_receipt_hash: null,
    appended_at: "2026-09-04T00:00:00.000Z",
    receipt: malformed,
  };
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, JSON.stringify(entry) + "\n");
  const checked = verifyChain({ ledgerPath, trustedKeysPath });
  assert.equal(checked.valid, false);
  assert.ok(
    checked.errors.some(({ error }) =>
      error.includes("receipt_id must be a non-empty string")
    )
  );
  assert.ok(
    checked.errors.some(({ error }) =>
      error.includes("approval.nonce must be a non-empty string")
    )
  );
});

test("undefined optional anchors are ignored and invalid explicit paths fail", (t) => {
  const { ledgerPath, pair, publicKeyHex, trustedKeysPath } = fixture(t);
  const receipt = signReceipt(
    receiptBody({ id: "anchor", nonce: "anchor", previousHash: null }),
    pair.privateKey
  );
  appendReceipt(receipt, { ledgerPath, trustedKeys: [publicKeyHex] });

  assert.equal(
    verifyChain({
      ledgerPath,
      trustedKeysPath,
      expectedHeadHash: undefined,
      expectedRecordCount: undefined,
    }).valid,
    true
  );
  assert.equal(
    verifyChain({
      ledgerPath,
      trustedKeys: undefined,
      trusted_keys: [publicKeyHex],
    }).valid,
    true
  );
  assert.throws(() => verifyChain({ ledgerPath: "" }), /non-empty string/);
  assert.throws(() => createLedger({ ledgerPath: "" }), /non-empty string/);
});
