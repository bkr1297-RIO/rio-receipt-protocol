const assert = require("assert");
const {
  computeAssessmentRecordHash,
  deriveOrRefuseCoherenceAssessment,
} = require("../verifier/coherence-assessment");

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const D = "d".repeat(64);
const E = "e".repeat(64);

function baseAdmission(overrides = {}) {
  return {
    receipt_type: "admission_decision",
    authorization_nonce: "nonce-001",
    decision: {
      authorized_action_hash: B,
      authorization_expires_at: "2026-07-26T00:00:00Z",
      permitted_executor_nodes: ["node-1"],
      permitted_execution_contexts: ["SANDBOX"],
      consequence_evaluation: {
        mode: "EXACT_HASH",
        contract_hash: C,
      },
    },
    chain: { receipt_hash: A },
    ...overrides,
  };
}

function baseConsequence(overrides = {}) {
  return {
    receipt_type: "consequence_attestation",
    created_at: "2026-07-25T12:00:00Z",
    execution_id: "11111111-1111-4111-8111-111111111111",
    authorization_nonce: "nonce-001",
    canonicalization: {
      profile: "RIO-CANON",
      profile_version: "1.1.0",
    },
    admission_receipt_hash: A,
    executor: {
      node_id: "node-1",
      execution_context: "SANDBOX",
    },
    execution: {
      status: "COMPLETED",
      actual_action_hash: B,
      consequence_hash: C,
    },
    chain: {
      chain_position: 1,
      previous_receipt_hash: A,
      receipt_hash: D,
    },
    ...overrides,
  };
}

const metadata = {
  record_id: "22222222-2222-4222-8222-222222222222",
  created_at: "2026-07-25T12:01:00Z",
  verifier_version: "1.0.0",
};

const cryptographicEvidence = {
  admission_receipt: "VALID",
  consequence_receipt: "VALID",
  sentinel_attestation: "VALID",
};

function derive(admissionReceipt, consequenceReceipt, extra = {}) {
  return deriveOrRefuseCoherenceAssessment({
    admissionReceipt,
    consequenceReceipt,
    metadata,
    cryptographicEvidence,
    nonceState: "CONSUMED",
    ...extra,
  });
}

// 1. Exact match derives a valid, no-review assessment.
{
  const result = derive(baseAdmission(), baseConsequence());
  assert.strictEqual(result.disposition, "DERIVED");
  assert.strictEqual(result.record.verifier_result, "VALID");
  assert.strictEqual(result.record.conformance.action_conformance, "MATCH");
  assert.strictEqual(result.record.conformance.consequence_conformance, "MATCH");
  assert.strictEqual(result.record.routing_disposition, "NONE_INDICATED");
  assert.match(result.record.chain.record_hash, /^[a-f0-9]{64}$/);
  assert.strictEqual(result.record.chain.record_hash, computeAssessmentRecordHash(result.record));
}

// 2. A proven action mismatch is a valid assessment of a security divergence.
{
  const consequence = baseConsequence({
    execution: {
      status: "COMPLETED",
      actual_action_hash: E,
      consequence_hash: C,
    },
  });
  const result = derive(baseAdmission(), consequence);
  assert.strictEqual(result.disposition, "DERIVED");
  assert.strictEqual(result.record.verifier_result, "VALID");
  assert.strictEqual(result.record.conformance.action_conformance, "MISMATCH");
  assert.strictEqual(result.record.routing_disposition, "SECURITY_REVIEW_REQUIRED");
}

// 3. Missing a contract evaluator fails closed as unresolved.
{
  const admission = baseAdmission({
    decision: {
      ...baseAdmission().decision,
      consequence_evaluation: {
        mode: "CONTRACT",
        contract_hash: C,
        evaluator_id: "RIO-CONSEQUENCE-EVAL-1",
        evaluator_version: "1.0.0",
      },
    },
  });
  const result = derive(admission, baseConsequence());
  assert.strictEqual(result.disposition, "REFUSED_UNRESOLVED");
  assert.strictEqual(result.record.verifier_result, "UNRESOLVED");
  assert.strictEqual(result.record.conformance.consequence_conformance, "INDETERMINATE");
  assert.ok(result.record.unresolved_reasons.includes("CONSEQUENCE_EVALUATOR_UNAVAILABLE"));
}

// 4. A broken parent anchor is invalid, not merely unresolved.
{
  const consequence = baseConsequence({ admission_receipt_hash: E });
  const result = derive(baseAdmission(), consequence);
  assert.strictEqual(result.disposition, "REFUSED_INVALID");
  assert.strictEqual(result.record.verifier_result, "INVALID");
  assert.ok(result.record.invalidity_reasons.includes("ADMISSION_RECEIPT_BINDING_MISMATCH"));
}

// 5. Equal inputs produce equal projection hashes.
{
  const first = derive(baseAdmission(), baseConsequence());
  const second = derive(baseAdmission(), baseConsequence());
  assert.strictEqual(first.record.chain.record_hash, second.record.chain.record_hash);
}

console.log("coherence assessment tests: PASS");
