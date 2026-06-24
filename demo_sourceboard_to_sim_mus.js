"use strict";

const sourceboard = require("./constitutional-sourceboard");
const adapter = require("./sim-mus-adapter");

function buildAllowedDraftOnlyDemo() {
  const crossingPacket = {
    crossing_id: "demo-crossing-001",
    sourcepoint_id: "human:demo",
    mandate_id: "mandate-demo-001",
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
  };

  const constitutionalInput = {
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

  const sourceboardResult = sourceboard.evaluateConstitutionalSourceboard(constitutionalInput);
  const intent = adapter.mapCrossingToIntent(crossingPacket);
  const approval = adapter.mapApprovalToReceiptApproval({
    authorizer: crossingPacket.sourcepoint_id,
    scope: crossingPacket.authority_scope,
    ttl: crossingPacket.ttl,
  }, intent);
  const executionInput = adapter.mapSentinelSurfaceToExecutionInput({
    action: "draft_only_output",
    target: "ONE_PRIVATE_DRAFT_SURFACE",
    parameters: {
      draft_text: "Private draft returned to SourcePoint.",
      external_consequence: false,
      memory_mutation: false,
    },
  });
  const checks = sourceboard.mapSourceboardToAdapterChecks(sourceboardResult);
  const validation = adapter.createAdapterValidation({
    simDecision: sourceboardResult.decision,
    checks: {
      ...checks,
      sentinel_verified: executionInput.parameters.external_consequence === false && executionInput.parameters.memory_mutation === false,
    },
  });
  const mockReceipt = {
    receipt_id: "demo-receipt-001",
    receipt_hash: adapter.sha256({ intent, executionInput, validation }),
    decision: validation.decision,
    validation,
  };
  const sourcepointReturn = adapter.returnReceiptToSourcePoint({
    crossingId: crossingPacket.crossing_id,
    receipt: mockReceipt,
    chainStatus: "not_checked_demo",
    signatureStatus: "not_checked_demo",
  });

  return {
    path: "SourceBoard -> SIM-MUS adapter -> receipt return",
    crossingPacket,
    sourceboardResult,
    intent,
    approval,
    executionInput,
    validation,
    mockReceipt,
    sourcepointReturn,
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildAllowedDraftOnlyDemo(), null, 2));
}

module.exports = {
  buildAllowedDraftOnlyDemo,
};
