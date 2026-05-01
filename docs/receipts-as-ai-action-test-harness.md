# Receipts as the Test Harness for AI Action

**Status:** `public_architecture_draft`
**Date:** 2026-05-01

---

## Core Thesis

> The future of AI does not only need smarter models. It needs verifiable action.

AI is moving from answering to acting. Large language models that once only generated text now send emails, move money, modify databases, schedule meetings, write code, and operate physical systems. The moment AI acts on behalf of a human, a new requirement emerges that no amount of model improvement can satisfy: **proof that the action was authorized, executed, and recorded.**

Action creates consequence. Consequence needs accountability. Accountability needs proof. Receipts are the proof primitive.

---

## What This Repo Provides Now

This repository implements a minimal, zero-dependency receipt protocol that proves governed AI/software events were recorded and verifiable:

- **Receipt generation** — canonical JSON receipts with SHA-256 integrity hashes and Ed25519 signatures
- **Receipt verification** — single-receipt and full-chain verification tools
- **Hash-chain ledger** — append-only JSONL ledger where each receipt links to its predecessor
- **Tamper detection** — any modification, deletion, reordering, or insertion breaks the chain
- **Nonce replay prevention** — reused nonces are detected and blocked
- **Trust boundary** — only receipts signed by explicitly trusted keys pass verification
- **Browser verifier** — client-side verification without server trust
- **Portable local receipt engine** — runs on any machine with Node.js 18+, no cloud dependency

The protocol enforces one invariant: **if it changes after approval, it does not run. If it runs, you can prove it ran as approved.**

---

## What This Repo Does Not Claim

This repository is a proof layer, not a complete governance system. It does not claim to be:

- A policy engine (it does not decide what should be allowed)
- An approval system (it does not collect human decisions)
- A risk evaluator (it does not assess blast radius or severity)
- A legal or compliance certification (it proves cryptographic integrity, not regulatory compliance)
- A moral framework (it proves the action was authorized, not that it was wise or right)
- A real-time monitoring system (it creates and verifies proof records, not live telemetry)
- A complete AI governance platform (it is one layer of a larger system)

The receipt protocol proves events. It does not prove wisdom, legality, morality, or future permission.

---

## Why Agentic AI Needs Receipts

Agentic AI systems — autonomous agents that plan, decide, and execute multi-step workflows — operate with increasing independence. An agent that books flights, manages calendars, and sends communications on behalf of a human is exercising delegated authority. Without receipts:

- The human cannot verify what the agent actually did versus what it was asked to do
- There is no tamper-evident record of the execution sequence
- There is no way to prove the agent stayed within its authorized scope
- There is no mechanism to detect if the agent's actions were modified after approval

Receipts give agentic AI a verifiable execution trail. Every action the agent takes produces a signed, hash-chained record that the delegating human — or any authorized auditor — can independently verify without trusting the agent itself.

---

## Why Personal AI Needs Receipts

Personal AI assistants manage private information: health data, financial records, personal communications, family schedules. When a personal AI acts on this information — sending a message, making a purchase, sharing a document — the human owner needs proof that:

- The action matched what was requested
- The action was not modified between approval and execution
- The action was not replayed or duplicated
- The scope of access was not exceeded

Receipts provide the personal AI owner with a verifiable history of what their AI did, when, and under what authority. This is not surveillance of the AI — it is accountability infrastructure that protects the human.

---

## Why Fiduciary / Proxy AI Needs Receipts

A fiduciary AI — one that acts on behalf of another person with a duty of care — faces the highest accountability standard. A digital proxy managing someone's affairs (financial, medical, legal, personal) must be able to prove:

- Every action was explicitly authorized by the principal
- No action exceeded the scope of delegated authority
- The authorization was time-bound and single-use (not an open-ended permission)
- The outcome was recorded before the authorization token was consumed

This is the domain where receipts become infrastructure, not a feature. A fiduciary AI without receipts is an unaccountable proxy. A fiduciary AI with receipts can prove, to any third party, that it operated within its mandate.

---

## Why Enterprise AI Needs Receipts

Enterprise AI systems operate at scale across organizations: processing invoices, managing supply chains, handling customer data, making procurement decisions. The enterprise context adds:

- Multiple principals with different authority levels
- Regulatory requirements for audit trails
- Cross-organizational trust boundaries
- Compliance obligations that require provable records

Receipts give enterprise AI a machine-verifiable audit trail that does not depend on the AI system's own logs (which the AI could theoretically modify). External verification using only the public key and the receipt chain provides trust without requiring trust in the AI vendor.

---

## Why Robotic / Embodied AI Needs Receipts

When AI controls physical systems — robots, vehicles, medical devices, industrial equipment — the consequences of unauthorized or unverified action are irreversible in the physical world. A robotic AI needs receipts because:

- Physical actions cannot be "undone" the way digital actions sometimes can
- The authorization chain must be provable before the physical action occurs
- Post-incident investigation requires tamper-evident records of what was authorized versus what was executed
- Safety-critical systems require proof that the execution matched the approved parameters exactly

Receipts extend the accountability boundary from the digital domain into the physical domain. The same verification logic that proves an email was sent as approved can prove a robotic arm moved as authorized.

---

## How Receipts Support the Full Decision Lifecycle

Receipts do not only prove successful execution. They support the full range of governance outcomes:

| Outcome | Receipt Role |
|---------|-------------|
| **Approved and executed** | Receipt proves execution matched approval |
| **Approved but failed** | Receipt records failure with execution_hash of error state |
| **Refused** | No execution receipt — approval record shows rejection |
| **Blocked at gate** | Validation receipt shows which check failed and why |
| **Expired** | Token expiry is recorded — no valid receipt can be generated after timeout |
| **Learning** | Receipt history feeds back into future risk evaluation and approval patterns |

The receipt chain captures not just what happened, but what was prevented. A blocked action with a clear denial reason is as valuable for accountability as a successful execution.

---

## The Boundary

Receipts prove events. They do not prove everything.

| Receipts Prove | Receipts Do Not Prove |
|---------------|----------------------|
| The action was authorized | The action was wise |
| The action was executed as approved | The action was morally correct |
| The execution result was recorded | The action was legally compliant |
| The record has not been tampered with | The action will be permitted again |
| The signer is identified | The signer had good judgment |
| The chain is intact | The chain contains every possible event |

> **The receipt protocol does not build the whole AI system. It gives every AI system something to answer to.**

---

## The Shift

The AI industry is optimizing for capability — faster inference, larger context, better reasoning. These are necessary but insufficient. The moment AI crosses from "what should I say?" to "what should I do?" — the accountability gap opens.

Receipts close that gap. Not by limiting what AI can do, but by ensuring that what AI does is provable, verifiable, and attributable.

> **When AI moves from response to consequence, receipts become infrastructure.**

---

## Next Steps

This repository is the proof layer. It intentionally stops at receipt generation, verification, and local persistence. To build a complete governed AI system on top of this protocol, you will need:

- An approval layer (human-in-the-loop decisions)
- A gateway to enforce execution boundaries
- A policy layer for constraints and risk evaluation
- A lifecycle view to make the governance arc human-readable

This repo provides the primitive. The systems built on top of it decide what to govern and how. The receipt protocol only asks: can you prove it?
