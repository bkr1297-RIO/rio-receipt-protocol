"use strict";

const assert = require("assert");
const adapter = require("../sim-mus-adapter");

function baseCrossing(overrides = {}) {
  return {
    crossing_id: "crossing-001",
    sourcepoint_id: "human:test",
    mandate_id: "mandate-001",
    requested_operation: "draft_only_output",
    crossing_type: "signal_to_draft_output",
    target_surface: "ONE_PRIVATE_DRAFT_SURFACE",
    authority_scope: "draft_only_output",
    external_consequence: false,
    memory_mutation: false,
    tool_access: "none",
    risk_tier: "low",
    ttl: 300,
    required_receipt_type: "draft_return",
    ...overrides,
  };
}

function testExactOperationAllowed() {
  const crossing = baseCrossing({
    requested_operation: "controlled_operation",
    crossing_type: "approved_external_operation",
    target_surface: "APPROVED_TARGET",
    authority_scope: "controlled_operation",
    external_consequence: true,
    tool_access: "approved_capability",
    risk_tier: "medium",
  });

  const intent = adapter.mapCrossingToIntent(crossing);
  const approval = adapter.mapApprovalToReceiptApproval({
    authorizer: "human:test",
    scope: "controlled_operation",
    ttl: 300,
  }, intent);
  const executionInput = adapter.mapSentinelSurfaceToExecutionInput({
    action: "controlled_operation",
    target: "APPROVED_TARGET",
    parameters: intent.parameters,
  });
  const validation = adapter.createAdapterValidation({
    simDecision: "ALLOW",
    checks: {
      authority_valid: true,
      scope_valid: approval.scope === executionInput.action,
      context_valid: true,
      crossing_classified: true,
      sentinel_verified: true,
      receipt_path_valid: true,
    },
  });

  assert.strictEqual(intent.action, "controlled_operation");
  assert.strictEqual(approval.scope, "controlled_operation");
  assert.strictEqual(executionInput.action, "controlled_operation");
  assert.strictEqual(validation.decision, "ALLOW");
}

function testOperationDriftBlocked() {
  const decision = adapter.mapDecisionToReceiptDecision("DENY");
  const denial = adapter.createDenialReceiptInput({
    crossingId: "crossing-drift",
    simDecision: "DENY",
    blockReason: "sentinel_mismatch",
    checks: {
      authority_valid: true,
      scope_valid: false,
      context_valid: true,
      crossing_classified: true,
      sentinel_verified: false,
      receipt_path_valid: true,
    },
  });

  assert.strictEqual(decision, "BLOCK");
  assert.strictEqual(denial.decision, "BLOCK");
  assert.strictEqual(denial.block_reason, "sentinel_mismatch");
  assert.strictEqual(denial.checks.sentinel_verified, false);
}

function testDraftOnlyAllowed() {
  const crossing = baseCrossing();
  const intent = adapter.mapCrossingToIntent(crossing);
  const executionInput = adapter.mapSentinelSurfaceToExecutionInput({
    action: "draft_only_output",
    target: "ONE_PRIVATE_DRAFT_SURFACE",
    parameters: {
      draft_text: "Private draft returned to SourcePoint.",
      external_consequence: false,
      memory_mutation: false,
    },
  });
  const validation = adapter.createAdapterValidation({
    simDecision: "ALLOW",
    checks: {
      authority_valid: true,
      scope_valid: true,
      context_valid: true,
      crossing_classified: intent.parameters.crossing_type === "signal_to_draft_output",
      sentinel_verified: executionInput.parameters.external_consequence === false && executionInput.parameters.memory_mutation === false,
      receipt_path_valid: true,
    },
  });

  assert.strictEqual(intent.action, "draft_only_output");
  assert.strictEqual(intent.parameters.external_consequence, false);
  assert.strictEqual(intent.parameters.memory_mutation, false);
  assert.strictEqual(validation.decision, "ALLOW");
}

function testDraftMutationBlocked() {
  const executionInput = adapter.mapSentinelSurfaceToExecutionInput({
    action: "draft_only_output",
    target: "ONE_PRIVATE_DRAFT_SURFACE",
    parameters: {
      draft_text: "Private draft returned to SourcePoint.",
      external_consequence: false,
      memory_mutation: true,
    },
  });
  const mutationDetected = executionInput.parameters.memory_mutation === true;
  const validation = adapter.createAdapterValidation({
    simDecision: mutationDetected ? "DENY" : "ALLOW",
    checks: {
      authority_valid: true,
      scope_valid: true,
      context_valid: true,
      crossing_classified: true,
      sentinel_verified: !mutationDetected,
      receipt_path_valid: true,
    },
  });

  assert.strictEqual(validation.decision, "BLOCK");
  assert.strictEqual(validation.checks.sentinel_verified, false);
}

function testReceiptReturnSummary() {
  const summary = adapter.returnReceiptToSourcePoint({
    crossingId: "crossing-001",
    receipt: {
      receipt_id: "receipt-001",
      receipt_hash: "abc123",
      decision: "ALLOW",
    },
    chainStatus: "valid",
    signatureStatus: "valid",
  });

  assert.strictEqual(summary.crossing_id, "crossing-001");
  assert.strictEqual(summary.decision, "ALLOW");
  assert.strictEqual(summary.return_status, "returned_to_sourcepoint");
  assert.ok(summary.next_available_actions.includes("revise"));
}

testExactOperationAllowed();
testOperationDriftBlocked();
testDraftOnlyAllowed();
testDraftMutationBlocked();
testReceiptReturnSummary();

console.log("SIM-MUS adapter tests passed");
