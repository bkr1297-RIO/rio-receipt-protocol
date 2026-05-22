'use strict';

const assert = require('assert');
const crypto = require('crypto');

const {
  SPGM_OUTCOMES,
  RIO_DECISIONS,
} = require('../spgm/constants');
const {
  mapSpgmOutcomeToReceiptDecision,
  buildReceiptCompatibleValidation,
} = require('../spgm/map-spgm-to-receipt');

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  return '{' + Object.keys(obj).sort().map((key) => JSON.stringify(key) + ':' + canonicalize(obj[key])).join(',') + '}';
}

function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function baseRun(overrides = {}) {
  return {
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
    ...overrides,
  };
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS', name);
  } catch (err) {
    console.error('FAIL', name);
    console.error(err);
    process.exitCode = 1;
  }
}

test('SPG-M containment maps to BLOCK', () => {
  assert.strictEqual(mapSpgmOutcomeToReceiptDecision(baseRun({ outcome: SPGM_OUTCOMES.CONTAIN })), RIO_DECISIONS.BLOCK);
});

test('SPG-M refusal maps to BLOCK', () => {
  assert.strictEqual(mapSpgmOutcomeToReceiptDecision(baseRun({ outcome: SPGM_OUTCOMES.REFUSE })), RIO_DECISIONS.BLOCK);
});

test('SPG-M escalation maps to BLOCK', () => {
  assert.strictEqual(mapSpgmOutcomeToReceiptDecision(baseRun({ outcome: SPGM_OUTCOMES.ESCALATE })), RIO_DECISIONS.BLOCK);
});

test('SPG-M failure maps to BLOCK', () => {
  assert.strictEqual(mapSpgmOutcomeToReceiptDecision(baseRun({ outcome: SPGM_OUTCOMES.FAIL })), RIO_DECISIONS.BLOCK);
});

test('symbolic interpretation alone never produces ALLOW', () => {
  const decision = mapSpgmOutcomeToReceiptDecision(baseRun({
    outcome: SPGM_OUTCOMES.PROCEED,
    human_authorized: false,
    existing_receipt_checks_pass: true,
    consequence_class: 1,
  }));
  assert.strictEqual(decision, RIO_DECISIONS.BLOCK);
});

test('machine-assisted interpretation is metadata, not authority', () => {
  const validation = buildReceiptCompatibleValidation(baseRun({
    outcome: SPGM_OUTCOMES.CONTAIN,
    machine_assistance_used: true,
    machine_role: 'map',
  }));
  assert.strictEqual(validation.decision, RIO_DECISIONS.BLOCK);
  assert.strictEqual(validation.spgm.machine_assistance_used, true);
  assert.strictEqual(validation.spgm.machine_role, 'map');
});

test('SPG-M metadata is hash-bound when placed under validation', () => {
  const validation = buildReceiptCompatibleValidation(baseRun({ outcome: SPGM_OUTCOMES.CONTAIN }));
  const body = {
    receipt_id: '00000000-0000-4000-8000-000000000001',
    timestamp: '2026-05-22T00:00:00.000Z',
    intent_hash: 'a'.repeat(64),
    execution_hash: 'b'.repeat(64),
    validation,
    decision: validation.decision,
    approval: {
      approval_id: '00000000-0000-4000-8000-000000000002',
      intent_hash: 'a'.repeat(64),
      authorizer: 'human:test',
      nonce: '00000000-0000-4000-8000-000000000003',
    },
    chain_reference: { previous_receipt_hash: null },
  };
  const originalHash = sha256(canonicalize(body));
  body.validation.spgm.containment_reason = 'changed';
  const changedHash = sha256(canonicalize(body));
  assert.notStrictEqual(originalHash, changedHash);
});

test('authorized low-risk proceed may map to ALLOW only when checks pass', () => {
  const decision = mapSpgmOutcomeToReceiptDecision(baseRun({
    outcome: SPGM_OUTCOMES.PROCEED,
    consequence_class: 1,
    human_authorized: true,
    existing_receipt_checks_pass: true,
    containment_applied: true,
  }));
  assert.strictEqual(decision, RIO_DECISIONS.ALLOW);
});

test('no new decision enum is required', () => {
  const decisions = new Set([
    mapSpgmOutcomeToReceiptDecision(baseRun({ outcome: SPGM_OUTCOMES.HOLD })),
    mapSpgmOutcomeToReceiptDecision(baseRun({ outcome: SPGM_OUTCOMES.CONTAIN })),
    mapSpgmOutcomeToReceiptDecision(baseRun({
      outcome: SPGM_OUTCOMES.PROCEED,
      consequence_class: 1,
      human_authorized: true,
      existing_receipt_checks_pass: true,
    })),
  ]);
  assert.deepStrictEqual([...decisions].sort(), [RIO_DECISIONS.ALLOW, RIO_DECISIONS.BLOCK].sort());
});

test('existing ALLOW/BLOCK model remains intact', () => {
  const validation = buildReceiptCompatibleValidation(baseRun({ outcome: SPGM_OUTCOMES.CONTAIN }), {
    checks: {
      intent_match: false,
      context_match: true,
      scope_valid: false,
      execution_path_valid: true,
    },
    policy_version: '1.0.0',
  });
  assert.strictEqual(validation.decision, RIO_DECISIONS.BLOCK);
  assert.strictEqual(validation.checks.intent_match, false);
  assert.strictEqual(validation.checks.context_match, true);
});

if (process.exitCode) {
  console.error('SPG-M receipt mapping tests failed.');
} else {
  console.log(`SPG-M receipt mapping tests passed: ${passed}/10`);
}
