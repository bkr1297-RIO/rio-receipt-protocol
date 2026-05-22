# SPG-M Receipt Mapping v0.1

This file records the initial mapping for the SPG-M profile adapter.

SPG-M is additive to the receipt protocol. It does not alter cryptography, canonicalization, ledger verification, or the current `ALLOW` / `BLOCK` decision model.

Current mapping:

- `PROCEED` may map to `ALLOW` only when existing receipt checks pass.
- `HOLD`, `CONTAIN`, `REFUSE`, `ESCALATE`, and `FAIL` map to `BLOCK`.

SPG-M profile details may be carried under `validation.spgm`, with boolean profile checks under `validation.checks`.
