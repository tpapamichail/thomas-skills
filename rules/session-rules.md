---
description: TDD and git flow rules that govern every session in this repo's workflow.
alwaysApply: true
---

These rules govern every session, and outrank any habit to the contrary.

## TDD is mandatory — red → green → refactor, every project, every language

1. NO production code before a test that fails. Not "tests after" — the failing
   test comes first, and its failure must be run and the output pasted.
2. Check the failure is the one you predicted. A test that passes on its first
   run is a defect in the test — diagnose it, never move past it.
3. Green = the least code that makes it pass. Then the whole suite. Then refactor.
4. Fixing a bug? Step one is a test that reproduces it and fails because of it.
5. Never claim red or green without pasted runner output. Never weaken, skip,
   delete, or `.only` a test to reach green.

Exempt: docs, comments, formatting, config/lockfiles, generated code, throwaway
scripts. If the user explicitly says "no tests" for a task, that is their call —
for that task only.

## Git flow is mandatory

1. Never work on `master`/`main` or `develop`. No commits, no edits meant to land
   there — only on an explicit user order, and only for that task.
2. Repo not initialised (`git config --get gitflow.branch.develop` is empty)?
   Initialise it with the defaults, no prompts: `git flow init -d`.
3. Every task starts with `git flow feature start {short-name-of-the-task}`, and all
   of its work happens on that branch.
4. A request that doesn't belong to the current feature? Stop and ask which branch
   it goes on: this one, or a new feature. If the answer is a new one, ask next
   whether to finish the current feature first. Never start the second feature on
   top of the first without that answer.
5. NEVER push. Ask first, every single time — including the first push of a new
   branch, and including when the work is finished and green.

## Route the agent first, then the model

1. Delegate only self-contained work whose isolation, specialization, or parallel
   execution helps. Keep trivial, ambiguous, tightly coupled, integration-heavy,
   and top-level planning work in the main session.
2. Choose the narrowest eligible agent whose purpose, capabilities, permissions,
   data access, and output contract fully cover the task. Honor an explicit user
   choice only when it is capable. Never approximate with a related specialist.
3. Distinguish local research, external research, mechanical mutation,
   implementation, verification, independent review, and security review before
   choosing a general worker.
4. Only after the agent is fixed, choose the least expensive reliable model tier:
   `fast` for bounded low-risk work, `standard` for multi-step implementation and
   ordinary review, `deep` for high ambiguity, blast radius, adversarial analysis,
   or security-critical reasoning.
5. Hard capability filters come before cost: tools, modality, context, structured
   output, provider availability, privacy, and data residency.
6. Escalate only when evidence shows insufficient reasoning capacity. Missing
   tools, missing permissions, or a wrong agent require rerouting, not a stronger
   model. Never inherit an arbitrary model.
7. Announce every delegation: `→ <agent>: <model or tier> @ <effort> — <task>`.
   Parallelize only independent tasks.

Load the `agent-routing` skill before delegation for the canonical roles, complete
eligibility order, tier boundaries, and handoff contract.

Read `skill://tdd` before the first edit, `skill://gh-flow` before branching or
finishing, and `skill://agent-routing` before delegation, for the full cycles,
test-runner detection, repo-specific checks, canonical roles, tier boundaries,
and legacy-code and no-harness cases.
