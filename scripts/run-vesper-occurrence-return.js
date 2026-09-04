#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error || result.signal || result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${path.basename(args[0])} failed${detail ? `:\n${detail}` : ""}`);
  }
  return JSON.parse(result.stdout.trim().split("\n").at(-1));
}

function main() {
  const suppliedWorkspace = process.argv[2];
  const workspace = suppliedWorkspace
    ? path.resolve(suppliedWorkspace)
    : fs.mkdtempSync(path.join(os.tmpdir(), "one-vesper-closure-"));

  try {
    const produced = run(process.execPath, [
      path.resolve(__dirname, "..", "occurrence-return", "produce.js"),
      workspace,
    ]);
    const verified = run(process.execPath, [
      path.resolve(__dirname, "..", "occurrence-return", "verify.js"),
      workspace,
      produced.return_journal_head,
      produced.mus_ledger_head,
    ]);
    process.stdout.write(
      JSON.stringify(
        {
          ok: verified.ok,
          episode_id: produced.episode_id,
          terminal_state: verified.terminal_state,
          claim_ceiling: verified.claim_ceiling,
          excluded_claims: verified.excluded_claims,
          durable_workspace: suppliedWorkspace ? workspace : null,
        },
        null,
        2
      ) + "\n"
    );
  } finally {
    if (!suppliedWorkspace) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}
