/**
 * verify.js
 *
 * Browser-based receipt verification using Web Crypto API.
 * Recomputes hash, validates Ed25519 signature, checks validation block.
 */

function canonicalize(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

async function sha256(data) {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

async function importEd25519PublicKey(spkiHex) {
  const keyData = hexToBytes(spkiHex);
  return await crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "Ed25519" },
    false,
    ["verify"]
  );
}

async function verifySignature(payload, signatureHex, publicKeyHex) {
  try {
    const key = await importEd25519PublicKey(publicKeyHex);
    const sig = hexToBytes(signatureHex);
    const data = new TextEncoder().encode(payload);
    return await crypto.subtle.verify("Ed25519", key, sig, data);
  } catch (e) {
    return false;
  }
}

async function verifyReceipt(receipt) {
  const results = {
    receipt_hash_valid: false,
    signature_valid: false,
    validation_present: false,
    validation_complete: false,
    overall: "FAIL",
  };

  // 1. Recompute receipt_hash
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

  const payload = canonicalize(body);
  const computedHash = await sha256(payload);
  results.receipt_hash_valid = computedHash === receipt.receipt_hash;

  // 2. Validate signature
  results.signature_valid = await verifySignature(
    payload,
    receipt.signature,
    receipt.public_key
  );

  // 3. Validation block present
  results.validation_present = !!(
    receipt.validation &&
    receipt.validation.decision &&
    receipt.validation.checks &&
    receipt.validation.policy_version
  );

  // 4. Validation complete
  if (receipt.validation && receipt.validation.checks) {
    const required = [
      "intent_match",
      "context_match",
      "scope_valid",
      "execution_path_valid",
    ];
    results.validation_complete = required.every(
      (c) => typeof receipt.validation.checks[c] === "boolean"
    );
  }

  // Overall
  results.overall =
    results.receipt_hash_valid &&
    results.signature_valid &&
    results.validation_present &&
    results.validation_complete
      ? "PASS"
      : "FAIL";

  return results;
}

async function runVerify() {
  const input = document.getElementById("receiptInput").value.trim();
  const resultsDiv = document.getElementById("results");
  resultsDiv.style.display = "block";

  if (!input) {
    resultsDiv.innerHTML = '<div class="fail">No receipt JSON provided.</div>';
    return;
  }

  let receipt;
  try {
    receipt = JSON.parse(input);
  } catch (e) {
    resultsDiv.innerHTML = '<div class="fail">Invalid JSON: ' + e.message + "</div>";
    return;
  }

  const r = await verifyReceipt(receipt);

  const cls = (v) => (v ? "pass" : "fail");
  const lbl = (v) => (v ? "PASS" : "FAIL");

  resultsDiv.innerHTML = `
    <div class="check">Receipt ID: ${receipt.receipt_id || "N/A"}</div>
    <div class="check">Decision: ${receipt.decision || "N/A"}</div>
    <hr style="border-color:#333; margin:0.5rem 0;">
    <div class="check ${cls(r.receipt_hash_valid)}">receipt_hash_valid: ${lbl(r.receipt_hash_valid)}</div>
    <div class="check ${cls(r.signature_valid)}">signature_valid: ${lbl(r.signature_valid)}</div>
    <div class="check ${cls(r.validation_present)}">validation_present: ${lbl(r.validation_present)}</div>
    <div class="check ${cls(r.validation_complete)}">validation_complete: ${lbl(r.validation_complete)}</div>
    <hr style="border-color:#333; margin:0.5rem 0;">
    <div class="check ${cls(r.overall === 'PASS')}"><strong>OVERALL: ${r.overall}</strong></div>
  `;
}
