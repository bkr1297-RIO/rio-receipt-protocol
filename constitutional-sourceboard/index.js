"use strict";

const DECISIONS = Object.freeze({
  ALLOW: "ALLOW",
  BLOCK: "BLOCK",
});

const CORE_IDS = Object.freeze(["C0", "C1", "C2", "C3", "C4"]);

function normalizeBoolean(value) {
  return value === true;
}

function evaluateTriSource(input = {}) {
  const authority = input.authority || {};
  const capacity = input.capacity || {};
  const accountability = input.accountability || {};

  const checks = {
    authority_present: Boolean(authority.sourcepoint_id || authority.authorizer),
    mandate_present: Boolean(authority.mandate_id || authority.approval_id),
    scope_present: Boolean(authority.scope || authority.authority_scope),
    capacity_declared: Boolean(capacity.operation || capacity.tool_access || capacity.execution_surface),
    accountability_path_present: Boolean(accountability.receipt_required || accountability.receipt_path_valid),
    return_path_present: Boolean(accountability.return_to_sourcepoint || accountability.return_path_present),
  };

  const passed = Object.values(checks).every(Boolean);

  return {
    decision: passed ? DECISIONS.ALLOW : DECISIONS.BLOCK,
    checks,
    failed_checks: Object.keys(checks).filter((key) => !checks[key]),
  };
}

function evaluateFiveCore(input = {}) {
  const cores = input.cores || {};

  const results = {
    C0: evaluateCore("C0", cores.C0, "root_constitution"),
    C1: evaluateCore("C1", cores.C1, "human_sovereign_charter"),
    C2: evaluateCore("C2", cores.C2, "interaction_covenant"),
    C3: evaluateCore("C3", cores.C3, "machine_execution_charter"),
    C4: evaluateCore("C4", cores.C4, "federation_jurisdiction_charter"),
  };

  const passed = CORE_IDS.every((coreId) => results[coreId].allowed === true);

  return {
    decision: passed ? DECISIONS.ALLOW : DECISIONS.BLOCK,
    intersection_rule: "all_cores_must_allow",
    results,
    blocking_cores: CORE_IDS.filter((coreId) => results[coreId].allowed !== true),
  };
}

function evaluateCore(coreId, coreInput, fallbackName) {
  if (!coreInput) {
    return {
      core_id: coreId,
      core_name: fallbackName,
      allowed: false,
      reason: "missing_core_evaluation",
    };
  }

  return {
    core_id: coreId,
    core_name: coreInput.name || fallbackName,
    allowed: normalizeBoolean(coreInput.allowed),
    reason: coreInput.reason || (coreInput.allowed ? "allowed" : "blocked"),
  };
}

function evaluateConstitutionalSourceboard(input = {}) {
  const trisource = evaluateTriSource(input.trisource || {});
  const fiveCore = evaluateFiveCore(input.five_core || {});
  const allowed = trisource.decision === DECISIONS.ALLOW && fiveCore.decision === DECISIONS.ALLOW;

  return {
    decision: allowed ? DECISIONS.ALLOW : DECISIONS.BLOCK,
    rule: "trisource_and_five_core_intersection",
    trisource,
    five_core: fiveCore,
  };
}

function mapSourceboardToAdapterChecks(sourceboardResult) {
  const allowed = sourceboardResult && sourceboardResult.decision === DECISIONS.ALLOW;

  return {
    authority_valid: Boolean(sourceboardResult && sourceboardResult.trisource && sourceboardResult.trisource.checks.authority_present),
    scope_valid: Boolean(sourceboardResult && sourceboardResult.trisource && sourceboardResult.trisource.checks.scope_present),
    context_valid: allowed,
    crossing_classified: allowed,
    sentinel_verified: allowed,
    receipt_path_valid: Boolean(sourceboardResult && sourceboardResult.trisource && sourceboardResult.trisource.checks.accountability_path_present),
  };
}

module.exports = {
  evaluateTriSource,
  evaluateFiveCore,
  evaluateConstitutionalSourceboard,
  mapSourceboardToAdapterChecks,
};
