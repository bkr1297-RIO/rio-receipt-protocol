"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const sourceboard = require("./constitutional-sourceboard");
const adapter = require("./sim-mus-adapter");
const ledger = require("./ledger");
const { verifyChain } = require("./verify-chain");

const CONFIG_PATH = path.join(__dirname, "config", "mus-unit.json");
const SIGNING_KEY_PATH = path.join(__dirname, "trust", "signing_key.json");
const TRUSTED_KEYS_PATH = path.join(__dirname, "trust", "trusted_keys.json");
const NONCE_STORE_PATH = path.join(__dirname, "runtime", "nonce_store.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function requireInitializedMusUnit() {
  const missing = [CONFIG_PATH, SIGNING_KEY_PATH, TRUSTED_KEYS_PATH, NONCE_STORE_PATH]
    .filter((filePath) => !fs.existsSync(filePath));

  if (missing.length > 0) {
    throw new Error(
      "Local MUS unit is not initialized. Run npm run init first. Missing: " +
        missing.map((filePath) => path.relative(__dirname, filePath)).join(", ")
    );
  }

  return {
    config: readJson(CONFIG_PATH),
    signingKey: readJson(SIGNING_KEY_PATH),
    trustedKeys: readJson(TRUSTED_KEYS_PATH).trusted_keys || [],
  };
}

function loadPrivateKey(signingKey) {
  return crypto.createPrivateKey({
    key: Buffer.from(signingKey.private_key, "hex"),
    format: "der",
    type: "pkcs8",
  });
}

function loadPublicKey(signingKey) {
  return crypto.createPublicKey({
    key: Buffer.from(signingKey.public_key, "hex"),
    format: "der",
    type: "spki",
  });
}

function loadNonces() {
  if (!fs.existsSync(NONCE_STORE_PATH)) return { used_nonces: [] };
  return readJson(NONCE_STORE_PATH);
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

function buildDraftOnlyCrossingPacket() {
  return {
    crossing_id: "real-demo-crossing-001",
    sourcepoint_id: "human:demo",
    mandate_id: "real-demo-mandate-001",
    requested_operation: "draft_only_output",
    crossing_type: "signal_to_draft_output",
    target_surface: "ONE_PRIVATE_DRAFT_SURFACE",
    authority_scope: "draft_only_output",
    external_consequence: false,
    memory_mutation: false,
    tool_access: "none",
    risk_tier: "low",
    ttl: 300,
    required_receipt_type: "signed_draft_return",
  };
}

function buildConstitutionalInput(crossingPacket) {
  return {
    trisource: {
      authority: {
        sourcepoint_id: crossingPacket.sourcepoint_id,
        mandate_id: crossingPacket.mandate_id,
        scope: crossingPacket.authority_scope,
      },
      capacity: {
        operation: crossingPacket.requested_operation,
        execution_surface: crossingPacket.target_surface,
      },
      accountability: {
        receipt_required: true,
        return_to_sourcepoint: true,
      },
    },
    five_core: {
      cores: {
        C0: { allowed: true, reason: "root rules satisfied" },
        C1: { allowed: true, reason: "human authority present" },
        C2: { allowed: true, reason: "draft-only interaction lane valid" },
        C3: { allowed: true, reason: "machine execution bounded to draft surface" },
        C4: { allowed: true, reason: "no external jurisdiction crossing" },
      },
    },
  };
}

function buildReceiptBody({ crossingPacket, config, previousReceiptHash }) {
  const sourceboardResult = sourceboard.evaluateConstitutionalSourceboard(
    buildConstitutionalInput(crossingPacket)
  );
  const intent = adapter.mapCrossingToIntent(crossingPacket);
  const executionInput = { ...intent };
  const approval = adapter.mapApprovalToReceiptApproval({
    authorizer: crossingPacket.sourcepoint_id,
    scope: crossingPacket.authority_scope,
    ttl: crossingPacket.ttl,
  }, intent);

  const intentHash = adapter.sha256(intent);
  const executionHash = adapter.sha256(executionInput);
  approval.intent_hash = intentHash;

  const checksFromSourceboard = sourceboard.mapSourceboardToAdapterChecks(sourceboardResult);
  const exactMatch = intentHash === executionHash;
  const scopeValid = approval.scope === executionInput.action;
  const executionPathValid = executionInput.action === "draft_only_output";
  const allPassed = sourceboardResult.decision === "ALLOW" && exactMatch && scopeValid && executionPathValid;

  const validation = {
    decision: allPassed ? "ALLOW" : "BLOCK",
    checks: {
      intent_match: exactMatch,
      context_match: approval.intent_hash === intentHash,
      scope_valid: scopeValid,
      execution_path_valid: executionPathValid,
      authority_valid: checksFromSourceboard.authority_valid,
      accountability_path_valid: checksFromSourceboard.receipt_path_valid,
      five_core_valid: sourceboardResult.five_core.decision === "ALLOW",
    },
    policy_version: "sourceboard-real-receipt-demo-0.1.0",
  };

  return {
    receipt_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    intent_hash: intentHash,
    execution_hash: executionHash,
    mus_unit_id: config.mus_unit_id,
    validation,
    decision: validation.decision,
    approval,
    chain_reference: {
      previous_receipt_hash: previousReceiptHash,
    },
  };
}

function signReceiptBody(receiptBody, signingKey) {
  const privateKey = loadPrivateKey(signingKey);
  const publicKey = loadPublicKey(signingKey);
  const publicKeyHex = publicKey.export({ type: "spki", format: "der" }).toString("hex");
  const payload = adapter.canonicalize(receiptBody);
  const receiptHash = crypto.createHash("sha256").update(payload, "utf8").digest("hex");
  const signature = crypto.sign(null, Buffer.from(payload, "utf8"), privateKey).toString("hex");

  return {
    ...receiptBody,
    receipt_hash: receiptHash,
    signature,
    signature_algorithm: "Ed25519",
    public_key: publicKeyHex,
  };
}

function buildSignedDraftOnlyReceipt({ previousReceiptHash = null, musUnit } = {}) {
  const resolvedMusUnit = musUnit || requireInitializedMusUnit();
  const crossingPacket = buildDraftOnlyCrossingPacket();
  const receiptBody = buildReceiptBody({
    crossingPacket,
    config: resolvedMusUnit.config,
    previousReceiptHash,
  });
  const receipt = signReceiptBody(receiptBody, resolvedMusUnit.signingKey);
  const sourcepointReturn = adapter.returnReceiptToSourcePoint({
    crossingId: crossingPacket.crossing_id,
    receipt,
    chainStatus: "not_appended",
    signatureStatus: resolvedMusUnit.trustedKeys.includes(receipt.public_key) ? "trusted_key_present" : "untrusted_key",
  });

  return {
    crossingPacket,
    receipt,
    sourcepointReturn,
  };
}

function runRealReceiptDemo({ append = false } = {}) {
  const musUnit = requireInitializedMusUnit();
  const previousReceiptHash = ledger.getLastHash();
  const result = buildSignedDraftOnlyReceipt({ previousReceiptHash, musUnit });

  if (!checkAndRecordNonce(result.receipt.approval.nonce)) {
    throw new Error("Nonce replay detected; demo receipt not appended.");
  }

  if (append) {
    const entry = ledger.appendReceipt(result.receipt);
    const chain = verifyChain();
    result.ledgerEntry = entry;
    result.chain = chain;
    result.sourcepointReturn.chain_status = chain.valid ? "valid" : "invalid";
  }

  return result;
}

if (require.main === module) {
  const append = process.argv.includes("--append");
  const result = runRealReceiptDemo({ append });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  buildDraftOnlyCrossingPacket,
  buildConstitutionalInput,
  buildReceiptBody,
  signReceiptBody,
  buildSignedDraftOnlyReceipt,
  runRealReceiptDemo,
};
