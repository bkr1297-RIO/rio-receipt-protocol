# Verify This System

Verify the RIO Receipt Protocol in under 5 minutes.

Requirements: Node.js (v18+)

---

## Step 1 — Generate Receipts

```bash
node generate_receipt.js
```

This produces:

- `examples/valid_receipt.json` — ALLOW (intent matches execution)
- `examples/denied_receipt.json` — BLOCK (execution drifted from intent)

---

## Step 2 — Verify Valid Receipt

```bash
node verify_receipt.js examples/valid_receipt.json
```

Expected:

```
receipt_hash_valid: true
signature_valid: true
validation_present: true
validation_complete: true
OVERALL: PASS
```

---

## Step 3 — Verify Denied Receipt

```bash
node verify_receipt.js examples/denied_receipt.json
```

Expected:

```
receipt_hash_valid: true
signature_valid: true
validation_present: true
validation_complete: true
OVERALL: PASS
```

The receipt itself is valid (properly signed). The `decision: BLOCK` field records that execution was denied due to drift.

---

## Step 4 — Tamper Detection

```bash
node test_tamper.js
```

Expected:

```
TEST 1: VERIFY ORIGINAL RECEIPT
RESULT: PASS

TEST 2: TAMPER WITH RECEIPT
RESULT: FAIL

TAMPER DETECTION: WORKING
```

---

## Step 5 — Browser Verification

Open `verifier/index.html` in a browser.

1. Paste the contents of `examples/valid_receipt.json`
2. Click "Verify Receipt"
3. Confirm OVERALL: PASS

Then modify any field in the JSON and verify again. Confirm OVERALL: FAIL.

---

## What This Proves

1. Valid actions produce verifiable receipts
2. Drifted actions are blocked before execution
3. Tampered receipts are detected after the fact
4. Verification requires no external service
