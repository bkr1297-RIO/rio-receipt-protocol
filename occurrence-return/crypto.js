const crypto = require("crypto");
const { canonicalize, sha256 } = require("../receipt-core");

function publicKeyHex(publicKey) {
  return publicKey.export({ type: "spki", format: "der" }).toString("hex");
}

function ed25519PublicKeyFromHex(value) {
  if (!/^(?:[0-9a-f]{2})+$/.test(value || "")) {
    throw new Error("PUBLIC_KEY_HEX_INVALID");
  }
  const key = crypto.createPublicKey({
    key: Buffer.from(value, "hex"),
    format: "der",
    type: "spki",
  });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("PUBLIC_KEY_ALGORITHM_INVALID");
  }
  if (key.export({ type: "spki", format: "der" }).toString("hex") !== value) {
    throw new Error("PUBLIC_KEY_DER_NON_CANONICAL");
  }
  return key;
}

function createFixtureSigner(role, keyId) {
  const pair = crypto.generateKeyPairSync("ed25519");
  return {
    role,
    keyId,
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyHex: publicKeyHex(pair.publicKey),
  };
}

function artifactBody(artifact) {
  const copy = structuredClone(artifact);
  delete copy.attestation;
  return copy;
}

function artifactPayload(artifact) {
  return canonicalize(artifactBody(artifact));
}

function artifactHash(artifact) {
  // References and external checkpoints bind the complete signed artifact,
  // including signer identity, public key, body hash, and signature. The
  // attestation's body_hash separately commits to artifactPayload(artifact).
  return sha256(canonicalize(artifact));
}

function signArtifact(body, signer) {
  if (body.attestation) {
    throw new Error("ARTIFACT_ALREADY_ATTESTED");
  }
  const payload = canonicalize(body);
  return {
    ...structuredClone(body),
    attestation: {
      algorithm: "Ed25519",
      key_id: signer.keyId,
      signer_role: signer.role,
      public_key: signer.publicKeyHex,
      body_hash: sha256(payload),
      signature: crypto.sign(
        null,
        Buffer.from(payload, "utf8"),
        signer.privateKey
      ).toString("hex"),
    },
  };
}

function verifyArtifact(artifact, trustBinding) {
  if (!artifact || typeof artifact !== "object" || !artifact.attestation) {
    return { valid: false, reason: "ATTESTATION_MISSING" };
  }
  const attestation = artifact.attestation;
  const attestationKeys = [
    "algorithm",
    "key_id",
    "signer_role",
    "public_key",
    "body_hash",
    "signature",
  ];
  if (
    Object.keys(attestation).sort().join("\0") !==
      attestationKeys.sort().join("\0") ||
    attestation.algorithm !== "Ed25519" ||
    typeof attestation.key_id !== "string" ||
    typeof attestation.signer_role !== "string" ||
    !/^(?:[0-9a-f]{2})+$/.test(attestation.public_key) ||
    !/^[0-9a-f]{64}$/.test(attestation.body_hash) ||
    !/^[0-9a-f]{128}$/.test(attestation.signature)
  ) {
    return { valid: false, reason: "ATTESTATION_MALFORMED" };
  }
  if (
    trustBinding &&
    (attestation.key_id !== trustBinding.key_id ||
      attestation.public_key !== trustBinding.public_key ||
      attestation.signer_role !== trustBinding.role)
  ) {
    return { valid: false, reason: "SIGNER_ROLE_BINDING_MISMATCH" };
  }
  const payload = artifactPayload(artifact);
  if (attestation.body_hash !== sha256(payload)) {
    return { valid: false, reason: "ARTIFACT_HASH_MISMATCH" };
  }
  try {
    const key = ed25519PublicKeyFromHex(attestation.public_key);
    const valid = crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      key,
      Buffer.from(attestation.signature, "hex")
    );
    return { valid, reason: valid ? null : "ARTIFACT_SIGNATURE_INVALID" };
  } catch (error) {
    return { valid: false, reason: `ARTIFACT_SIGNATURE_ERROR:${error.message}` };
  }
}

function verifyVesperRecord(record, publicKey) {
  if (
    !record ||
    typeof record !== "object" ||
    !/^[0-9a-f]{128}$/.test(record.signature_hex || "") ||
    !/^(?:[0-9a-f]{2})+$/.test(publicKey || "")
  ) {
    return { valid: false, reason: "VESPER_SIGNATURE_MISSING" };
  }
  const body = structuredClone(record);
  const signature = body.signature_hex;
  delete body.signature_hex;
  try {
    const key = ed25519PublicKeyFromHex(publicKey);
    const valid = crypto.verify(
      null,
      Buffer.from(canonicalize(body), "utf8"),
      key,
      Buffer.from(signature, "hex")
    );
    return { valid, reason: valid ? null : "VESPER_SIGNATURE_INVALID" };
  } catch (error) {
    return { valid: false, reason: `VESPER_SIGNATURE_ERROR:${error.message}` };
  }
}

function verifyVesperGrant(grant, publicKey) {
  if (
    !grant ||
    typeof grant !== "object" ||
    !/^[0-9a-f]{128}$/.test(grant.signature_hex || "")
  ) {
    return { valid: false, reason: "VESPER_GRANT_SIGNATURE_MALFORMED" };
  }
  const signedMaterial = {
    audience: grant.audience,
    canonical_headers_hash: grant.canonical_headers_hash,
    expires_at: grant.expires_at,
    grant_id: grant.grant_id,
    key_id: grant.key_id,
    nonce: grant.nonce,
    payload_hash: grant.payload_hash,
  };
  try {
    const key = ed25519PublicKeyFromHex(publicKey);
    const valid = crypto.verify(
      null,
      Buffer.from(canonicalize(signedMaterial), "utf8"),
      key,
      Buffer.from(grant.signature_hex, "hex")
    );
    return { valid, reason: valid ? null : "VESPER_GRANT_SIGNATURE_INVALID" };
  } catch (error) {
    return { valid: false, reason: `VESPER_GRANT_SIGNATURE_ERROR:${error.message}` };
  }
}

module.exports = {
  artifactBody,
  artifactHash,
  artifactPayload,
  createFixtureSigner,
  publicKeyHex,
  signArtifact,
  verifyArtifact,
  verifyVesperGrant,
  verifyVesperRecord,
};
