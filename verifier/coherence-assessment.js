/**
 * verifier/coherence-assessment.js
 *
 * Candidate semantic verifier scaffold for the MUS Coherence Assessment Record.
 *
 * Role boundary:
 *   - Executor reports facts.
 *   - Sentinel attests observations.
 *   - This verifier derives conformance and routing.
 *   - REAL remains human-owned.
 *
 * This module does not authorize execution, settle an event, perform repair,
 * or renew a mandate. It derives a proof record from already-produced receipts
 * and refuses closure when evidence is invalid or unresolved.
 */

const crypto = require("crypto");

const HASH_RE = /^[a-f0-9]{64}$/;
const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;

const RULESET = Object.freeze({
  ruleset_id: "MUS-COHERENCE-ASSESSMENT-RULESET",
  ruleset_version: "1.0.0",
  rules: [
    "CAR-CHAIN-001",
    "CAR-NONCE-001",
    "CAR-ACTION-001",
    "CAR-OUTCOME-001",
    "CAR-TIME-001",
    "CAR-EXECUTOR-001",
    "CAR-PROFILE-001",
    "CAR-EVIDENCE-001",
    "CAR-REPLAY-001",
  ],
});

const NON_EXECUTION_STATUSES = new Set([
  "BLOCKED_BEFORE_EXECUTION",
  "BLOCKED_ACTION_MISMATCH",
  "BLOCKED_POLICY_OR_AUTHORITY",
]);

const TERMINAL_NONCE_STATES = new Set([
  "CONSUMED",
  "REVOKED",
  "EXPIRED",
  "ABORTED_BEFORE_RELEASE",
  "RECOVERY_REQUIRED",
]);

class AssessmentInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AssessmentInputError";
    this.code = code;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertValidUnicodeScalarString(value, path = "$") {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new AssessmentInputError(
          "MALFORMED_UNICODE",
          `Lone high surrogate at ${path}[${index}]`
        );
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new AssessmentInputError(
        "MALFORMED_UNICODE",
        `Lone low surrogate at ${path}[${index}]`
      );
    }
  }
}

function compareUtf8Keys(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

/**
 * RIO-CANON candidate implementation for the restricted proof-object domain.
 *
 * Important parser boundary: duplicate JSON keys must be rejected before this
 * function receives an in-memory object. JSON.parse cannot detect duplicates.
 */
function canonicalize(value, path = "$") {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    assertValidUnicodeScalarString(value, path);
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new AssessmentInputError(
        "UNSAFE_NUMBER",
        `Only safe JSON integers are permitted at ${path}`
      );
    }
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(",")}]`;
  }

  if (!isPlainObject(value)) {
    throw new AssessmentInputError(
      "UNSUPPORTED_JSON_VALUE",
      `Unsupported value at ${path}`
    );
  }

  const keys = Object.keys(value).sort(compareUtf8Keys);
  const members = keys.map((key) => {
    assertValidUnicodeScalarString(key, `${path}::<key>`);
    if (value[key] === undefined) {
      throw new AssessmentInputError(
        "UNDEFINED_VALUE",
        `Undefined is not permitted at ${path}.${key}`
      );
    }
    return `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`)}`;
  });
  return `{${members.join(",")}}`;
}

function sha256Utf8(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

const RULESET_HASH = sha256Utf8(canonicalize(RULESET));

function deepCloneJson(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(deepCloneJson);
  }
  const clone = {};
  for (const [key, child] of Object.entries(value)) {
    clone[key] = deepCloneJson(child);
  }
  return clone;
}

function computeAssessmentRecordHash(record) {
  const projection = deepCloneJson(record);
  if (!projection.chain || !isPlainObject(projection.chain)) {
    throw new AssessmentInputError("CHAIN_REQUIRED", "Assessment chain is required");
  }
  delete projection.chain.record_hash;
  return sha256Utf8(canonicalize(projection));
}

function getReceiptHash(receipt) {
  return receipt?.chain?.receipt_hash || receipt?.receipt_hash || null;
}

function getPreviousReceiptHash(receipt) {
  return receipt?.chain?.previous_receipt_hash || receipt?.previous_receipt_hash || null;
}

function getAuthorizationNonce(receipt) {
  return receipt?.authorization_nonce || receipt?.approval?.nonce || null;
}

function getAuthorizedActionHash(admissionReceipt) {
  return (
    admissionReceipt?.decision?.authorized_action_hash ||
    admissionReceipt?.authorized_action_hash ||
    admissionReceipt?.execution_hash ||
    null
  );
}

function getActualActionHash(consequenceReceipt) {
  const execution = consequenceReceipt?.execution || {};
  return (
    execution.actual_action_hash ||
    execution.attempted_action_hash ||
    consequenceReceipt?.actual_action_hash ||
    null
  );
}

function getObservedConsequenceHash(consequenceReceipt) {
  return (
    consequenceReceipt?.execution?.consequence_hash ||
    consequenceReceipt?.observed_consequence_hash ||
    null
  );
}

function getConsequenceEvaluation(admissionReceipt) {
  return (
    admissionReceipt?.decision?.consequence_evaluation ||
    admissionReceipt?.consequence_evaluation ||
    { mode: "NONE" }
  );
}

function assertMetadata(metadata) {
  if (!isPlainObject(metadata)) {
    throw new AssessmentInputError("METADATA_REQUIRED", "metadata is required");
  }
  if (typeof metadata.record_id !== "string" || metadata.record_id.length === 0) {
    throw new AssessmentInputError("RECORD_ID_REQUIRED", "metadata.record_id is required");
  }
  if (typeof metadata.created_at !== "string" || Number.isNaN(Date.parse(metadata.created_at))) {
    throw new AssessmentInputError(
      "CREATED_AT_REQUIRED",
      "metadata.created_at must be an RFC 3339-compatible timestamp"
    );
  }
  if (!SEMVER_RE.test(metadata.verifier_version || "")) {
    throw new AssessmentInputError(
      "VERIFIER_VERSION_REQUIRED",
      "metadata.verifier_version must be semantic version text"
    );
  }
}

function deriveActionConformance({ status, authorizedActionHash, actualActionHash }) {
  if (NON_EXECUTION_STATUSES.has(status) && actualActionHash === null) {
    return "NOT_EXECUTED";
  }
  if (actualActionHash === null || authorizedActionHash === null) {
    return "INDETERMINATE";
  }
  return authorizedActionHash === actualActionHash ? "MATCH" : "MISMATCH";
}

function deriveConsequenceConformance({
  evaluation,
  observedConsequenceHash,
  consequenceEvaluator,
  admissionReceipt,
  consequenceReceipt,
}) {
  const mode = evaluation?.mode || "NONE";

  if (mode === "NONE") {
    return {
      status: observedConsequenceHash === null ? "NO_CONSEQUENCE" : "NOT_EVALUATED",
      mode,
    };
  }

  if (observedConsequenceHash === null) {
    return { status: "NO_CONSEQUENCE", mode };
  }

  if (mode === "EXACT_HASH") {
    const expectedHash = evaluation.contract_hash || evaluation.expected_hash || null;
    if (!HASH_RE.test(expectedHash || "")) {
      return { status: "INDETERMINATE", mode, reason: "AUTHORIZED_CONSEQUENCE_HASH_MISSING" };
    }
    return {
      status: expectedHash === observedConsequenceHash ? "MATCH" : "MISMATCH",
      mode,
      contractHash: expectedHash,
    };
  }

  if (mode === "CONTRACT") {
    if (typeof consequenceEvaluator !== "function") {
      return {
        status: "INDETERMINATE",
        mode,
        contractHash: evaluation.contract_hash || null,
        evaluatorId: evaluation.evaluator_id || null,
        evaluatorVersion: evaluation.evaluator_version || null,
        reason: "CONSEQUENCE_EVALUATOR_UNAVAILABLE",
      };
    }
    const result = consequenceEvaluator({
      evaluation,
      admissionReceipt,
      consequenceReceipt,
      observedConsequenceHash,
    });
    if (!result || !["MATCH", "MISMATCH", "INDETERMINATE"].includes(result.status)) {
      return { status: "INDETERMINATE", mode, reason: "CONSEQUENCE_EVALUATOR_INVALID_RESULT" };
    }
    return {
      status: result.status,
      mode,
      contractHash: evaluation.contract_hash || null,
      evaluatorId: evaluation.evaluator_id || result.evaluator_id || null,
      evaluatorVersion: evaluation.evaluator_version || result.evaluator_version || null,
      reason: result.reason || null,
    };
  }

  return { status: "INDETERMINATE", mode, reason: "UNSUPPORTED_CONSEQUENCE_EVALUATION_MODE" };
}

function deriveRoutingDisposition({
  verifierResult,
  actionConformance,
  consequenceConformance,
  executionStatus,
  nonceState,
  hasResidue,
}) {
  if (verifierResult === "INVALID") {
    return "SECURITY_REVIEW_REQUIRED";
  }
  if (verifierResult === "UNRESOLVED") {
    return nonceState === "RECOVERY_REQUIRED" ? "RECOVERY_REQUIRED" : "REVIEW_REQUIRED";
  }
  if (actionConformance === "MISMATCH") {
    return "SECURITY_REVIEW_REQUIRED";
  }
  if (consequenceConformance === "MISMATCH") {
    return "HUMAN_DETERMINATION_REQUIRED";
  }
  if (executionStatus === "FAILED" || executionStatus === "FAILED_DURING_EXECUTION" || hasResidue) {
    return "REPAIR_CANDIDATE";
  }
  if (
    NON_EXECUTION_STATUSES.has(executionStatus) ||
    executionStatus === "HALTED" ||
    actionConformance === "NOT_EXECUTED"
  ) {
    return "REVIEW_REQUIRED";
  }
  return "NONE_INDICATED";
}

function pushUnique(target, value) {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

/**
 * Derive a Coherence Assessment Record or return a fail-closed refusal.
 *
 * The cryptographicEvidence object is an upstream proof boundary. This module
 * will not silently treat absent signature/hash verification as valid.
 */
function deriveOrRefuseCoherenceAssessment({
  admissionReceipt,
  consequenceReceipt,
  metadata,
  cryptographicEvidence,
  nonceState,
  consequenceEvaluator,
}) {
  assertMetadata(metadata);

  const invalidityReasons = [];
  const unresolvedReasons = [];
  const appliedRules = [];

  const admissionHash = getReceiptHash(admissionReceipt);
  const consequenceHash = getReceiptHash(consequenceReceipt);
  const executionStatus = consequenceReceipt?.execution?.status || null;
  const admissionNonce = getAuthorizationNonce(admissionReceipt);
  const consequenceNonce = getAuthorizationNonce(consequenceReceipt);
  const authorizedActionHash = getAuthorizedActionHash(admissionReceipt);
  const actualActionHash = getActualActionHash(consequenceReceipt);
  const observedConsequenceHash = getObservedConsequenceHash(consequenceReceipt);
  const evaluation = getConsequenceEvaluation(admissionReceipt);

  pushUnique(appliedRules, "CAR-EVIDENCE-001");
  if (!isPlainObject(admissionReceipt)) {
    pushUnique(unresolvedReasons, "ADMISSION_RECEIPT_UNAVAILABLE");
  }
  if (!isPlainObject(consequenceReceipt)) {
    pushUnique(unresolvedReasons, "CONSEQUENCE_RECEIPT_UNAVAILABLE");
  }
  if (!HASH_RE.test(admissionHash || "")) {
    pushUnique(unresolvedReasons, "ADMISSION_RECEIPT_HASH_UNAVAILABLE");
  }
  if (!HASH_RE.test(consequenceHash || "")) {
    pushUnique(unresolvedReasons, "CONSEQUENCE_RECEIPT_HASH_UNAVAILABLE");
  }

  if (!isPlainObject(cryptographicEvidence)) {
    pushUnique(unresolvedReasons, "CRYPTOGRAPHIC_EVIDENCE_UNAVAILABLE");
  } else {
    for (const [field, reason] of [
      ["admission_receipt", "ADMISSION_RECEIPT_CRYPTO_UNRESOLVED"],
      ["consequence_receipt", "CONSEQUENCE_RECEIPT_CRYPTO_UNRESOLVED"],
      ["sentinel_attestation", "SENTINEL_ATTESTATION_UNRESOLVED"],
    ]) {
      const status = cryptographicEvidence[field];
      if (status === "INVALID") {
        pushUnique(invalidityReasons, reason.replace("UNRESOLVED", "INVALID"));
      } else if (status !== "VALID") {
        pushUnique(unresolvedReasons, reason);
      }
    }
  }

  pushUnique(appliedRules, "CAR-CHAIN-001");
  const declaredAdmissionHash = consequenceReceipt?.admission_receipt_hash || null;
  const previousReceiptHash = getPreviousReceiptHash(consequenceReceipt);
  if (HASH_RE.test(admissionHash || "")) {
    if (declaredAdmissionHash !== admissionHash) {
      pushUnique(invalidityReasons, "ADMISSION_RECEIPT_BINDING_MISMATCH");
    }
    if (previousReceiptHash !== admissionHash) {
      pushUnique(invalidityReasons, "PREVIOUS_RECEIPT_HASH_MISMATCH");
    }
  }

  pushUnique(appliedRules, "CAR-NONCE-001");
  if (!admissionNonce || !consequenceNonce) {
    pushUnique(unresolvedReasons, "AUTHORIZATION_NONCE_UNAVAILABLE");
  } else if (admissionNonce !== consequenceNonce) {
    pushUnique(invalidityReasons, "AUTHORIZATION_NONCE_MISMATCH");
  }

  pushUnique(appliedRules, "CAR-REPLAY-001");
  if (!nonceState) {
    pushUnique(unresolvedReasons, "AUTHORIZATION_NONCE_STATE_UNAVAILABLE");
  } else if (nonceState === "RECOVERY_REQUIRED") {
    pushUnique(unresolvedReasons, "NONCE_RECOVERY_REQUIRED");
  } else if (!TERMINAL_NONCE_STATES.has(nonceState)) {
    pushUnique(unresolvedReasons, "AUTHORIZATION_NONCE_NOT_TERMINAL");
  }

  pushUnique(appliedRules, "CAR-TIME-001");
  const expiresAt = admissionReceipt?.decision?.authorization_expires_at || null;
  const consequenceCreatedAt = consequenceReceipt?.created_at || consequenceReceipt?.timestamp || null;
  if (expiresAt && consequenceCreatedAt) {
    if (Date.parse(consequenceCreatedAt) > Date.parse(expiresAt)) {
      pushUnique(invalidityReasons, "AUTHORIZATION_EXPIRED_BEFORE_CONSEQUENCE");
    }
  } else if (expiresAt || consequenceCreatedAt) {
    pushUnique(unresolvedReasons, "TEMPORAL_BINDING_INCOMPLETE");
  }

  pushUnique(appliedRules, "CAR-EXECUTOR-001");
  const allowedNodes = admissionReceipt?.decision?.permitted_executor_nodes;
  const allowedContexts = admissionReceipt?.decision?.permitted_execution_contexts;
  const actualNode = consequenceReceipt?.executor?.node_id;
  const actualContext = consequenceReceipt?.executor?.execution_context;
  if (Array.isArray(allowedNodes) && !allowedNodes.includes(actualNode)) {
    pushUnique(invalidityReasons, "EXECUTOR_NODE_NOT_PERMITTED");
  }
  if (Array.isArray(allowedContexts) && !allowedContexts.includes(actualContext)) {
    pushUnique(invalidityReasons, "EXECUTION_CONTEXT_NOT_PERMITTED");
  }

  pushUnique(appliedRules, "CAR-PROFILE-001");
  const canonicalizationProfile = consequenceReceipt?.canonicalization?.profile;
  const canonicalizationVersion = consequenceReceipt?.canonicalization?.profile_version;
  if (canonicalizationProfile !== "RIO-CANON" || canonicalizationVersion !== "1.1.0") {
    pushUnique(unresolvedReasons, "UNSUPPORTED_CANONICALIZATION_PROFILE");
  }

  let actionConformance = "INDETERMINATE";
  let consequenceResult = {
    status: "INDETERMINATE",
    mode: evaluation?.mode || "NONE",
  };

  if (invalidityReasons.length === 0) {
    pushUnique(appliedRules, "CAR-ACTION-001");
    actionConformance = deriveActionConformance({
      status: executionStatus,
      authorizedActionHash,
      actualActionHash,
    });
    if (actionConformance === "INDETERMINATE") {
      pushUnique(unresolvedReasons, "ACTION_CONFORMANCE_INDETERMINATE");
    }

    pushUnique(appliedRules, "CAR-OUTCOME-001");
    consequenceResult = deriveConsequenceConformance({
      evaluation,
      observedConsequenceHash,
      consequenceEvaluator,
      admissionReceipt,
      consequenceReceipt,
    });
    if (consequenceResult.status === "INDETERMINATE") {
      pushUnique(unresolvedReasons, consequenceResult.reason || "CONSEQUENCE_CONFORMANCE_INDETERMINATE");
    }
  }

  invalidityReasons.sort();
  unresolvedReasons.sort();
  appliedRules.sort();

  const verifierResult = invalidityReasons.length > 0
    ? "INVALID"
    : unresolvedReasons.length > 0
      ? "UNRESOLVED"
      : "VALID";

  const evidenceStatus = invalidityReasons.length > 0
    ? "CONTRADICTORY"
    : unresolvedReasons.some((reason) => reason.endsWith("UNAVAILABLE"))
      ? "UNAVAILABLE"
      : unresolvedReasons.length > 0
        ? "INCOMPLETE"
        : "COMPLETE";

  const hasResidue = Boolean(
    consequenceReceipt?.execution?.error_hash ||
    consequenceReceipt?.execution?.residue_hash ||
    consequenceReceipt?.residue_hash
  );

  const routingDisposition = deriveRoutingDisposition({
    verifierResult,
    actionConformance,
    consequenceConformance: consequenceResult.status,
    executionStatus,
    nonceState,
    hasResidue,
  });

  const conformance = {
    action_conformance: actionConformance,
    consequence_conformance: consequenceResult.status,
    consequence_evaluation_mode: consequenceResult.mode,
  };

  if (HASH_RE.test(authorizedActionHash || "")) {
    conformance.authorized_action_hash = authorizedActionHash;
  }
  conformance.actual_action_hash = HASH_RE.test(actualActionHash || "") ? actualActionHash : null;
  conformance.authorized_consequence_contract_hash = HASH_RE.test(consequenceResult.contractHash || "")
    ? consequenceResult.contractHash
    : null;
  conformance.observed_consequence_hash = HASH_RE.test(observedConsequenceHash || "")
    ? observedConsequenceHash
    : null;
  conformance.consequence_evaluator_id = consequenceResult.evaluatorId || null;
  conformance.consequence_evaluator_version = consequenceResult.evaluatorVersion || null;

  const assessment = {
    record_version: "1.0.0",
    record_type: "coherence_assessment",
    record_id: metadata.record_id,
    created_at: metadata.created_at,
    canonicalization: {
      profile: "RIO-CANON",
      profile_version: "1.1.0",
      hash_projection: "MUS-CAR-ASSESS-HASH-1",
    },
    hash_algorithm: "sha256",
    admission_receipt_hash: HASH_RE.test(admissionHash || "") ? admissionHash : "0".repeat(64),
    consequence_receipt_hash: HASH_RE.test(consequenceHash || "") ? consequenceHash : "0".repeat(64),
    verifier: {
      verifier_id: "MUS_SEMANTIC_VERIFIER",
      verifier_version: metadata.verifier_version,
      ruleset_hash: RULESET_HASH,
      evaluation_profile: "MUS-CONSEQUENCE-ATTESTATION-SEMANTICS",
      evaluation_profile_version: "1.1.0",
    },
    evidence_status: evidenceStatus,
    verifier_result: verifierResult,
    conformance,
    routing_disposition: routingDisposition,
    applied_rule_codes: appliedRules,
    chain: {
      chain_position: Number.isSafeInteger(consequenceReceipt?.chain?.chain_position)
        ? consequenceReceipt.chain.chain_position + 1
        : 2,
      previous_record_hash: HASH_RE.test(consequenceHash || "") ? consequenceHash : "0".repeat(64),
      record_hash: "0".repeat(64),
    },
  };

  const executionId = consequenceReceipt?.execution_id;
  if (typeof executionId === "string" && consequenceNonce) {
    assessment.execution_binding = {
      execution_id: executionId,
      authorization_nonce: consequenceNonce,
      authorization_nonce_state: nonceState || "RECOVERY_REQUIRED",
    };
    if (Number.isSafeInteger(consequenceReceipt?.execution_attempt)) {
      assessment.execution_binding.execution_attempt = consequenceReceipt.execution_attempt;
    }
    if (typeof consequenceReceipt?.mandate_id === "string") {
      assessment.execution_binding.mandate_id = consequenceReceipt.mandate_id;
    }
    if (Number.isSafeInteger(consequenceReceipt?.occurrence_index)) {
      assessment.execution_binding.occurrence_index = consequenceReceipt.occurrence_index;
    }
  }

  if (verifierResult === "INVALID") {
    assessment.invalidity_reasons = invalidityReasons;
  } else if (verifierResult === "UNRESOLVED") {
    assessment.unresolved_reasons = unresolvedReasons;
  }

  assessment.chain.record_hash = computeAssessmentRecordHash(assessment);

  const disposition = verifierResult === "VALID"
    ? "DERIVED"
    : verifierResult === "INVALID"
      ? "REFUSED_INVALID"
      : "REFUSED_UNRESOLVED";

  return { disposition, record: assessment };
}

module.exports = {
  AssessmentInputError,
  RULESET,
  RULESET_HASH,
  canonicalize,
  computeAssessmentRecordHash,
  deriveOrRefuseCoherenceAssessment,
};
