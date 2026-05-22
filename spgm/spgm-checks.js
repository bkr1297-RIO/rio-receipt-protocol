'use strict';

const { SPGM_CHECKS } = require('./constants');

function asBoolean(value) {
  return value === true;
}

function isConsequenceClass(value) {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

function buildSpgmChecks(spgmRun = {}) {
  const consequenceClassified = isConsequenceClass(spgmRun.consequence_class);

  return {
    [SPGM_CHECKS.HUMAN_AUTHORITY_PRESERVED]: asBoolean(spgmRun.human_authority_preserved),
    [SPGM_CHECKS.SIGNAL_NOT_COMMAND]: asBoolean(spgmRun.signal_not_command),
    [SPGM_CHECKS.INTERPRETATION_PROVISIONAL]: asBoolean(spgmRun.interpretation_provisional),
    [SPGM_CHECKS.FACT_SYMBOL_SEPARATED]: asBoolean(spgmRun.fact_symbol_separated),
    [SPGM_CHECKS.MACHINE_BOUNDARY_PRESERVED]: asBoolean(spgmRun.machine_boundary_preserved),
    [SPGM_CHECKS.CONSEQUENCE_CLASSIFIED]: consequenceClassified,
    [SPGM_CHECKS.RIO_MUSS_ROUTING_IDENTIFIED]: spgmRun.rio_muss_routing_identified !== false,
    [SPGM_CHECKS.RECURRENCE_NOT_PROOF]: spgmRun.recurrence_not_proof !== false,
    [SPGM_CHECKS.PATTERN_PROMOTION_NOT_AUTHORITY]: spgmRun.pattern_promotion_not_authority !== false,
    [SPGM_CHECKS.CONTAINMENT_APPLIED]: spgmRun.outcome === 'CONTAIN' ? asBoolean(spgmRun.containment_applied) : true,
  };
}

function allSpgmChecksPass(checks = {}) {
  return Object.values(checks).every((value) => value === true);
}

function getFailedSpgmChecks(checks = {}) {
  return Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
}

module.exports = {
  buildSpgmChecks,
  allSpgmChecksPass,
  getFailedSpgmChecks,
};
