"use strict";

const crypto = require("crypto");

const RECEIPT_DECISIONS = Object.freeze({
  ALLOW: "ALLOW",
  BLOCK: "BLOCK",
});

const SIM_TO_RECEIPT_DECISION = Object.freeze({
  ALLOW: "ALLOW",
  ALLOW_WITH_MODIFICATIONS: "BLOCK",
  REQUIRE_REVIEW: "BLOCK",
  DENY: "BLOCK",
  CLARIFY: "BLOCK",
  INVALID: "BLOCK",
  SAFE_MODE: "BLOCK",
});

function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  return "{" + Object.keys(value).sort().map((key) => {
    return JSON.stringify(key) + ":" + canonicalize(value[key]);
  }).join(",") + "}";
}

function sha256(value) {
  return crypto.createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function requireField(object, fieldName) {
  if (!object || object[fieldName] === undefined || object[fieldName] === null || object[fieldName] === "") {
    throw new Error(`Missing required field: ${fieldName}`);
  }
}

function mapCrossingToIntent(crossingPacket) {
  requireField(crossingPacket, "requested_operation");
  requireField(crossingPacket, "target_surface");
  requireField(crossingPacket, "crossing_id");
  requireField(crossingPacket, "sourcepoint_id");
  requireField(crossingPacket, "mandate_id");
  requireField(crossingPacket, "crossing_type");

  return {
    action: crossingPacket.requested_operation,
    target: crossingPacket.target_surface,
    parameters: {
      crossing_id: crossingPacket.crossing_id,
      sourcepoint_id: crossingPacket.sourcepoint_id,
      mandate_id: crossingPacket.mandate_id,
      crossing_type: crossingPacket.crossing_type,
      authority_scope: crossingPacket.authority_scope || null,
      external_consequence: Boolean(crossingPacket.external_consequence),
      memory_mutation: Boolean(crossingPacket.memory_mutation),
      tool_access: crossingPacket.tool_access || "none",
      risk_tier: crossingPacket.risk_tier || "unspecified",
      ttl: crossingPacket.ttl || null,
      required_receipt_type: crossingPacket.required_receipt_type || "standard",
    },
  };
}

function mapApprovalToReceiptApproval(approvedPacket, intent) {
  requireField(approvedPacket, "authorizer");
  requireField(approvedPacket, "scope");

  return {
    approval_id: approvedPacket.approval_id || crypto.randomUUID(),
    intent_hash: approvedPacket.intent_hash || sha256(intent),
    authorizer: approvedPacket.authorizer,
    nonce: approvedPacket.nonce || crypto.randomUUID(),
    ttl: approvedPacket.ttl || null,
    scope: approvedPacket.scope,
  };
}

function mapSentinelSurfaceToExecutionInput(surface) {
  requireField(surface, "action");
  requireField(surface, "target");

  return {
    action: surface.action,
    target: surface.target,
    parameters: surface.parameters || {},
  };
}

function mapDecisionToReceiptDecision(simDecision) {
  return SIM_TO_RECEIPT_DECISION[simDecision] || RECEIPT_DECISIONS.BLOCK;
}

function createAdapterValidation({ simDecision, checks = {} }) {
  const receiptDecision = mapDecisionToReceiptDecision(simDecision);
  const normalizedChecks = {
    authority_valid: Boolean(checks.authority_valid),
    scope_valid: Boolean(checks.scope_valid),
    context_valid: Boolean(checks.context_valid),
    crossing_classified: Boolean(checks.crossing_classified),
    sentinel_verified: Boolean(checks.sentinel_verified),
    receipt_path_valid: Boolean(checks.receipt_path_valid),
  };

  return {
    decision: receiptDecision,
    checks: normalizedChecks,
    policy_version: "sim-mus-adapter-0.1.0",
  };
}

function createDenialReceiptInput({ crossingId, simDecision, blockReason, checks = {} }) {
  return {
    crossing_id: crossingId || null,
    decision: RECEIPT_DECISIONS.BLOCK,
    sim_decision: simDecision || "UNKNOWN",
    block_reason: blockReason || "non_allow_decision",
    checks: {
      authority_valid: Boolean(checks.authority_valid),
      scope_valid: Boolean(checks.scope_valid),
      context_valid: Boolean(checks.context_valid),
      crossing_classified: Boolean(checks.crossing_classified),
      sentinel_verified: Boolean(checks.sentinel_verified),
      receipt_path_valid: Boolean(checks.receipt_path_valid),
    },
  };
}

function returnReceiptToSourcePoint({ crossingId, receipt, chainStatus = "not_checked", signatureStatus = "not_checked" }) {
  return {
    crossing_id: crossingId,
    decision: receipt && (receipt.decision || receipt.validation && receipt.validation.decision) || RECEIPT_DECISIONS.BLOCK,
    receipt_id: receipt && receipt.receipt_id || null,
    receipt_hash: receipt && receipt.receipt_hash || null,
    chain_status: chainStatus,
    signature_status: signatureStatus,
    return_status: "returned_to_sourcepoint",
    next_available_actions: [
      "accept",
      "revise",
      "retry_with_new_authorization",
      "escalate_review",
      "discard",
    ],
  };
}

module.exports = {
  canonicalize,
  sha256,
  mapCrossingToIntent,
  mapApprovalToReceiptApproval,
  mapSentinelSurfaceToExecutionInput,
  mapDecisionToReceiptDecision,
  createAdapterValidation,
  createDenialReceiptInput,
  returnReceiptToSourcePoint,
};
