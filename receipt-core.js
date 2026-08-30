const crypto = require("crypto");

function sha256(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const sortedKeys = Object.keys(obj).sort();
  return (
    "{" +
    sortedKeys.map((key) => JSON.stringify(key) + ":" + canonicalize(obj[key])).join(",") +
    "}"
  );
}

function buildSignedReceiptBody(receipt) {
  const body = {
    receipt_id: receipt.receipt_id,
    timestamp: receipt.timestamp,
    intent_hash: receipt.intent_hash,
    execution_hash: receipt.execution_hash,
    validation: receipt.validation,
    decision: receipt.decision,
    approval: receipt.approval,
    chain_reference: receipt.chain_reference,
  };

  if (receipt.mus_unit_id !== undefined && receipt.mus_unit_id !== null) {
    body.mus_unit_id = receipt.mus_unit_id;
  }

  return body;
}

function validateExecution(intent, executionInput, approval, allowedActions) {
  const intentHash = sha256(canonicalize(intent));
  const executionHash = sha256(canonicalize(executionInput));
  const checks = {
    intent_match: intentHash === executionHash,
    context_match: approval.intent_hash === intentHash,
    scope_valid: executionInput.action === approval.scope,
    execution_path_valid: allowedActions.includes(executionInput.action),
  };

  return {
    decision: Object.values(checks).every(Boolean) ? "ALLOW" : "BLOCK",
    checks,
    policy_version: "1.0.0",
  };
}

module.exports = {
  buildSignedReceiptBody,
  canonicalize,
  sha256,
  validateExecution,
};
