# ONE Local Field receipt lineage — repair-first source reconciliation R01

**Disposition:** Stacked draft, **RECONCILE pending exact-head GitHub CI** and cross-repository source verification. This is not a new receipt protocol or production signer.

## Exact inputs

- Correctness predecessor: [receipt PR #28](https://github.com/bkr1297-RIO/rio-receipt-protocol/pull/28), commit `b9440a6803e6a614d2430019724cbcc54f7ad76f` — target/body drift fail-closed, exact signed body including `mus_unit_id`, standalone validator, clean-checkout receipt CI and known public demo-key warning.
- Local Field source: [receipt PR #33](https://github.com/bkr1297-RIO/rio-receipt-protocol/pull/33), commit `8cb49727e98690f9f0dfb66625e3a182f321a6e9` — read-only verifier over a native signed Return, separate from the existing standalone receipt format.
- Source-only overlap: `README.md` and `package.json`. PR #28 and #33 otherwise changed disjoint paths. The repaired README claim ceiling was retained; the #33 bounded Local Field appendix was added. The #28 `npm test`/full suite remains intact, with #33 `test:local-field` added.
- The following four content files were **byte-preserving Git-blob copies** from #33 head into this descendant branch of #28: `spec/LOCAL_FIELD_RECEIPT_PROFILE_v0.1.md` (`47b09617fbc53b9c5ae3dea3783455906d7c8794`), `test/fixtures/local-field-runtime-proof.json` (`493844c21136cd00c46e7c3edc426f21a9597cb8`), `test/local-field-profile.test.js` (`ade9c24ae53187193ec97bc95645ff501f15d74f`), `verifier/local-field.js` (`531a24df57abbd0a1e85ff81af6d1e6cf334fe59`). Each destination blob was checked against its originating GitHub SHA after write.
- Receipt core CI is extended to run `npm run test:full` **and** `npm run test:local-field` on the exact integrated successor; generated receipts remain local verification artifacts.

## Dependency and claim bounds

This branch **descends from #28** and copies the relevant source of #33 with its origin made explicit. It does **not** claim #33's original Git commit is a parent, or silently replace that original PR. Its review PR should target the #28 branch, so the eventual merge order remains #28 → this successor.

The Local Field witness source binds architecture `7c1376162e37a1a609c24e6ec4c26e409426cca0`, protocol `17331406c39ed93771eb6ba89b8a06cdf1cda29b`, system `02ee34008123287a3b55dcfd974607172ef9c9d3`, and original receipt `8cb49727e98690f9f0dfb66625e3a182f321a6e9`. Transferring files changes local source custody, **not** the historical runtime trace, its originating receipt hash, or the other repositories' standing. Inspect pin compatibility before coordinating the four-repository release.

The historic demonstration signer in receipt #28 was already public; do not use it for independent custody. No private key rewrite, key revocation, external execution, product deployment, open-source release, constitutional promotion, or release approval is included.

## Exit

1. Both receipt-core/full and Local Field nine-case verifier workflows must pass at this exact successor head.
2. Independently inspect fixture trust roots and binding to current protocol/system/architecture heads, including repaired architecture #331 after #349/#352.
3. Retain #33 as `EXTRACT_THEN_CLOSE` review material **until** code, fixtures and cross-source references are proven carried. If closed, link this exact descendant successor; never mark the original PR merged.
4. SourcePoint may authorize separately the actual dependency-order PR merges. GitHub workflow success alone does not confer that authority.
