const test = require('node:test');
const assert = require('node:assert/strict');
const proof = require('./fixtures/local-field-runtime-proof.json');
let verifyLocalFieldProof;
try {
  ({ verifyLocalFieldProof } = require('../verifier/local-field.js'));
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
}
const verify = (p) => {
  assert.equal(typeof verifyLocalFieldProof, 'function');
  return verifyLocalFieldProof(p, proof.anchor.public_key_hex);
};
test('real gateway receipt profile reconstructs distinct attempt occurrence and Return', () => {
  const r = verify(proof);
  assert.equal(r.valid, true);
  assert.equal(r.occurrence_claim, 'OBSERVED');
  assert.equal(r.authorization_created, false);
});
for (const [name, mutate] of [
  [
    'decision',
    (p) => {
      p.chain.decision.status = 'DENIED';
    },
  ],
  [
    'occurrence',
    (p) => {
      p.chain.occurrence.content_hash = '0'.repeat(64);
    },
  ],
  [
    'Return correlation',
    (p) => {
      p.chain.return.correlation_id = 'wrong';
    },
  ],
  [
    'Return outcome',
    (p) => {
      p.chain.return.outcome = 'NEVER_EXECUTED';
    },
  ],
  [
    'intent projection',
    (p) => {
      p.chain.intent.action = 'different';
    },
  ],
  [
    'signature',
    (p) => {
      p.chain.receipt.local_field_attestation.signature = '0'.repeat(128);
    },
  ],
  [
    'receiver attribution',
    (p) => {
      p.chain.receipt.local_field_attestation.signer_id = 'field-node-a';
    },
  ],
])
  test(`modified ${name} fails without rewriting authorization`, () => {
    const p = structuredClone(proof);
    mutate(p);
    assert.equal(verify(p).valid, false);
    assert.equal(proof.chain.decision.status, 'ADMITTED');
  });
test('receipt-provided key cannot replace the external trust anchor', () => {
  assert.equal(typeof verifyLocalFieldProof, 'function');
  assert.equal(verifyLocalFieldProof(proof, '00'.repeat(32)).valid, false);
});
