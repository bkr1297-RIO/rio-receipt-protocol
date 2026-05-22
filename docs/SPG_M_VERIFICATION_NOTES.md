# SPG-M Verification Notes

SPG-M is an optional profile adapter for mapping pattern-governance outcomes into the current RIO receipt proof layer.

This profile remains additive. It does not change receipt cryptography, canonicalization, hash-chain verification, ledger behavior, or the current `ALLOW` / `BLOCK` decision model.

## Verification Commands

Run the SPG-M mapping tests:

```bash
npm run spgm
```

Run the SPG-M demo after local initialization:

```bash
npm run init -- --owner "human:your-name"
npm run spgm:demo
npm run verify-chain
```

Run the full test suite:

```bash
npm test
```

## Expected Behavior

The SPG-M mapping test verifies that:

- containment maps to `BLOCK`,
- refusal maps to `BLOCK`,
- escalation maps to `BLOCK`,
- failure maps to `BLOCK`,
- symbolic interpretation alone does not produce `ALLOW`,
- machine-assisted interpretation is metadata, not authority,
- SPG-M metadata is hash-bound when placed under `validation.spgm`,
- the current `ALLOW` / `BLOCK` receipt model remains intact.

The SPG-M demo creates a receipt-compatible containment scenario and appends a signed `BLOCK` receipt through the existing ledger path.

## Files

- `spgm/README.md` — profile adapter overview
- `docs/SPGM_PROFILE.md` — concise profile note
- `docs/SPG_M_ENTERPRISE_PATTERN_GOVERNANCE.md` — enterprise framing
- `spec/SPG_M_RECEIPT_PROTOCOL_MAPPING_v0.1.md` — receipt mapping note
- `examples/spgm_containment_receipt.json` — containment example
- `scripts/run_spgm_demo.js` — local demo runner
- `test/spgm-receipt-mapping.test.js` — profile mapping tests

## Boundary

SPG-M may explain why a receipt-compatible event is blocked. It does not authorize action, prove symbolic interpretation, replace RIO/MUSS governance, or create new receipt decision enums.
