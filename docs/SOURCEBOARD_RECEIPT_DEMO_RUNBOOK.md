# SourceBoard Receipt Demo Runbook

This runbook shows the first closed-loop path:

```text
SourceBoard allows
  -> SIM-MUS adapter maps
  -> receipt signs
  -> ledger appends
  -> chain verifies
  -> SourcePoint receives proof
```

## What this proves

This demo proves that a draft-only crossing can move through constitutional checks and return signed proof without changing the receipt core.

It does not prove production enforcement, external action, or policy completeness. It is a local closed-loop proof demo.

## One-time setup

Initialize a local MUS unit:

```bash
npm run init -- --owner "human:demo"
```

This creates a local unit, signing key, trusted key, empty ledger, and nonce stores.

## Run adapter and SourceBoard tests

```bash
npm run sourceboard:test
```

Expected result:

```text
Constitutional SourceBoard tests passed
SourceBoard to SIM-MUS demo test passed
SourceBoard to real receipt demo test passed
```

## Run the readable demo

```bash
npm run sourceboard:demo
```

This prints the readable path using a mock receipt return.

## Build a signed receipt without appending

```bash
npm run sourceboard:receipt
```

This builds a signed receipt object and returns it to SourcePoint, but does not append it to the ledger.

## Append and verify the full loop

```bash
npm run sourceboard:receipt:append
npm run verify-chain
```

Expected result:

```text
CHAIN VALID
```

## Keeper

The SourceBoard checks permission.
The SIM-MUS adapter maps the crossing.
The receipt signs the event.
The ledger preserves the proof.
The chain verifies return.
SourcePoint receives the proof.
