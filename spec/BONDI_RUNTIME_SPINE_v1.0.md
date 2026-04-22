# Bondi Runtime Spine

**Version:** 1.0.0
**Status:** Orchestration Specification
**Category:** Orchestration Layer (above RIO)

---

## 1. Purpose

The Bondi Runtime Spine defines the event model, shared context log, synchronization modes, and operational rules that govern how Bondi processes information at runtime.

Bondi does not execute actions. The runtime spine is an information processing and routing infrastructure, not an execution environment.

---

## 2. Event / Packet Model

All information flowing through Bondi is structured as events.

Each event contains:

| Field | Type | Description |
|-------|------|-------------|
| `event_id` | string | Unique identifier |
| `parent_id` | string | Parent task or event identifier |
| `source` | string | Origin of the event (human, LLM, API, system) |
| `timestamp` | integer | UTC milliseconds since epoch |
| `event_type` | string | Category: `input`, `normalized`, `routed`, `response`, `composed`, `decision` |
| `payload` | object | Event-specific content |

Events are immutable after creation. Corrections produce new events that reference the original.

Events represent immutable records written to the shared context log. Packets represent structured units of work created by Bondi. All packets must reference one or more source events. Bondi must not treat packets as source-of-truth. Events are authoritative. Packets are derived.

Packets must not be written to the event log as source events unless explicitly wrapped as a new, attributed event.

---

## 3. Shared Context Log

The shared context log is the runtime memory of a Bondi session. All events are written to the context log in order.

### 3.1 Read/Write Separation

| Operation | Who | Description |
|-----------|-----|-------------|
| Write | Bondi | Bondi writes events as they occur during processing |
| Read | Bondi | Bondi reads context to inform routing and prompt shaping |
| Read | MANTIS | MANTIS reads context for pattern observation (see Section 10) |
| Write | MANTIS | Not permitted. MANTIS observes only. |

Bondi writes to the context log. MANTIS reads from the context log. No other component writes to the context log during a session.

### 3.2 Context Rules

All events in the context log must be:

- **Source-attributed.** Every event identifies its origin.
- **Timestamped.** Every event records when it was created (UTC).
- **Immutable.** No event is modified after creation. Corrections produce new events.

Bondi must indicate when context is incomplete, stale, or inferred.

---

## 4. Synchronization Modes

The context log supports three synchronization modes for multi-device or multi-session access.

| Mode | Trigger | Description |
|------|---------|-------------|
| Real-time | Continuous | Events are synchronized as they are written |
| Periodic | Interval | Events are batched and synchronized at defined intervals |
| Manual | Human-initiated | Synchronization occurs only when the human operator requests it |

The default mode is real-time. The human operator may change the mode at any time.

---

## 5. State Machine

The full Bondi processing state machine:

```
intake → normalized → decomposed → routed → collected → filtered → composed → presented → awaiting_decision
```

| State | Description |
|-------|-------------|
| `intake` | Raw human input received |
| `normalized` | Input transformed into structured intent |
| `decomposed` | Intent split into routable sub-tasks |
| `routed` | Sub-tasks dispatched to capability providers |
| `collected` | Responses received from capability providers |
| `filtered` | Responses checked against active constraints |
| `composed` | Filtered responses assembled into single presentation |
| `presented` | Presentation delivered to human operator |
| `awaiting_decision` | Waiting for human direction |

Each state transition produces an event in the context log.

---

## 6. Prioritization

Bondi may prioritize sub-tasks or responses during composition.

Prioritization rules:

- Prioritization is allowed only when explicit criteria have been defined (by the human operator or by policy)
- The criteria used for prioritization must be visible to the human operator
- Bondi does not apply implicit prioritization based on its own judgment
- Bondi must not introduce prioritization criteria implicitly
- All prioritization must be explicitly defined, inspectable, and attributable

If no prioritization criteria are defined, items are presented in the order they were received.

---

## 7. Reminders and Nudges

Bondi may issue reminders or nudges to the human operator.

Rules:

- Reminders are allowed only via explicit delegation from the human operator
- Each reminder must show its trigger (what condition caused it) and its origin (which delegation authorized it)
- Reminders must be non-coercive: they inform, they do not pressure or manipulate
- The human operator may revoke reminder delegation at any time
- Bondi must not increase the frequency, intensity, or scope of reminders beyond explicitly delegated rules

---

## 8. No Context-to-Action Shortcut

Bondi must not initiate action from context alone.

Even if the context log contains information that suggests an action would be beneficial, Bondi does not:

- Submit action requests to RIO without human direction
- Pre-authorize or pre-approve actions
- Queue actions for automatic execution

The path from context to action always passes through the human operator.

Bondi must not generalize a refusal beyond the specific triggering constraint.

---

## 9. Error Handling

When a capability provider fails to respond or returns an error:

- The failure is recorded as an event in the context log
- The failure is included in the composed presentation
- Bondi does not retry without human direction
- Bondi does not substitute a different provider without human direction

---

## 10. MANTIS Relationship

Bondi and MANTIS have distinct roles:

| Component | Role |
|-----------|------|
| Bondi | Reads context, routes intent, composes responses |
| MANTIS | Reads context, stores patterns, surfaces observations |

Bondi does not remember across sessions. Session context is in the context log. Long-term patterns are in MANTIS.

Bondi may query MANTIS for patterns relevant to the current task. MANTIS responds with observations, not directives. Bondi decides how to use the observation within its routing and composition logic.

MANTIS does not write to the Bondi context log. MANTIS does not route, compose, or present.

---

## 11. Invariants

- Bondi does not execute actions.
- Bondi does not approve actions.
- Bondi does not generate execution tokens.
- Bondi does not modify receipts or the ledger.
- Bondi does not create or modify authority relationships.
- All events are source-attributed, timestamped, and immutable.
- Prioritization requires explicit criteria and is visible.
- Reminders require explicit delegation and are non-coercive.
- No context-to-action shortcut exists.
- Bondi does not remember across sessions; MANTIS stores patterns.
- Bondi may read context and write coordination artifacts.
- Bondi may not convert context into action without human decision and RIO enforcement.
- Bondi must expose when rules, filters, or prioritization are applied.
