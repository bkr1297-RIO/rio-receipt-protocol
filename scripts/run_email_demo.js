import fs from "fs";
import crypto from "crypto";
import { sendEmail } from "../adapters/send_email.js";

function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const intent = JSON.parse(fs.readFileSync("./examples/email_intent.json"));
const execution = JSON.parse(fs.readFileSync("./examples/email_execution.json"));

const intentHash = sha256(canonicalize(intent));
const executionHash = sha256(canonicalize(execution));

const validation = {
  intent_match: intentHash === executionHash,
  context_match: true,
  scope_valid: execution.action === "send_email",
  execution_path_valid: execution.action === "send_email"
};

const decision = Object.values(validation).every(v => v) ? "ALLOW" : "BLOCK";

if (decision !== "ALLOW") {
  console.log("BLOCKED:", validation);
  process.exit(0);
}

const result = sendEmail(execution);

const receipt = {
  receipt_id: "rcpt_" + Date.now(),
  intent_hash: intentHash,
  execution_hash: executionHash,
  validation: { decision, checks: validation },
  result,
  timestamp: new Date().toISOString()
};

fs.writeFileSync("./examples/email_receipt.json", JSON.stringify(receipt, null, 2));
console.log("SUCCESS: Receipt generated");
