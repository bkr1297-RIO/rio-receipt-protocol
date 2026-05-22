'use strict';

/**
 * SPG-M constants.
 *
 * SPG-M is a receipt-compatible Pattern Governance profile for RIO.
 * It does not change core receipt cryptography, ALLOW/BLOCK semantics,
 * canonicalization, ledger behavior, or validation behavior.
 */

const RIO_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  BLOCK: 'BLOCK',
});

const SPGM_OUTCOMES = Object.freeze({
  PROCEED: 'PROCEED',
  HOLD: 'HOLD',
  CONTAIN: 'CONTAIN',
  REFUSE: 'REFUSE',
  ESCALATE: 'ESCALATE',
  FAIL: 'FAIL',
});

const SPGM_CHECKS = Object.freeze({
  HUMAN_AUTHORITY_PRESERVED: 'spgm_human_authority_preserved',
  SIGNAL_NOT_COMMAND: 'spgm_signal_not_command',
  INTERPRETATION_PROVISIONAL: 'spgm_interpretation_provisional',
  FACT_SYMBOL_SEPARATED: 'spgm_fact_symbol_separated',
  MACHINE_BOUNDARY_PRESERVED: 'spgm_machine_boundary_preserved',
  CONSEQUENCE_CLASSIFIED: 'spgm_consequence_classified',
  RIO_MUSS_ROUTING_IDENTIFIED: 'spgm_rio_muss_routing_identified',
  RECURRENCE_NOT_PROOF: 'spgm_recurrence_not_proof',
  PATTERN_PROMOTION_NOT_AUTHORITY: 'spgm_pattern_promotion_not_authority',
  CONTAINMENT_APPLIED: 'spgm_containment_applied',
});

const SPGM_POLICY_VERSION = '0.1.0';

module.exports = {
  RIO_DECISIONS,
  SPGM_OUTCOMES,
  SPGM_CHECKS,
  SPGM_POLICY_VERSION,
};
