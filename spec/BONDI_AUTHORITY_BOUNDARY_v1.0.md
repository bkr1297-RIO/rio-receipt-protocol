# Bondi Authority Boundary

**Version:** 1.0.0
**Status:** Orchestration Specification
**Category:** Orchestration Layer (above RIO)

---

## 1. Purpose

This specification defines the authority boundary for Bondi. It establishes what Bondi may enforce, what it may not define, and how constraints flow through the orchestration layer.

Bondi enforces constraints. Bondi does not define constraints.

---

## 2. Authority Hierarchy

Constraints are evaluated in strict precedence order. A lower-priority source cannot override a higher-priority source.

| Priority | Source | Description |
|----------|--------|-------------|
| 1 (highest) | Constitution / Invariants | System-level invariants that cannot be overridden by any party |
| 2 | Law / Policy | Legal and regulatory requirements, organizational policy |
| 3 | Human Constraints | Explicit constraints set by the human operator for this session or globally |
| 4 (lowest) | Session Context | Contextual constraints derived from the current interaction |

Bondi applies constraints from all four levels. When constraints conflict, the higher-priority source governs.

---

## 3. Constraint Enforcement Rules

Bondi enforces constraints that have been explicitly defined by an authoritative source (constitution, law, human operator).

Bondi does not:

- Define new constraints
- Extend existing constraints beyond their stated scope
- Infer constraints from context alone
- Create authority relationships

Enforcement is mechanical. Bondi checks the incoming request against the defined constraints and either passes it through or refuses it with attribution.

---

## 4. Refusal Categories

When Bondi refuses to process or route a request, the refusal must be categorized and attributed.

| Category | Source | Description |
|----------|--------|-------------|
| Constitutional | System invariants | Request violates a system-level invariant |
| Legal | Law / Policy | Request violates a legal or regulatory requirement |
| User Constraint | Human operator | Request violates an explicit constraint set by the human |
| Delegation Scope | Session / Role | Request exceeds the scope of authority delegated to Bondi |
| Context Integrity | Session context | Request is inconsistent with the established context |

Every refusal must state:

- The category
- The specific constraint that was violated
- The source of the constraint

---

## 5. Invariants

These properties hold unconditionally:

**Bondi may hold the line.** Bondi enforces constraints that have been defined by authoritative sources. It does not yield on constitutional or legal constraints regardless of human instruction.

**Bondi may not draw or extend the line.** Bondi does not create new constraints, expand the scope of existing constraints, or establish new authority boundaries.

**Bondi must reveal the line when requested.** When the human operator asks what constraints are active, Bondi must disclose all constraints currently being enforced, their sources, and their priority levels.

**Bondi must indicate when the line is applied.** Every time Bondi filters, modifies, or refuses a request due to a constraint, it must indicate that a constraint was applied, which constraint, and from which source.

---

## 6. Transparency

All filtering and refusals must be visible and attributable.

Bondi does not silently filter, silently modify, or silently refuse. Every intervention is logged with:

- Timestamp
- The request that triggered the intervention
- The constraint that was applied
- The source of the constraint
- The action taken (filter, modify, refuse)

The human operator can review the full intervention log at any time.

---

## 7. Admissibility Filtering

Bondi may apply admissibility filtering to incoming requests before routing.

Admissibility filtering checks whether a request falls within the defined constraints before expending resources on decomposition and routing. This is an optimization, not an authority expansion.

Admissibility filtering:

- Uses only explicitly defined constraints
- Does not infer new constraints
- Attributes every filter action to a specific constraint and source
- Is visible to the human operator

---

## 8. Relationship to RIO

Bondi operates above RIO. The boundary is:

- Bondi transforms and routes intent
- RIO authorizes and governs execution
- Bondi may refuse to route a request (constraint enforcement)
- RIO may refuse to execute a request (authorization enforcement)
- Both refusals are independent and visible

A request that passes Bondi's constraint check still requires RIO authorization before execution. Bondi's approval to route is not RIO's approval to execute.
