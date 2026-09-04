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
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new TypeError("receipt must be an object");
  }
  const envelopeFields = new Set([
    "receipt_hash",
    "signature",
    "signature_algorithm",
    "public_key",
  ]);
  const body = {};
  for (const [key, value] of Object.entries(receipt)) {
    if (!envelopeFields.has(key)) body[key] = value;
  }
  return body;
}

function receiptSigningPayload(receipt) {
  return canonicalize(buildSignedReceiptBody(receipt));
}

function hashSignedReceiptBody(receipt) {
  return sha256(receiptSigningPayload(receipt));
}

function toPrivateKey(key) {
  if (key && key.type === "private") return key;
  if (Buffer.isBuffer(key)) {
    const parsed = crypto.createPrivateKey({ key, format: "der", type: "pkcs8" });
    if (!parsed.export({ type: "pkcs8", format: "der" }).equals(key)) {
      throw new TypeError("privateKey DER must use its canonical PKCS8 encoding");
    }
    return parsed;
  }
  if (typeof key === "string" && /^(?:[0-9a-f]{2})+$/.test(key)) {
    const parsed = crypto.createPrivateKey({
      key: Buffer.from(key, "hex"),
      format: "der",
      type: "pkcs8",
    });
    if (parsed.export({ type: "pkcs8", format: "der" }).toString("hex") !== key) {
      throw new TypeError("privateKey DER must use its canonical PKCS8 encoding");
    }
    return parsed;
  }
  return crypto.createPrivateKey(key);
}

function toPublicKey(key) {
  if (key && key.type === "public") return key;
  if (Buffer.isBuffer(key)) {
    const parsed = crypto.createPublicKey({ key, format: "der", type: "spki" });
    if (!parsed.export({ type: "spki", format: "der" }).equals(key)) {
      throw new TypeError("publicKey DER must use its canonical SPKI encoding");
    }
    return parsed;
  }
  if (typeof key === "string" && /^(?:[0-9a-f]{2})+$/.test(key)) {
    const parsed = crypto.createPublicKey({
      key: Buffer.from(key, "hex"),
      format: "der",
      type: "spki",
    });
    if (parsed.export({ type: "spki", format: "der" }).toString("hex") !== key) {
      throw new TypeError("publicKey DER must use its canonical SPKI encoding");
    }
    return parsed;
  }
  return crypto.createPublicKey(key);
}

function requireEd25519(key, label) {
  if (key.asymmetricKeyType !== "ed25519") {
    throw new TypeError(`${label} must be an Ed25519 key`);
  }
  return key;
}

/**
 * Return a new receipt signed over buildSignedReceiptBody(receipt).
 *
 * Keys may be Node KeyObjects, PEM values, or DER values (Buffer/hex). The
 * public key is derived from the private key unless it is supplied explicitly.
 */
function signReceipt(receipt, privateKey, publicKey) {
  const privateKeyObject = requireEd25519(toPrivateKey(privateKey), "privateKey");
  const publicKeyObject = requireEd25519(
    publicKey ? toPublicKey(publicKey) : crypto.createPublicKey(privateKeyObject),
    "publicKey"
  );
  const payload = receiptSigningPayload(receipt);

  return {
    ...receipt,
    receipt_hash: sha256(payload),
    signature: crypto
      .sign(null, Buffer.from(payload, "utf8"), privateKeyObject)
      .toString("hex"),
    signature_algorithm: "Ed25519",
    public_key: publicKeyObject
      .export({ type: "spki", format: "der" })
      .toString("hex"),
  };
}

/** Verify only the Ed25519 signature over the canonical signed body. */
function verifyReceiptSignature(receipt, publicKey = receipt && receipt.public_key) {
  if (
    !receipt ||
    (receipt.signature_algorithm !== undefined &&
      receipt.signature_algorithm !== "Ed25519") ||
    typeof receipt.signature !== "string" ||
    !/^[0-9a-f]{128}$/.test(receipt.signature) ||
    !publicKey
  ) {
    return false;
  }

  try {
    const publicKeyObject = requireEd25519(toPublicKey(publicKey), "publicKey");
    return crypto.verify(
      null,
      Buffer.from(receiptSigningPayload(receipt), "utf8"),
      publicKeyObject,
      Buffer.from(receipt.signature, "hex")
    );
  } catch (_error) {
    return false;
  }
}

/** Verify both the signed-body hash and the Ed25519 signature. */
function verifySignedReceipt(receipt, publicKey = receipt && receipt.public_key) {
  try {
    const computedHash = receipt ? hashSignedReceiptBody(receipt) : null;
    const receiptHashValid = Boolean(
      receipt && receipt.receipt_hash && computedHash === receipt.receipt_hash
    );
    const signatureValid = verifyReceiptSignature(receipt, publicKey);

    return {
      valid: receiptHashValid && signatureValid,
      receipt_hash_valid: receiptHashValid,
      signature_valid: signatureValid,
      computed_hash: computedHash,
    };
  } catch (_error) {
    return {
      valid: false,
      receipt_hash_valid: false,
      signature_valid: false,
      computed_hash: null,
    };
  }
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
  hashSignedReceiptBody,
  receiptSigningPayload,
  sha256,
  signReceipt,
  validateExecution,
  verifyReceiptSignature,
  verifySignedReceipt,
};
