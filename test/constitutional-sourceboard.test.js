"use strict";

const assert = require("assert");
const sourceboard = require("../constitutional-sourceboard");
const adapter = require("../sim-mus-adapter");

function allowAllCores() {
  return {
    C0: { allowed: true, reason: "root rules satisfied" },
    C1: { allowed: true, reason: "human authority present" },
    C2: { allowed: true, reason: "interaction lane valid" },
    C3: { allowed: true, reason: "machine execution bounded" },
    C4: { allowed: true, reason: "jurisdiction constraints satisfied" },
  };
}

function completeTriSource() {
  return {
    authority: {
      sourcepoint_id: "human:test",
      mandate_id: "mandate-001",
      scope: "draft_only_output",
    },
    capacity: {
      operation: "draft_only_output",
      execution_surface: "ONE_PRIVATE_DRAFT_SURFACE",
    },
    accountability: {
      receipt_required: true,
      return_to_sourcepoint: true,
    },
  };
}

function testTriSourceAllowsCompleteInput() {
  const result = sourceboard.evaluateTriSource(completeTriSource());

  assert.strictEqual(result.decision, "ALLOW");
  assert.deepStrictEqual(result.failed_checks, []);
}

function testTriSourceBlocksMissingAccountability() {
  const result = sourceboard.evaluateTriSource({
    authority: {
      sourcepoint_id: "human:test",
      mandate_id: "mandate-001",
      scope: "send_email",
    },
    capacity: {
      operation: "send_email",
    },
    accountability: {},
  });

  assert.strictEqual(result.decision, "BLOCK");
  assert.ok(result.failed_checks.includes("accountability_path_present"));
  assert.ok(result.failed_checks.includes("return_path_present"));
}

function testFiveCoreAllowsOnlyIntersection() {
  const result = sourceboard.evaluateFiveCore({
    cores: allowAllCores(),
  });

  assert.strictEqual(result.decision, "ALLOW");
  assert.deepStrictEqual(result.blocking_cores, []);
}

function testFiveCoreBlocksIfOneCoreBlocks() {
  const cores = allowAllCores();
  cores.C3 = { allowed: false, reason: "machine execution exceeds packet" };

  const result = sourceboard.evaluateFiveCore({ cores });

  assert.strictEqual(result.decision, "BLOCK");
  assert.deepStrictEqual(result.blocking_cores, ["C3"]);
}

function testSourceboardFeedsAdapterChecks() {
  const result = sourceboard.evaluateConstitutionalSourceboard({
    trisource: completeTriSource(),
    five_core: { cores: allowAllCores() },
  });
  const checks = sourceboard.mapSourceboardToAdapterChecks(result);
  const validation = adapter.createAdapterValidation({
    simDecision: result.decision,
    checks,
  });

  assert.strictEqual(result.decision, "ALLOW");
  assert.strictEqual(validation.decision, "ALLOW");
  assert.strictEqual(validation.checks.authority_valid, true);
  assert.strictEqual(validation.checks.receipt_path_valid, true);
}

function testSourceboardBlockFeedsAdapterBlock() {
  const cores = allowAllCores();
  cores.C1 = { allowed: false, reason: "human scope missing" };

  const result = sourceboard.evaluateConstitutionalSourceboard({
    trisource: completeTriSource(),
    five_core: { cores },
  });
  const checks = sourceboard.mapSourceboardToAdapterChecks(result);
  const validation = adapter.createAdapterValidation({
    simDecision: result.decision,
    checks,
  });

  assert.strictEqual(result.decision, "BLOCK");
  assert.strictEqual(validation.decision, "BLOCK");
  assert.deepStrictEqual(result.five_core.blocking_cores, ["C1"]);
}

testTriSourceAllowsCompleteInput();
testTriSourceBlocksMissingAccountability();
testFiveCoreAllowsOnlyIntersection();
testFiveCoreBlocksIfOneCoreBlocks();
testSourceboardFeedsAdapterChecks();
testSourceboardBlockFeedsAdapterBlock();

console.log("Constitutional SourceBoard tests passed");
