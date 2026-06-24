"use strict";

const crypto = require("crypto");

const sourceboard = require("./constitutional-sourceboard");
const adapter = require("./sim-mus-adapter");
const realReceiptDemo = require("./demo_sourceboard_to_real_receipt");

function baseCrossingPacket(overrides = {}) {
  return {
    crossing_id: "blocked-demo-crossing-001",
    sourcepoint_id: "human:demo",
    mandate_id: "blocked-demo-mandate-001",
    requested_operation: "draft_only_output",
    crossing_type: "signal_to_draft_output",
    target_surface: "ONE_PRIVATE_DRAFT_SURFACE",
    authority_scope: "draft_only_output",
    external_consequence: false,
    memory_mutation: false,
    tool_access: "none",
    risk_tier: "low",
    ttl: 300,
    required_receipt_type: "blocked_crossing_return",
    ...overrides,
  };
}

function baseConstitutionalInput(crossingPacket, overrides = {}) {
  const input = {
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

  if (overrides.trisource) {
    input.trisource = {
      ...input.trisource,
      ...overrides.trisource,
    };
  }
  if (overrides.five_core && overrides.five_core.cores) {
    input.five_core.cores = {
      ...input.five_core.cores,
      ...overrides.five_core.cores,
    };
  }

  return input;
}

const BLOCKED_CASES = Object.freeze({
  missing_accountability: {
    label: "missing_accountability",
    reason: "accountability path missing",
    build() {
      const crossingPacket = baseCrossingPacket({ crossing_id: "blocked-missing-accountability" });
      const constitutionalInput = baseConstitutionalInput(crossingPacket, {
        trisource: {
          accountability: {},
        },
      });
      return { crossingPacket, constitutionalInput };
    },
  },
  c3_machine_execution_block: {
    label: "c3_machine_execution_block",
    reason: "C3 Machine Execution Charter blocks",
    build() {
      const crossingPacket = baseCrossingPacket({ crossing_id: "blocked-c3-machine-execution" });
      const constitutionalInput = baseConstitutionalInput(crossingPacket, {
        five_core: {
          cores: {
            C3: { allowed: false, reason: "machine execution exceeds approved packet" },
          },
        },
      });
      return { crossingPacket, constitutionalInput };
    },
  },
  draft_memory_mutation: {
    label: "draft_memory_mutation",
    reason: "draft-only crossing attempted memory mutation",
    build() {
      const crossingPacket = baseCrossingPacket({ crossing_id: "blocked-draft-memory-mutation" });
      const constitutionalInput = baseConstitutionalInput(crossingPacket);
      return { crossingPacket, constitutionalInput };
    },
  },
});

function buildExecutionInputForCase(caseName, intent) {
  if (caseName === "draft_memory_mutation") {
    return adapter.mapSentinelSurfaceToExecutionInput({
      action: "draft_only_output",
      target: "ONE_PRIVATE_DRAFT_SURFACE",
      parameters: {
        ...intent.parameters,
        draft_text: "Private draft returned to SourcePoint.",
        memory_mutation: true,
      },
    });
  }

  return { ...intent };
}

function buildBlockedReceiptBody({ caseName, config, previousReceiptHash = null }) {
  if (!BLOCKED_CASES[caseName]) {
    throw new Error(`Unknown blocked case: ${caseName}`);
  }

  const scenario = BLOCKED_CASES[caseName];
  const { crossingPacket, constitutionalInput } = scenario.build();
  const sourceboardResult = sourceboard.evaluateConstitutionalSourceboard(constitutionalInput);
  const intent = adapter.mapCrossingToIntent(crossingPacket);
  const executionInput = buildExecutionInputForCase(caseName, intent);
  const approval = adapter.mapApprovalToReceiptApproval({
    authorizer: crossingPacket.sourcepoint_id,
    scope: crossingPacket.authority_scope,
    ttl: crossingPacket.ttl,
  }, intent);

  const intentHash = adapter.sha256(intent);
  const executionHash = adapter.sha256(executionInput);
  approval.intent_hash = intentHash;

  const exactMatch = intentHash === executionHash;
  const checksFromSourceboard = sourceboard.mapSourceboardToAdapterChecks(sourceboardResult);
  const scopeValid = approval.scope === executionInput.action;
  const executionPathValid = executionInput.action === "draft_only_output" && executionInput.parameters.memory_mutation !== true;
  const blocked = sourceboardResult.decision !== "ALLOW" || !exactMatch || !scopeValid || !executionPathValid;

  const validation = {
    decision: blocked ? "BLOCK" : "ALLOW",
    checks: {
      intent_match: exactMatch,
      context_match: approval.intent_hash === intentHash,
      scope_valid: scopeValid,
      execution_path_valid: executionPathValid,
      authority_valid: checksFromSourceboard.authority_valid,
      accountability_path_valid: checksFromSourceboard.receipt_path_valid,
      five_core_valid: sourceboardResult.five_core.decision === "ALLOW",
      blocked_crossing_returned: blocked,
    },
    policy_version: "blocked-crossing-receipt-demo-0.1.0",
  };

  return {
    receipt_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    intent_hash: intentHash,
    execution_hash: executionHash,
    mus_unit_id: config.mus_unit_id,
    validation,
    decision: validation.decision,
    approval,
    chain_reference: {
      previous_receipt_hash: previousReceiptHash,
    },
    blocked_case: scenario.label,
    block_reason: scenario.reason,
  };
}

function bodyForSigning(receiptBody) {
  const { blocked_case, block_reason, ...signedBody } = receiptBody;
  return signedBody;
}

function signBlockedReceiptBody(receiptBody, signingKey) {
  const signedBody = bodyForSigning(receiptBody);
  const signedReceipt = realReceiptDemo.signReceiptBody(signedBody, signingKey);

  return {
    ...signedReceipt,
    blocked_case: receiptBody.blocked_case,
    block_reason: receiptBody.block_reason,
  };
}

function buildSignedBlockedReceipt({ caseName, musUnit, previousReceiptHash = null }) {
  const receiptBody = buildBlockedReceiptBody({
    caseName,
    config: musUnit.config,
    previousReceiptHash,
  });
  const receipt = signBlockedReceiptBody(receiptBody, musUnit.signingKey);
  const crossingId = BLOCKED_CASES[caseName].build().crossingPacket.crossing_id;
  const sourcepointReturn = adapter.returnReceiptToSourcePoint({
    crossingId,
    receipt,
    chainStatus: "not_appended",
    signatureStatus: musUnit.trustedKeys.includes(receipt.public_key) ? "trusted_key_present" : "untrusted_key",
  });

  return {
    receipt,
    sourcepointReturn,
  };
}

function buildAllBlockedReceipts({ musUnit, previousReceiptHash = null }) {
  return Object.keys(BLOCKED_CASES).map((caseName) => {
    return buildSignedBlockedReceipt({ caseName, musUnit, previousReceiptHash });
  });
}

if (require.main === module) {
  console.log(JSON.stringify({
    message: "This module is a testable blocked-crossing receipt demo. Use test/blocked-crossing-receipt-demo.test.js.",
    cases: Object.keys(BLOCKED_CASES),
  }, null, 2));
}

module.exports = {
  BLOCKED_CASES,
  baseCrossingPacket,
  baseConstitutionalInput,
  buildBlockedReceiptBody,
  signBlockedReceiptBody,
  buildSignedBlockedReceipt,
  buildAllBlockedReceipts,
};
