'use strict';

/**
 * SPG-M demo runner.
 *
 * Creates a receipt-compatible SPG-M containment receipt using the existing
 * RIO receipt shape, signs it with the local MUS key, and appends it to the
 * existing hash-chain ledger.
 *
 * Run `npm run init -- --owner "human:your-name"` before this demo.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { appendReceipt, getLastHash } = require('../ledger');
const {
  SPGM_OUTCOMES,
} = require('../spgm/constants');
const {
  buildReceiptCompatibleValidation,
} = require('../spgm/map-spgm-to-receipt');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'mus-unit.json');
const SIGNING_KEY_PATH = path.join(__dirname, '..', 'trust', 'signing_key.json');
const NONCE_STORE_PATH = path.join(__dirname, '..', 'runtime', 'nonce_store.json');

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonicalize(obj[key])).join(',') + '}';
}

function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadLocalConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('Local MUS config not found. Run npm run init first.');
  }
  return readJson(CONFIG_PATH);
}

function loadSigningKey() {
  if (!fs.existsSync(SIGNING_KEY_PATH)) {
    throw new Error('Signing key not found. Run npm run init first.');
  }

  const stored = readJson(SIGNING_KEY_PATH);
  return {
    privateKey: crypto.createPrivateKey({
      key: Buffer.from(stored.private_key, 'hex'),
      format: 'der',
      type: 'pkcs8',
    }),
    publicKeyHex: stored.public_key,
  };
}

function loadNonceStore() {
  if (!fs.existsSync(NONCE_STORE_PATH)) return { used_nonces: [] };
  return readJson(NONCE_STORE_PATH);
}

function saveNonceStore(store) {
  fs.mkdirSync(path.dirname(NONCE_STORE_PATH), { recursive: true });
  fs.writeFileSync(NONCE_STORE_PATH, JSON.stringify(store, null, 2) + '\n');
}

function recordNonce(nonce) {
  const store = loadNonceStore();
  if (store.used_nonces.includes(nonce)) {
    throw new Error('Nonce replay detected. Demo receipt blocked.');
  }
  store.used_nonces.push(nonce);
  saveNonceStore(store);
}

function sign(payload, privateKey) {
  return crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('hex');
}

function buildReceipt({ intent, executionInput, approval, validation, previousReceiptHash, musUnitId, privateKey, publicKeyHex }) {
  const receiptBody = {
    receipt_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    intent_hash: sha256(canonicalize(intent)),
    execution_hash: sha256(canonicalize(executionInput)),
    ...(musUnitId ? { mus_unit_id: musUnitId } : {}),
    validation,
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
  return {
    ...receiptBody,
    receipt_hash: sha256(payload),
    signature: sign(payload, privateKey),
    signature_algorithm: 'Ed25519',
    public_key: publicKeyHex,
  };
}

function main() {
  const config = loadLocalConfig();
  const { privateKey, publicKeyHex } = loadSigningKey();

  const intent = {
    action: 'send_email',
    target: 'example@example.com',
    parameters: {
      subject: 'SPG-M demo',
      body: 'This action is intentionally contained by the SPG-M profile.',
    },
  };

  const executionInput = {
    action: 'send_email',
    target: 'external@example.com',
    parameters: {
      subject: 'SPG-M demo',
      body: 'This proposed action is blocked because symbolic signal does not authorize action.',
    },
  };

  const nonce = crypto.randomUUID();
  const intentHash = sha256(canonicalize(intent));
  const approval = {
    approval_id: crypto.randomUUID(),
    intent_hash: intentHash,
    authorizer: config.owner || 'human:local',
    nonce,
    scope: 'send_email',
  };

  recordNonce(nonce);

  const validation = buildReceiptCompatibleValidation({
    outcome: SPGM_OUTCOMES.CONTAIN,
    consequence_class: 3,
    human_authority_preserved: true,
    signal_not_command: true,
    interpretation_provisional: true,
    fact_symbol_separated: true,
    machine_boundary_preserved: true,
    containment_applied: true,
    recurrence_not_proof: true,
    pattern_promotion_not_authority: true,
    rio_muss_routing_identified: true,
    machine_assistance_used: true,
    machine_role: 'map',
    symbolic_signal_summary: 'Human reported a meaningful signal around a proposed external action.',
    provisional_interpretation_summary: 'Signal may orient reflection, but does not authorize action.',
    proposed_action_summary: 'send_email to external recipient',
    containment_reason: 'SPG-M containment: signal is not command and external action requires governance.',
    rio_routing_status: 'required_before_external_action',
    muss_routing_status: 'required_if_consent_scope_or_memory_implicated',
    base_validation: {
      checks: {
        intent_match: false,
        context_match: true,
        scope_valid: false,
        execution_path_valid: true,
      },
      policy_version: '1.0.0',
    },
  });

  const receipt = buildReceipt({
    intent,
    executionInput,
    approval,
    validation,
    previousReceiptHash: getLastHash(),
    musUnitId: config.mus_unit_id,
    privateKey,
    publicKeyHex,
  });

  const entry = appendReceipt(receipt);

  console.log('=== SPG-M DEMO ===');
  console.log('Decision:', receipt.decision);
  console.log('SPG-M outcome:', receipt.validation.spgm.outcome);
  console.log('Receipt hash:', receipt.receipt_hash);
  console.log('Previous hash:', entry.previous_receipt_hash);
  console.log('Ledger appended:', true);
}

main();
