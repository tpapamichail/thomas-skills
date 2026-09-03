---
name: gh-flow
description: Work on every new feature or issue in a dedicated git flow feature branch off the integration branch. Never commit on develop/main unless the user explicitly says so. Use whenever starting a new feature, fixing a GitHub issue, or when the user asks to begin new work. Supports `/gh-flow start` (open a feature branch) and `/gh-flow finish` (checks → commit → merge or PR).
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(make:*), Bash(composer:*), Read, Glob, Grep
---

# gh-flow

Every new feature or issue gets its own feature branch off the repo's integration
branch. **Never** work directly on that branch or on the production branch — only
on an explicit user order.

## Subcommands

Invoked as `/gh-flow <subcommand>`. Route on the argument:

| Argument | Meaning |
|---|---|
| `start` (or `start {ID}` / `start {slug}`) | Begin a new task → create & switch to a feature branch. Run [**Start**](#start). |
| `finish` | The task is complete → run checks, commit, and merge or open a PR. Run [**Finish**](#finish). |
| _(none / other)_ | Infer from context: no feature branch yet → **Start**; on a feature branch with work done → **Finish**; on a feature branch and the new request is unrelated to it → [**Scope change mid-feature**](#scope-change-mid-feature). If ambiguous, ask the user. |

---

## Resolve the repo's conventions first

Never hardcode the branch names or the prefix. Detect them once per session:

```bash
git config --get gitflow.branch.develop     # e.g. develop — empty → no git flow config
git config --get gitflow.branch.master      # e.g. master or main
git config --get gitflow.prefix.feature     # e.g. feature/
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
```

Resolution order for the **integration branch** (where features branch off and
merge back):

1. `gitflow.branch.develop` if set.
2. Otherwise a remote `develop` — `git branch -r --list '*/develop'` non-empty.
3. Otherwise the repo's default branch (`main` / `master`).

For the **feature prefix**: `gitflow.prefix.feature` if set, else `feature/`.

> If `git flow` config exists but the `git-flow` extension is not installed, the
> plain-git equivalents below still apply — the naming convention is what matters,
> not the tool.

Do not run `git flow init` automatically. Missing configuration selects the
resolution fallback above; changing repository conventions requires an explicit
user request.

---

## Start

Open a dedicated feature branch for the new task.

### Before touching any code

1. `git branch --show-current`
2. Already on a feature branch that matches the task → continue on it (no new branch).
3. On the integration or production branch → do **not** commit. Create the branch first.
4. A branch for this issue may already exist: `git branch -a --list "*{ID}*"`. If so,
   check it out instead of creating a second one.

### Branch naming

Every branch carries the resolved prefix (`feature/` by default):

| Case | Branch |
|---|---|
| GitHub issue | `{prefix}{ID}-{short-kebab-slug}` (title via `gh issue view {ID}`) |
| Generic feature | `{prefix}{short-kebab-slug}` |

A bare `issue-3-foo` branch (no prefix) is **not** a git flow branch — `git flow
feature finish` won't find it. Keep the prefix.

### Create the branch

```bash
git checkout {integration} && git pull
git flow feature start {ID}-{slug}      # → {prefix}{ID}-{slug}
```

Without the extension, the equivalent is — note the prefix goes **in** the name
here, but **not** in the `git flow` command:

```bash
git checkout -b {prefix}{ID}-{slug}
```

Parallel issues → one worktree per branch, so they don't fight over the checkout:

```bash
git worktree add ../{repo}-{slug} {prefix}{ID}-{slug}   # {repo} = current repo dir name
```

### If the repo plans on a board

When the repo is tracked by a GitHub Project, move the card to the in-progress
column now — see the `gh-project` skill. Skip silently if there is no project.

---

## Scope change mid-feature

A request that has nothing to do with the feature currently checked out does **not**
silently join it. One branch per feature is the whole point — a stray fix riding
along makes the branch impossible to review, revert, or finish cleanly.

When the new request is out of scope, ask once. Name the current feature and offer
all material choices:

1. **Keep it on the current branch** — continue there, but rename the branch
   (`git branch -m`) if it no longer describes the combined scope.
2. **Finish current, then start new** — run [**Finish**](#finish), then
   [**Start**](#start) the new feature from the integration branch.
3. **Park current, then start new** — commit or stash the work in progress, then
   create the new feature from the integration branch, never from the current
   feature. A feature branched from an unmerged feature inherits its commits and
   cannot be merged independently.

Ask a follow-up only when the selected option omits information required to execute
it safely.

Judging scope: same files and same intent as the open feature → in scope. A different
subsystem, an unrelated bug, or a "while you're at it" → out of scope. When it is a
close call, ask; the cost of asking is a sentence, the cost of guessing is a tangled
branch.

---

## Finish

Wrap up a completed task on the current feature branch.

### 1. Checks green

The repo's own checks must be green before committing. **Read them, don't guess** —
in rough order of precedence:

| Source | Look for |
|---|---|
| `.github/workflows/*.yml` | authoritative — the complete gate CI runs on the PR |
| `package.json` | `scripts`: `lint`, `typecheck`, `test`, `test:e2e`, `build` |
| `Makefile` | `make test`, `make lint`, `make check` |
| `composer.json` | `scripts`: `test`, `phpstan`, `phpcs` |

This is the task's final general gate. Normal TDD cycles deliberately run only the
focused test and smallest affected scope. If `/gh-issue done` already ran these exact
checks against the unchanged final tree, reuse its visible evidence instead of
running the same gate twice.

Rules:

- A monorepo may have per-package suites that the root script does **not** cover.
  Check the workspace config (`pnpm-workspace.yaml`, `workspaces`, `turbo.json`)
  and run each affected package's suite.
- Prefer read-only invocations. A `lint` script that runs with `--fix` dirties the
  tree and will break the merge step — run the non-fixing variant, or commit the
  fixes deliberately.
- In a worktree with a non-standard `node_modules`, call binaries directly
  (`./node_modules/.bin/…`).
- Keep every command and result visible in the tool transcript. Report the command,
  status, and test count; attach raw output only when the transcript is unavailable
  or truncated. Never claim "green" or "done" without this evidence. A red suite is
  work, not an obstacle — do not skip or comment out failing tests.

### 2. Commit

Commit the work with a message that references `#{ID}` for issue work, so GitHub
links the commit to the issue.

### 3. Merge or PR

If the user already explicitly requested the exact operation in the current task
(for example, open a PR, push the feature branch, or merge directly), that request
is authorization; do not ask again. Otherwise ask once whether they want a PR or a
direct merge. Authorization applies only to the named operation and target — never
auto-merge or push the integration branch implicitly.

```bash
git flow feature finish {ID}-{slug}     # direct merge (or: git merge --no-ff)
gh pr create --base {integration} --fill --web   # PR instead
```

Closing keywords in the PR body (`Closes #{ID}`) let GitHub close the issue on
merge — and a board card in a `Done` column follows automatically if the project
has the default workflow enabled.

### 4. Clean up

```bash
git worktree remove ../{repo}-{slug}    # if a worktree was used
```

Delete the merged branch.

---

## Rules

- Never commit, push, or merge into the integration or production branch without
  explicit authorization for that operation and target.
- One branch per feature or issue. For an out-of-scope request, ask once with the
  current, finish-then-new, and park-then-new options; never branch from unmerged
  feature work.
- Reuse an existing task-matching feature branch; create one only when absent.
- Never initialize git-flow or auto-merge without explicit authorization.
- Never claim checks passed without visible runner evidence.
