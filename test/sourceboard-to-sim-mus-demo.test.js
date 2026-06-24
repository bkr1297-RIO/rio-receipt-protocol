"use strict";

const assert = require("assert");
const demo = require("../demo_sourceboard_to_sim_mus");

function testAllowedDraftOnlyEndToEndDemo() {
  const result = demo.buildAllowedDraftOnlyDemo();

  assert.strictEqual(result.path, "SourceBoard -> SIM-MUS adapter -> receipt return");
  assert.strictEqual(result.sourceboardResult.decision, "ALLOW");
  assert.strictEqual(result.intent.action, "draft_only_output");
  assert.strictEqual(result.intent.parameters.external_consequence, false);
  assert.strictEqual(result.intent.parameters.memory_mutation, false);
  assert.strictEqual(result.executionInput.action, "draft_only_output");
  assert.strictEqual(result.executionInput.parameters.external_consequence, false);
  assert.strictEqual(result.executionInput.parameters.memory_mutation, false);
  assert.strictEqual(result.validation.decision, "ALLOW");
  assert.strictEqual(result.mockReceipt.decision, "ALLOW");
  assert.strictEqual(result.sourcepointReturn.crossing_id, "demo-crossing-001");
  assert.strictEqual(result.sourcepointReturn.decision, "ALLOW");
  assert.strictEqual(result.sourcepointReturn.return_status, "returned_to_sourcepoint");
}

testAllowedDraftOnlyEndToEndDemo();

console.log("SourceBoard to SIM-MUS demo test passed");
