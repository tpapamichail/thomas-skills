---
description: Test-first, branch, and delegation guardrails for every coding session.
alwaysApply: true
---

These standing guardrails apply only when their trigger matches. Detailed procedure
lives in the named skill; do not duplicate it here.

## Test-first behavior

- Before changing observable production behavior or fixing a bug, load the `tdd` skill.
- Red: run the smallest focused test and observe the predicted failure. Green: make
  the smallest complete change, then run the focused test plus the smallest affected
  scope. Refactor only while that scope is green.
- For a behavior-preserving refactor, establish the affected scope green first; add
  a characterization test when coverage is absent, but do not invent a failing test.
- Run the CI-equivalent final gate once on the unchanged final tree; reuse valid
  visible evidence. Never weaken, skip, or delete tests.
- TDD-exempt: prose-only docs/comments/formatting, generated output, lockfiles, and
  genuine throwaway scripts. Runtime-affecting configuration is not exempt. Exempt
  never means unverified.

## Branch discipline

- Before the first repository change meant to land, load the `gh-flow` skill.
- Resolve integration and production branches from repository configuration. Never
  edit or commit there unless explicitly ordered. Reuse a task-matching feature
  branch; create one only when absent. Never initialize git-flow silently.
- If scope changes, ask once: keep it on the current branch, finish current then
  start new, or park current then start new.
- Never push or merge without explicit authorization; an explicit command already
  authorizes that exact operation.

## Delegation

- Before delegation, load the `agent-routing` skill.
- Delegate only clear, self-contained work where specialization, isolation, or
  parallelism beats handoff cost. Keep trivial, ambiguous, tightly coupled, and
  integration-heavy work here.
- Select the agent first, then the cheapest reliable allowed tier. Parallelize only
  independent tasks and announce each delegation.
