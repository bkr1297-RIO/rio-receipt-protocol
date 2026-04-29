/**
 * mus-init.js
 *
 * Initialize a local receipt engine / MUS Unit candidate.
 *
 * Creates:
 *   - config/mus-unit.json (unit ID, owner handle, created timestamp)
 *   - trust/signing_key.json (Ed25519 keypair)
 *   - trust/trusted_keys.json (public key trust anchor)
 *   - ledger/ledger.jsonl (empty append-only ledger)
 *   - runtime/nonce_store.json (empty nonce store)
 *   - runtime/verified_nonces.json (empty verified nonce store)
 *
 * Usage:
 *   node mus-init.js
 *   node mus-init.js --owner "human:alice"
 *   node mus-init.js --force
 *
 * Flags:
 *   --owner <handle>   Set the local owner identity (default: "human:local")
 *   --force            Overwrite existing config and keys
 *
 * No external dependencies. Uses only Node.js built-in crypto and fs.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// --- Parse CLI args ---

const args = process.argv.slice(2);
let owner = "human:local";
let force = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--owner" && args[i + 1]) {
    owner = args[i + 1];
    i++;
  } else if (args[i] === "--force") {
    force = true;
  }
}

// --- Paths ---

const CONFIG_DIR = path.join(__dirname, "config");
const TRUST_DIR = path.join(__dirname, "trust");
const LEDGER_DIR = path.join(__dirname, "ledger");
const RUNTIME_DIR = path.join(__dirname, "runtime");

const CONFIG_PATH = path.join(CONFIG_DIR, "mus-unit.json");
const SIGNING_KEY_PATH = path.join(TRUST_DIR, "signing_key.json");
const TRUSTED_KEYS_PATH = path.join(TRUST_DIR, "trusted_keys.json");
const LEDGER_PATH = path.join(LEDGER_DIR, "ledger.jsonl");
const NONCE_STORE_PATH = path.join(RUNTIME_DIR, "nonce_store.json");
const VERIFIED_NONCES_PATH = path.join(RUNTIME_DIR, "verified_nonces.json");

// --- Check existing ---

if (!force && fs.existsSync(CONFIG_PATH)) {
  console.error("ERROR: Local MUS Unit already initialized.");
  console.error("  Config: " + CONFIG_PATH);
  console.error("  Use --force to overwrite.");
  process.exit(1);
}

// --- Create directories ---

[CONFIG_DIR, TRUST_DIR, LEDGER_DIR, RUNTIME_DIR].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

// --- Generate unit ID ---

const unitId = "mus-" + crypto.randomUUID();

// --- Generate Ed25519 keypair ---

const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");

const privKeyDer = privateKey.export({ type: "pkcs8", format: "der" });
const pubKeyDer = publicKey.export({ type: "spki", format: "der" });

const privKeyHex = privKeyDer.toString("hex");
const pubKeyHex = pubKeyDer.toString("hex");

// --- Write config ---

const config = {
  mus_unit_id: unitId,
  owner: owner,
  created: new Date().toISOString(),
  protocol_version: "1.0.0",
  engine_version: "0.3.0",
  description: "Local Receipt Engine — Portable MUS Unit candidate",
};

fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");

// --- Write signing key ---

fs.writeFileSync(
  SIGNING_KEY_PATH,
  JSON.stringify(
    {
      private_key: privKeyHex,
      public_key: pubKeyHex,
    },
    null,
    2
  ) + "\n"
);

// --- Write trusted keys ---

fs.writeFileSync(
  TRUSTED_KEYS_PATH,
  JSON.stringify({ trusted_keys: [pubKeyHex] }, null, 2) + "\n"
);

// --- Write empty ledger ---

fs.writeFileSync(LEDGER_PATH, "");

// --- Write empty nonce stores ---

fs.writeFileSync(
  NONCE_STORE_PATH,
  JSON.stringify({ used_nonces: [] }, null, 2) + "\n"
);

fs.writeFileSync(
  VERIFIED_NONCES_PATH,
  JSON.stringify({ used_nonces: [] }, null, 2) + "\n"
);

// --- Output ---

console.log("=== MUS Unit Initialized ===");
console.log("");
console.log("Unit ID:    " + unitId);
console.log("Owner:      " + owner);
console.log("Public Key: " + pubKeyHex.substring(0, 32) + "...");
console.log("");
console.log("Files created:");
console.log("  " + CONFIG_PATH);
console.log("  " + SIGNING_KEY_PATH);
console.log("  " + TRUSTED_KEYS_PATH);
console.log("  " + LEDGER_PATH);
console.log("  " + NONCE_STORE_PATH);
console.log("  " + VERIFIED_NONCES_PATH);
console.log("");
console.log("Next steps:");
console.log("  npm run demo     — generate receipts and append to ledger");
console.log("  npm run verify-chain  — verify the ledger hash chain");
console.log("");
console.log("The protocol proves the grammar.");
console.log("The Local Receipt Engine makes the grammar portable.");
