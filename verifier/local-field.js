/** Read-only verifier for the existing gateway five-hash receipt profile.
 * Does not issue authority, create receipts, consume nonces, or mutate ledgers.
 * The caller supplies the human-root verification key out of band.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const canonical = (value) =>
  value === null || typeof value !== 'object'
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? '[' + value.map(canonical).join(',') + ']'
      : '{' +
        Object.keys(value)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
          .join(',') +
        '}';
const digest = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');
const equal = (a, b) => canonical(a) === canonical(b);
function signature(payload, sig, rawKey) {
  if (!/^[0-9a-f]{64}$/.test(rawKey) || !/^[0-9a-f]{128}$/.test(sig))
    return false;
  const key = crypto.createPublicKey({
    key: Buffer.from('302a300506032b6570032100' + rawKey, 'hex'),
    format: 'der',
    type: 'spki',
  });
  return crypto.verify(
    null,
    Buffer.from(canonical(payload)),
    key,
    Buffer.from(sig, 'hex'),
  );
}
function projectedHash(value, fields) {
  return digest(
    JSON.stringify(Object.fromEntries(fields.map((k) => [k, value[k]]))),
  );
}
function verifyLocalFieldProof(proof, trustedRootKey) {
  try {
    const demand = (condition) => {
      if (!condition) throw new Error('PROFILE_INTEGRITY_OR_CORRELATION');
    };
    const c = proof.chain,
      p = c.passage.body,
      r = c.receipt,
      a = c.receipt_artifacts;
    demand(proof.anchor.public_key_hex === trustedRootKey);
    demand(
      signature(
        proof.definition.body,
        proof.definition.signature,
        trustedRootKey,
      ),
    );
    demand(
      proof.definition.body.sourcepoint === proof.anchor.principal_id &&
        proof.definition.body.field_id === p.field_id,
    );
    const nodes = new Map();
    for (const e of proof.controls.filter(
      (r) => r.body.type === 'enrollment',
    )) {
      demand(
        e.body.issuer === proof.anchor.principal_id &&
          e.body.field_id === p.field_id &&
          signature(e.body, e.signature, trustedRootKey),
      );
      demand(!nodes.has(e.body.node.node_id));
      nodes.set(e.body.node.node_id, e.body.node);
    }
    demand(
      new Set([...nodes.values()].map((n) => n.public_key_hex)).size ===
        nodes.size,
    );
    const { local_field_attestation, ...native } = r,
      { signature: sig, ...binding } = local_field_attestation;
    demand(
      binding.profile === 'rio-gateway-local-field-v0.1' &&
        binding.field_id === p.field_id &&
        binding.passage_id === p.passage_id,
    );
    demand(
      binding.signer_id === proof.definition.body.receiver_node &&
        binding.signer_id === p.target_node,
    );
    demand(
      signature(
        { receipt: native, binding },
        sig,
        nodes.get(binding.signer_id).public_key_hex,
      ),
    );
    demand(
      signature(
        p,
        c.passage.signature,
        nodes.get(p.source_node).public_key_hex,
      ),
    );
    const hashes = r.hash_chain;
    demand(
      hashes.intent_hash ===
        projectedHash(a.intent, [
          'intent_id',
          'action',
          'agent_id',
          'parameters',
          'timestamp',
        ]),
    );
    demand(
      hashes.governance_hash ===
        projectedHash(a.governance, [
          'intent_id',
          'status',
          'risk_level',
          'requires_approval',
          'checks',
        ]),
    );
    demand(
      hashes.authorization_hash ===
        projectedHash(
          {
            ...a.authorization,
            conditions: a.authorization.conditions || null,
          },
          ['intent_id', 'decision', 'authorized_by', 'timestamp', 'conditions'],
        ),
    );
    demand(
      hashes.execution_hash ===
        projectedHash(a.execution, [
          'intent_id',
          'action',
          'result',
          'connector',
          'timestamp',
        ]),
    );
    demand(
      hashes.receipt_hash ===
        projectedHash(
          { receipt_id: r.receipt_id, ...hashes, timestamp: r.timestamp },
          [
            'receipt_id',
            'intent_hash',
            'governance_hash',
            'authorization_hash',
            'execution_hash',
            'timestamp',
          ],
        ),
    );
    demand(
      equal(a.intent, c.intent) &&
        equal(a.intent.parameters.passage, p) &&
        p.payload_hash === digest(canonical(p.payload)),
    );
    demand(
      equal(a.governance.checks.decision, c.decision) &&
        c.decision.status === 'ADMITTED' &&
        c.decision.passage_hash === digest(canonical(p)),
    );
    demand(
      c.fidelity.status === 'PASS' &&
        c.fidelity.decision_id === c.decision.decision_id &&
        c.fidelity.passage_hash === c.decision.passage_hash,
    );
    demand(
      equal(a.execution.result.fidelity, c.fidelity) &&
        equal(a.execution.result.attempt, c.attempt) &&
        equal(a.execution.result.occurrence, c.occurrence),
    );
    demand(
      c.attempt.passage_id === p.passage_id &&
        c.attempt.target === p.target &&
        c.attempt.action === p.action &&
        c.attempt.payload_hash === p.payload_hash,
    );
    demand(a.execution.result.provenance.proposed === p.source_node);
    demand(
      ['admitted', 'attempted', 'observed', 'returned'].every(
        (k) => a.execution.result.provenance[k] === binding.signer_id,
      ),
    );
    const grants = a.authorization.conditions.lineage;
    demand(
      equal(
        grants.map((g) => g.body.grant.grant_id),
        c.decision.authority_lineage,
      ) && grants.at(-1).body.grant.grant_id === p.authority_basis,
    );
    for (let i = 0; i < grants.length; i++) {
      const g = grants[i],
        issuer =
          g.body.issuer === proof.anchor.principal_id
            ? trustedRootKey
            : nodes.get(g.body.issuer).public_key_hex;
      demand(
        g.body.field_id === p.field_id &&
          signature(g.body, g.signature, issuer),
      );
      demand(
        i === 0
          ? g.body.issuer === proof.anchor.principal_id &&
              g.body.grant.parent === null
          : g.body.grant.parent === grants[i - 1].body.grant.grant_id,
      );
    }
    const { attestation, ...returned } = c.return,
      { signature: returnSignature, ...returnBinding } = attestation;
    demand(
      returnBinding.profile === 'rio-gateway-local-field-return-v0.1' &&
        returnBinding.field_id === p.field_id &&
        returnBinding.signer_id === binding.signer_id,
    );
    demand(
      signature(
        { returned, binding: returnBinding },
        returnSignature,
        nodes.get(binding.signer_id).public_key_hex,
      ),
    );
    demand(
      c.return.passage_id === p.passage_id &&
        c.return.intent_id === p.intent_id &&
        c.return.correlation_id === p.correlation_id &&
        c.return.to === p.return_requirement.to &&
        c.return.receipt_id === r.receipt_id,
    );
    demand(a.execution.result.correlation_id === p.correlation_id);
    return {
      valid: true,
      passage_id: p.passage_id,
      receipt_id: r.receipt_id,
      occurrence_claim: c.occurrence.status,
      authorization_created: false,
      evidence_ceiling:
        'Integrity and correlation of attributed historical records; not current standing or independent external truth',
    };
  } catch (e) {
    return { valid: false, reason: e.message, authorization_created: false };
  }
}
module.exports = { verifyLocalFieldProof };
if (require.main === module) {
  const [proofFile, keyFile] = process.argv.slice(2);
  if (!proofFile || !keyFile)
    throw new Error(
      'Usage: node verifier/local-field.js PROOF.json TRUSTED-ROOT-PUBLIC-KEY.txt',
    );
  const result = verifyLocalFieldProof(
    JSON.parse(fs.readFileSync(proofFile, 'utf8')),
    fs.readFileSync(keyFile, 'utf8').trim(),
  );
  console.log(JSON.stringify(result));
  process.exitCode = result.valid ? 0 : 1;
}
