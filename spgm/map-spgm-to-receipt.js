'use strict';

const {
  RIO_DECISIONS,
  SPGM_OUTCOMES,
  SPGM_POLICY_VERSION,
} = require('./constants');
const {
  buildSpgmChecks,
  allSpgmChecksPass,
  getFailedSpgmChecks,
} = require('./spgm-checks');

const SPGM_PROFILE = 'SPG-M';
const SPGM_PROFILE_VERSION = '0.1';

const BLOCKING_OUTCOMES = Object.freeze([
  SPGM_OUTCOMES.HOLD,
  SPGM_OUTCOMES.CONTAIN,
  SPGM_OUTCOMES.REFUSE,
  SPGM_OUTCOMES.ESCALATE,
  SPGM_OUTCOMES.FAIL,
]);

function normalizeOutcome(outcome) {
  if (!outcome) return SPGM_OUTCOMES.HOLD;
  const normalized = String(outcome).toUpperCase();
  return Object.values(SPGM_OUTCOMES).includes(normalized)
    ? normalized
    : SPGM_OUTCOMES.HOLD;
}

function isLowRiskOrGoverned(spgmRun = {}) {
  const cls = spgmRun.consequence_class;
  if (Number.isInteger(cls) && cls <= 2) return true;
  return spgmRun.rio_completed === true && spgmRun.muss_completed !== false;
}

function canMapProceedToAllow(spgmRun = {}, checks = buildSpgmChecks(spgmRun)) {
  const outcome = normalizeOutcome(spgmRun.outcome);

  return (
    outcome === SPGM_OUTCOMES.PROCEED &&
    spgmRun.human_authorized === true &&
    spgmRun.existing_receipt_checks_pass === true &&
    isLowRiskOrGoverned(spgmRun) &&
    allSpgmChecksPass(checks)
  );
}

function mapSpgmOutcomeToReceiptDecision(spgmRun = {}) {
  const outcome = normalizeOutcome(spgmRun.outcome);
  const checks = buildSpgmChecks(spgmRun);

  if (BLOCKING_OUTCOMES.includes(outcome)) return RIO_DECISIONS.BLOCK;
  if (canMapProceedToAllow(spgmRun, checks)) return RIO_DECISIONS.ALLOW;
  return RIO_DECISIONS.BLOCK;
}

function buildSpgmMetadata(spgmRun = {}, checks = buildSpgmChecks(spgmRun)) {
  const outcome = normalizeOutcome(spgmRun.outcome);

  return {
    profile: SPGM_PROFILE,
    profile_version: SPGM_PROFILE_VERSION,
    policy_version: SPGM_POLICY_VERSION,
    outcome,
    consequence_class: Number.isInteger(spgmRun.consequence_class)
      ? spgmRun.consequence_class
      : null,
    containment_reason: spgmRun.containment_reason || null,
    refusal_reason: spgmRun.refusal_reason || null,
    escalation_reason: spgmRun.escalation_reason || null,
    failure_reason: spgmRun.failure_reason || null,
    rio_routing_status: spgmRun.rio_routing_status || 'not_required_or_not_provided',
    muss_routing_status: spgmRun.muss_routing_status || 'not_required_or_not_provided',
    machine_assistance_used: spgmRun.machine_assistance_used === true,
    machine_role: spgmRun.machine_role || null,
    failed_spgm_checks: getFailedSpgmChecks(checks),
    doctrine_attestation: {
      no_pattern_outranks_human_sovereignty: spgmRun.human_authority_preserved === true,
      meaning_may_arrive_uninvited_authority_does_not: spgmRun.no_symbolic_authority === true,
      signal_is_not_command: spgmRun.signal_not_command === true,
      interpretation_is_provisional: spgmRun.interpretation_provisional === true,
      consequence_determines_governance_weight: Number.isInteger(spgmRun.consequence_class),
      machine_assistance_is_bounded: spgmRun.machine_boundary_preserved === true,
      recurrence_is_not_proof: spgmRun.recurrence_not_proof !== false,
      pattern_promotion_does_not_create_authority: spgmRun.pattern_promotion_not_authority !== false,
    },
  };
}

function buildReceiptCompatibleValidation(spgmRun = {}, baseValidation = {}) {
  const spgmChecks = buildSpgmChecks(spgmRun);
  const decision = mapSpgmOutcomeToReceiptDecision(spgmRun);

  return {
    decision,
    checks: {
      ...(baseValidation.checks || {}),
      ...spgmChecks,
    },
    policy_version: baseValidation.policy_version || '1.0.0',
    spgm: buildSpgmMetadata(spgmRun, spgmChecks),
  };
}

function buildReceiptCompatibleContext(spgmRun = {}) {
  const validation = buildReceiptCompatibleValidation(spgmRun, spgmRun.base_validation || {});

  return {
    receipt_decision: validation.decision,
    validation,
    profile_context: {
      profile: SPGM_PROFILE,
      profile_version: SPGM_PROFILE_VERSION,
      symbolic_signal_summary: spgmRun.symbolic_signal_summary || null,
      provisional_interpretation_summary: spgmRun.provisional_interpretation_summary || null,
      proposed_action_summary: spgmRun.proposed_action_summary || null,
      boundary: 'SPG-M profile context is metadata for receipt-compatible proof. It does not create authority.',
    },
  };
}

module.exports = {
  normalizeOutcome,
  mapSpgmOutcomeToReceiptDecision,
  canMapProceedToAllow,
  buildSpgmMetadata,
  buildReceiptCompatibleValidation,
  buildReceiptCompatibleContext,
};
