---
name: tdd
description: Red-green-refactor is mandatory for this user. Load BEFORE writing or modifying any production code, in any language — no implementation line is written until a focused test fails for the right reason with visible runner evidence. Run only that test and the smallest affected scope inside each cycle; run the complete CI-equivalent gate once against the final tree. Triggers on "implement", "add", "build", "fix", "refactor", a bug report, a new function/class/endpoint, or any edit to a file that has (or should have) tests. SKIP only for docs, comments, config/lockfiles, and throwaway scripts.
allowed-tools: Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(npx:*), Bash(make:*), Bash(composer:*), Bash(vendor/bin/*), Bash(pytest:*), Bash(python:*), Bash(uv:*), Bash(go:*), Bash(cargo:*), Bash(dotnet:*), Bash(mvn:*), Bash(gradle:*), Bash(bundle:*), Bash(rspec:*), Bash(git:*), Read, Glob, Grep, Edit, Write
---

# tdd

One rule, and everything else follows from it:

> **No line of production code is written until a test demands it — and the test has
> been seen to fail first.**

A test written after the implementation proves nothing about the implementation. It
proves only that the code does what it already does.

## The cycle

| Phase | Goal | Done when |
|---|---|---|
| 🔴 **Red** | A test that expresses the *next* behaviour | The focused test fails, and the failure message is the one you predicted |
| 🟢 **Green** | Make it pass | The focused test and the smallest affected scope pass, with the smallest complete change |
| 🔵 **Refactor** | Remove the mess you just made | The affected scope is still green, with no new behaviour |

One observable contract per cycle. Multiple assertions or table-driven cases belong
together when they describe the same outcome or invariant. Split them only when they
can fail or ship independently.

---

## Resolve the test scopes first

Never hardcode the runner or guess an invocation. Resolve three scopes once per
session:

| Scope | Used for | Resolve from |
|---|---|---|
| **Focused** | Red and the first Green check | The runner's exact test/name filter and the project's existing test layout |
| **Affected** | Green and Refactor | The closest test file, module, package, and known contract or caller tests |
| **Final** | Task completion only | CI workflows first, then the repository's full test/check scripts |

Start with the focused test and expand only as far as the change demands. In a
monorepo, stay inside the affected package unless the changed contract crosses a
package boundary. Shared APIs, global state, bootstrap/DI, schemas, migrations,
serialization, concurrency, transactions, and security boundaries usually demand a
broader affected scope. When impact is uncertain, expand the affected scope rather
than guessing.

The focused result counts toward the affected scope. Run only the additional tests
needed to complete that scope; do not repeat the focused test unless the runner's
smallest affected invocation necessarily includes it.

Find how the project already writes tests before adding one — mirror its layout,
naming, and assertion style:

```
tests/  test/  spec/  __tests__/  *_test.go  *.test.ts  *.spec.ts  test_*.py
```

Learn the focused invocation; this is the command used repeatedly inside the cycle:

```bash
npx vitest run path/to/file.test.ts -t "name"
pytest tests/test_file.py::test_name -x
go test ./pkg -run TestName
vendor/bin/phpunit --filter testName
```

Resolve the final gate separately from `.github/workflows/*.yml`, `package.json`,
`Makefile`, `composer.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.csproj`, or
`Gemfile`. CI is authoritative for completion, not for the tight feedback loop.

**No test harness at all?** Stop and say so. Setting one up is a decision for the
user, not a step to take silently — and it changes the shape of the task.

---

## 🔴 Red

Write the smallest test that captures one behaviour the code does not yet have.

### The test comes from the requirement, not from the code

Write the assertion you *want* to be true. Do not read the implementation first and
describe it back — that is how a test ends up asserting the bug.

For a **bug fix**, the red test *is* the reproduction. Reproduce first:

1. Write a test that fails **because the bug exists**.
2. Run it and verify that the visible failure is the one you predicted. That is the
   proof the bug is real and that you found the right cause — not a guess at it.
3. Only then fix.

For **legacy code with no coverage** that you must change: pin the current behaviour
with a characterization test first (green immediately), so the refactor has a net.
Then start the red cycle for the new behaviour.

### Run it and read the failure

```bash
{single-test command}
```

**Read the visible failure output.** Record the command, test, and predicted versus
actual failure. Do not duplicate a full log in prose when it is already visible in
the tool transcript; attach it when the transcript is unavailable, truncated, or
the failure is unexpected.

| Failure | Meaning |
|---|---|
| Assertion failed, expected X got Y | ✅ Correct red — proceed |
| `undefined is not a function`, `ImportError`, `NameError` | ✅ Acceptable red for a not-yet-existing unit |
| Syntax error, missing fixture, wrong path, config error | ❌ Broken test, not a red — fix the test |
| **Passes** | ❌ Stop. The behaviour already exists, or the test asserts nothing |

A test that passes on the first run is the most important signal in the cycle, and
the easiest to wave away. It means one of: the feature is already there (say so and
stop), the assertion is vacuous (`expect(true).toBe(true)`, a mock asserting on
itself), or the test never ran (wrong file, filtered out, silently skipped).
Diagnose it — never "fix" it by moving on.

---

## 🟢 Green

Write the **smallest complete** code that turns the focused test green. Not the code
you may need later — the code the current contract demands.

- Prefer the obvious complete implementation over a disposable hardcode when they
  are equally small. Hardcode only as a deliberate triangulation step when another
  required case will immediately force the generalisation.
- No extra parameters, branches, config, or abstraction "while I'm here". If no test
  fails without it, it does not get written.
- Do not touch unrelated files.

Run the focused test first. Once it passes, run only the additional tests needed to
complete the smallest affected scope that can catch regressions from the change.
Stop there: do not run the final repository gate inside a normal
Red–Green–Refactor cycle.

Keep the runner result visible and report the command and pass count; do not paste
the same full output again unless it would otherwise be unavailable.

Never make a test pass by weakening it: no deleting assertions, no loosening a
comparison, no `skip`/`xfail`/`.only`, no widening a mock to swallow the call. If
the test is wrong, say why and rewrite it deliberately.

---

## 🔵 Refactor

Only with the focused test and affected scope green. Structure changes, behaviour
does not.

Batch closely related structure-only edits that cannot usefully be validated
separately. Re-run the affected scope after each logical batch, not after every edit.
A refactor that needs a test changed is not a refactor; it is a behaviour change and
needs its own Red first.

Then start the next cycle.

---

## Final gate

After the last behaviour cycle, run the repository's complete CI-equivalent test and
check gate once against the final tree. If `gh-flow` or `gh-issue` owns task
completion, defer to its Finish/Done gate instead of duplicating the run. Any
production-code change after that evidence invalidates it; run the final gate again.

---

## When the user asks for code without tests

Do not silently produce untested implementation, and do not refuse. Write the test
first anyway — it is the workflow they asked for, standing. Say in one line what you
are testing, then proceed.

If they explicitly override for a given task ("no tests here"), that is their call:
acknowledge it and write the code. The override applies to that task, not to the
session.

## Out of scope

Docs, comments, formatting, config and lockfiles, generated code, dependency bumps,
and genuine one-off scripts. Everything else is production code.

---

## Rules

- No production code before a failing test.
- Never claim Red or Green without visible runner evidence.
- A test that passes on its first run is a defect in the test — diagnose it, never skip past it.
- One observable contract per cycle; the focused test and affected scope are green before the next one.
- Run the complete CI-equivalent gate once against the final tree, not inside each cycle.
- Never weaken, skip, or delete a test to get to Green.
- Never write code no failing test demands.
