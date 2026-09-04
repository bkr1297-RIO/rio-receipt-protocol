# Demonstration key history notice

Status: security and claim-boundary notice; no history rewrite is performed here.

Repository history contains a demonstration signing private key and matching trust-registry entry. Because the repository is public, that historical key material is public and **must never be treated as evidence of an independent or secret signer**.

Users must run:

```sh
npm run init -- --owner "human:your-name"
```

before generating local receipts. Initialization creates a fresh local keypair and trust configuration. Any receipt tied to the repository's historical demonstration key has demonstration standing only.

Removing the key from the current tree would not remove it from Git history. Rewriting public history, invalidating clones or releases, and selecting a permanent key-rotation policy require a separate authorized decision. This notice records the present security fact without claiming that such remediation has occurred.
