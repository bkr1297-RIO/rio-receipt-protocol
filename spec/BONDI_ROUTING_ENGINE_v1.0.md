# Bondi Routing Engine

**Version:** 1.0.0
**Status:** Orchestration Specification
**Category:** Orchestration Layer (above RIO)

---

## 1. Purpose

The Bondi Routing Engine defines how unstructured human goals are transformed into structured, routable intent and how responses from multiple sources are composed into a single coherent presentation for human decision.

Bondi sits above RIO. It does not execute actions, approve actions, generate tokens, modify receipts, or write to the ledger. It transforms input and routes intent. All execution authority remains with RIO.

---

## 2. Scope

This specification covers:

- Intake normalization
- Task decomposition
- Capability routing
- Prompt shaping
- Response normalization
- Composition
- Human decision handoff

This specification does not cover:

- Authorization (RIO)
- Execution (RIO Gateway)
- Receipt generation (RIO)
- Ledger recording (RIO)

---

## 3. Intake Normalization

Bondi accepts unstructured input from the human operator and normalizes it into a structured intent object.

Normalization includes:

- Extracting the action request from natural language
- Identifying the target domain (email, calendar, data, etc.)
- Identifying constraints expressed by the human
- Assigning a task identifier for traceability

The normalized intent is the input to task decomposition. The original input is preserved and linked to the task identifier.

---

## 4. Task Decomposition

A single human goal may require multiple sub-tasks. Bondi decomposes the normalized intent into discrete, routable units.

Each sub-task:

- Has a unique task identifier derived from the parent task
- Specifies the capability required
- Carries the constraints from the parent intent
- Is independently traceable

Decomposition does not create new authority. Each sub-task that requires execution must pass through RIO independently.

---

## 5. Capability Routing

Bondi routes each sub-task to the appropriate capability provider (LLM, API, data source, or human).

Routing decisions are based on:

- The capability required by the sub-task
- The availability of the capability provider
- Constraints from the human operator

Routing does not grant execution authority. A routed sub-task that requires a real-world action must enter the RIO pipeline at the intake stage.

---

## 6. Prompt Shaping

When a sub-task is routed to an LLM, Bondi constructs the prompt.

Prompt shaping includes:

- Injecting relevant context from the shared context log
- Applying human-defined constraints
- Structuring the prompt for the target model's expected format

Prompt shaping does not inject authority, approval status, or execution permissions into the prompt. The LLM response is a proposal, not an action.

---

## 7. Response Normalization

Responses from capability providers are normalized into a common format before composition.

Normalization includes:

- Extracting the substantive content from the provider's response format
- Preserving source attribution (which provider produced which content)
- Preserving uncertainty (confidence levels, caveats, unknowns)
- Flagging conflicts between responses from different providers

No synthesis without attribution. Every element in the normalized response must trace to a specific source.

---

## 8. Composition

Bondi composes normalized responses into a single presentation for the human operator.

Composition rules:

- Bondi must not prioritize, suppress, or reorder information without explicitly defined and inspectable criteria
- Conflicting information from different sources is presented as a conflict, not resolved
- Uncertainty is preserved, not collapsed
- Source attribution is maintained through to the final presentation
- The composed output is a report, not a decision

---

## 9. Human Decision Handoff

The composed output is presented to the human operator for decision.

Bondi does not:

- Make decisions on behalf of the human
- Recommend a specific action unless explicitly delegated to do so
- Proceed to execution without human direction

The human operator reviews the composed output and either:

- Directs Bondi to submit an action request to RIO
- Requests additional information
- Takes no action

If the human directs an action, Bondi constructs a canonical request and submits it to the RIO intake stage. From that point, RIO governs.

---

## 10. State Machine

```
intake → normalized → decomposed → routed → collected → composed → presented → awaiting_decision
```

| State | Description |
|-------|-------------|
| `intake` | Raw human input received |
| `normalized` | Input transformed into structured intent |
| `decomposed` | Intent split into routable sub-tasks |
| `routed` | Sub-tasks dispatched to capability providers |
| `collected` | Responses received and normalized |
| `composed` | Responses assembled into single presentation |
| `presented` | Presentation delivered to human operator |
| `awaiting_decision` | Waiting for human direction |

Transitions are forward-only within a single task. A new human input creates a new task with a new identifier.

---

## 11. Task Identity and Traceability

Every task and sub-task has a unique identifier. The identifier links:

- The original human input
- The normalized intent
- Each sub-task
- Each capability provider response
- The composed presentation
- The human decision

If the human directs an action, the task identifier is carried into the RIO canonical request, establishing traceability from human goal through orchestration to governed execution.

---

## 12. Invariants

- Bondi does not execute actions.
- Bondi does not approve actions.
- Bondi does not generate execution tokens.
- Bondi does not modify receipts or the ledger.
- Bondi does not create or modify authority relationships.
- No synthesis without attribution.
- Uncertainty is preserved, not collapsed.
- All routing decisions are traceable.
