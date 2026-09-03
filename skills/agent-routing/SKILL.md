---
name: agent-routing
description: Selects whether to delegate, chooses the narrowest capable agent, and assigns the least expensive reliable model tier. Load before spawning subagents, delegating work, choosing an agent, or choosing a worker model in any harness or domain.
---

# Agent routing

Select the agent before the model. A stronger model does not repair a mismatched role, missing tool, or unsafe permission set.

## Decide whether to delegate

Delegate only self-contained work whose isolation, specialization, or parallel execution provides a clear benefit.

Keep work in the main session when it is:

- trivial enough that delegation costs more than doing it;
- ambiguous or still needs top-level decomposition;
- tightly coupled to the main session's current reasoning;
- integration-heavy or likely to touch shared state with another worker.

Parallelize only independent tasks. Dependent work is a chain, not a parallel batch.

## Select the agent

Choose the narrowest eligible agent whose purpose, capabilities, permissions, and output contract fully cover the task. Prefer a matching specialist over a general worker, but never use a specialist outside its documented scope.

Resolve eligibility in this order:

1. Honor an agent explicitly requested by the user when it is available, capable, and permitted.
2. Filter by required tools, modalities, permissions, data access, and state access.
3. Distinguish local information from external sources.
4. Distinguish research, deterministic mutation, implementation, verification, review, and security review.
5. Prefer a directly matching domain specialist.
6. Among equally capable candidates, prefer least privilege and lower coordination overhead.

Use the canonical roles as follows:

- `local-researcher`: read-only discovery and mapping of information already present in the local workspace.
- `external-researcher`: read-only verification against official external documentation, APIs, dependencies, or primary sources.
- `mechanical-worker`: exact, deterministic, reversible operations with no design decisions.
- `implementer`: a bounded change or investigation that requires judgment and state modification.
- `verifier`: run specified checks or real scenarios and return evidence; do not repair failures.
- `reviewer`: independently inspect a completed artifact or change for correctness and regressions; do not implement fixes.
- `security-reviewer`: adversarial security, privacy, or abuse analysis; do not perform general implementation.

Keep top-level planning, final synthesis, cross-worker trade-offs, and unmatched work in the main session. Never silently route to an approximately related specialist.

## Select the model tier

After selecting the agent, choose the fastest and least expensive configured tier that can reliably satisfy the task:

- `fast`: bounded lookup, deterministic operations, known commands, and low-risk evidence collection.
- `standard`: multi-step execution, synthesis, implementation, and ordinary review.
- `deep`: high ambiguity, large blast radius, architecture, adversarial analysis, or security-critical reasoning.

Apply hard capability filters before price: required modalities, context size, tool calling, structured output, provider availability, privacy, and data residency.

Escalate only on evidence that reasoning capacity is insufficient: unresolved ambiguity, conflicting evidence, repeated invalid output, a high-impact decision, security-critical reasoning, or a failed attempt caused by reasoning limitations. Missing tools, missing permissions, and an incorrectly selected agent require a routing or configuration fix, not a stronger model.

Never downgrade below an agent's default tier. Never exceed its maximum tier. Announce each delegation as:

`→ <agent>: <resolved model or tier> @ <effort> — <task>`

When a native adapter exposes `<role>-standard` or `<role>-deep`, treat it as the
same canonical role at the selected escalation tier. Use the unsuffixed role at
its default tier and the exact suffixed variant only after escalation is justified.

## Handoff contract

Every delegated task must include:

- exact target and non-goals;
- required inputs and relevant context;
- allowed state changes;
- observable acceptance criteria;
- required output format;
- explicit instruction to skip unrelated validation or cleanup.

If no eligible agent or configured model exists, fail with the missing capability or configuration. Do not inherit an arbitrary model or broaden permissions silently.
