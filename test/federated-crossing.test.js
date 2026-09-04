const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { produceFederatedCrossing, CEILING } = require("../federation-fixture/produce");
const { readJson, writeJsonDurable } = require("../occurrence-return/io");

function fixture(t) { const root=fs.mkdtempSync(path.join(os.tmpdir(),"one-fed-test-")); t.after(()=>fs.rmSync(root,{recursive:true,force:true})); return {root, produced:produceFederatedCrossing(root)}; }
function verify({root,produced}) { const r=spawnSync(process.execPath,[path.resolve(__dirname,"..","federation-fixture","verify.js"),root,produced.return_journal_head,produced.mus_ledger_head],{encoding:"utf8"}); return {r, out:JSON.parse(r.stdout.trim().split("\n").at(-1))}; }
test("two distinct jurisdictions close only a local, unpromoted federated fixture",t=>{ const f=fixture(t),x=verify(f); assert.equal(x.r.status,0,x.r.stderr); assert.equal(x.out.terminal_state,"FEDERATED_RETURNED_UNPROMOTED"); assert.equal(x.out.claim_ceiling,CEILING); assert.ok(x.out.excluded_claims.includes("production-federation")); });
test("a Door is not a Crossing",t=>{ const f=fixture(t); fs.unlinkSync(path.join(f.root,"crossing.json")); const x=verify(f); assert.equal(x.r.status,1); assert.ok(x.out.errors.some(e=>e.includes("MISSING_OR_INVALID:crossing.json")||e.includes("CROSSING_"))); });
test("world, Doors, and crossing hashes are non-substitutable",t=>{ const f=fixture(t),p=path.join(f.root,"doors","door-a-to-k.json"),d=readJson(p); d.allowed_actions=["execute_external_effect"]; writeJsonDurable(p,d); const x=verify(f); assert.equal(x.r.status,1); assert.ok(x.out.errors.some(e=>e.includes("ATTESTATION_REJECTED:entryDoor")||e.includes("DOOR_"))); });
test("Trace is not proof of lawfulness",t=>{ const f=fixture(t),p=path.join(f.root,"crossing-trace.json"),v=readJson(p); v.lawfulness_status="LAWFUL"; writeJsonDurable(p,v); const x=verify(f); assert.equal(x.r.status,1); assert.ok(x.out.errors.some(e=>e.includes("ATTESTATION_REJECTED:trace")||e.includes("TRACE_NOT_PROOF"))); });
test("both campuses receive separate returns; one return cannot stand for both",t=>{ const f=fixture(t),p=path.join(f.root,"returns","return-b.json"),v=readJson(p); v.recipient_campus_ref="campus:fixture-a"; writeJsonDurable(p,v); const x=verify(f); assert.equal(x.r.status,1); assert.ok(x.out.errors.some(e=>e.includes("ATTESTATION_REJECTED:returnB")||e.includes("RECIPIENT_SPECIFIC_RETURN_REJECTED:b"))); });
test("compliance is typed but remains explicitly unassessed",t=>{ const f=fixture(t),p=path.join(f.root,"compliance-assessment.json"),v=readJson(p); v.determination="LAWFUL"; writeJsonDurable(p,v); const x=verify(f); assert.equal(x.r.status,1); assert.ok(x.out.errors.some(e=>e.includes("ATTESTATION_REJECTED:compliance")||e.includes("COMPLIANCE_STANDING"))); });
test("a clean return-journal truncation cannot close against external head",t=>{ const f=fixture(t),p=path.join(f.root,"return-journal.jsonl"),lines=fs.readFileSync(p,"utf8").trim().split("\n"); fs.writeFileSync(p,lines.slice(0,-1).join("\n")+"\n"); const x=verify(f); assert.equal(x.r.status,1); assert.ok(x.out.errors.includes("RETURN_JOURNAL_RECONSTRUCTION_REJECTED")); });
