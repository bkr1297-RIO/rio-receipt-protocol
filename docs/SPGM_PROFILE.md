# SPG-M Profile

SPG-M is an optional profile for mapping pattern-governance outcomes into the existing RIO receipt proof layer.

This profile is additive. It does not change receipt cryptography, canonicalization, ledger verification, or the current `ALLOW` / `BLOCK` decision model.

Current mapping:

- `PROCEED` may map to `ALLOW` only when existing receipt checks pass.
- `HOLD`, `CONTAIN`, `REFUSE`, `ESCALATE`, and `FAIL` map to `BLOCK`.

SPG-M details are carried as metadata under `validation.spgm` and boolean checks under `validation.checks`.
