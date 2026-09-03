# thomas-skills

Portable [Agent Skills](https://skills.sh), native subagents, and a test-first GitHub workflow.

## Install

### Agent Skills

The portable skills work in Claude Code, OpenCode, Pi, and every other harness
supported by the `skills` CLI:

```bash
npx skills add tpapamichail/thomas-skills
npx skills add -g tpapamichail/thomas-skills
npx skills add tpapamichail/thomas-skills -s agent-routing
```

This route installs instructions only. Native agent definitions and the Pi
subagent runtime use the harness-specific routes below.

### Claude Code

```text
/plugin marketplace add tpapamichail/thomas-skills
/plugin install thomas-skills@tpapamichail
/plugin install agent-routing@tpapamichail
```

`thomas-skills` supplies the skills and standing session rules.
`agent-routing` supplies seven native subagents. Their logical tiers resolve to
Claude's `haiku`, `sonnet`, and `opus` aliases with `low`, `medium`, and `high`
effort respectively.

### Oh My Pi

```text
/marketplace add tpapamichail/thomas-skills
/marketplace install thomas-skills@tpapamichail
/marketplace install agent-routing@tpapamichail
```

Restart OMP after the first install because `thomas-skills` includes an extension
module. For an existing installation, refresh the catalog and upgrade the plugin:

```text
/marketplace update tpapamichail
/marketplace upgrade --scope user thomas-skills@tpapamichail
/reload-plugins
```

omp reads the native [`.omp-plugin/marketplace.json`](.omp-plugin/marketplace.json).
The workflow plugin injects the standing routing policy but leaves omp's built-in
`task` tool intact. The agent plugin uses omp's `@smol`, `@task`, and `@slow`
model roles, so changing those role mappings changes every routed worker without
editing an agent definition.

Skills are invoked as `/skill:gh-flow` rather than `/gh-flow`.

### OpenCode

OpenCode requires concrete `provider/model-id` values in each agent definition.
Install the portable skill, clone this repository, then generate project-local
native agents with explicit mappings:

```bash
npx skills add tpapamichail/thomas-skills -s agent-routing
git clone https://github.com/tpapamichail/thomas-skills.git
cd thomas-skills
AGENT_ROUTING_MODEL_FAST=provider/fast-model \
AGENT_ROUTING_MODEL_STANDARD=provider/standard-model \
AGENT_ROUTING_MODEL_DEEP=provider/deep-model \
npm run configure:opencode -- --output /path/to/project/.opencode/agents
```

Generation fails if any tier is missing; OpenCode never silently inherits the
primary agent's model. Re-run the command after changing the canonical catalog.

### Pi

Pi has no built-in subagent runtime, so this repository is also a Pi package:

```bash
pi install git:github.com/tpapamichail/thomas-skills@v1.1.1
```

Configure all three model tiers globally in
`~/.pi/agent/agent-routing.json`, or per project in
`.pi/agent-routing.json`:

```json
{
  "models": {
    "fast": "provider/fast-model",
    "standard": "provider/standard-model",
    "deep": "provider/deep-model"
  }
}
```

`AGENT_ROUTING_MODEL_FAST`, `AGENT_ROUTING_MODEL_STANDARD`, and
`AGENT_ROUTING_MODEL_DEEP` override file configuration. The `route_task` tool
routes one task or an independent parallel batch into isolated Pi child sessions
with an explicit model, effort, and least-privilege tool set.

## The skills

A single workflow, split by how big the work is:

| Skill | Use it when | Owns |
|---|---|---|
| [`gh-flow`](skills/gh-flow/SKILL.md) | always | branches, checks, merge/PR |
| [`gh-issue`](skills/gh-issue/SKILL.md) | the task is a GitHub issue | triage, affected areas, plan |
| [`gh-project`](skills/gh-project/SKILL.md) | the repo plans on a Projects board | what's next, card status |

They compose downward — `gh-project` picks the item, `gh-issue` triages it, `gh-flow`
branches it. Each one defers to the next instead of restating its rules, so `gh-flow`
alone is enough for a small repo.

Plus two that cut across all of them:

| Skill | Use it when | Owns |
|---|---|---|
| [`tdd`](skills/tdd/SKILL.md) | any production code is written | red-green-refactor |
| [`agent-routing`](skills/agent-routing/SKILL.md) | work may be delegated or assigned a worker model | eligibility, role selection, model tiers, handoff |

### gh-flow

Every task gets its own feature branch off the integration branch; nothing is ever
committed straight to `develop`/`main`. Detects the repo's git flow config, branch
prefix, and check commands rather than assuming them — works in a `git flow` repo and
in a plain-git one. `finish` refuses to claim green without visible runner evidence,
never auto-merges.

### gh-issue

Issue → ready-to-code. Reads the issue and its comments, maps labels to code areas,
fans the code exploration out to read-only sub-agents so the main session stays
clean, then presents a triage and waits for approval before anything is edited.

### gh-project

Drives work from a GitHub Projects board. Discovers the board's real field and column
names instead of hardcoding them, filters server-side with `--query` (a years-old
board is not something to paginate), and keeps cards in sync at the transitions that
actually matter: branch created, PR opened, PR merged.

Needs the `project` token scope — `gh auth refresh -s project`.

### tdd

Red-green-refactor, enforced rather than described. No production line before a test
that fails *for the predicted reason*; a test that passes on its first run is treated
as a defect in the test, not a lucky break. Each cycle runs the focused test and the
smallest affected scope, while the complete CI-equivalent gate runs once against the
final tree. Bug fixes start from a reproduction test, legacy code gets a
characterization test before it is touched, and neither Red nor Green may be claimed
without visible runner evidence. Detects focused invocations separately from the
final CI gate — never `npm test` on faith or on every micro-cycle.

Its `description` is written to load in every session, so the rule is present before
the first line of code, not recalled after it.

### agent-routing

Delegation is agent-first and model-second. The canonical catalog in
[`routing/agents.json`](routing/agents.json) defines seven non-overlapping roles:

| Role | Boundary |
|---|---|
| `local-researcher` | read-only local workspace discovery |
| `external-researcher` | read-only official and upstream sources |
| `mechanical-worker` | exact deterministic mutations |
| `implementer` | bounded implementation requiring judgment |
| `verifier` | execute a known check; never repair it |
| `reviewer` | independent correctness review; never implement |
| `security-reviewer` | adversarial security, privacy, and abuse review |

The main session retains planning, integration, ambiguity, and unmatched work.
[`routing/model-tiers.json`](routing/model-tiers.json) defines `fast`, `standard`,
and `deep`; each native adapter resolves those logical tiers without changing the
portable policy. Generated Claude and omp definitions come from the same catalog.
The canonical name uses the role's default tier; supported escalations are native
`<role>-standard` or `<role>-deep` variants so harnesses without per-call model
overrides still execute the selected tier.
OpenCode and Pi require explicit provider model mappings and fail closed when one
is missing.

## Always-on TDD

Installing the skill makes the rule *available*. Making it **standing** — present
before the first line of code in every session, not recalled after it — takes one of
two things.

**Via the plugin (automatic).** The plugin ships a `SessionStart` hook
([`hooks/hooks.json`](hooks/hooks.json)) that prints
[`hooks/session-rules.md`](hooks/session-rules.md) into context on `startup`, `resume`,
`clear` and `compact` — and a `SubagentStart` hook, so delegated work inherits the
rules instead of quietly skipping them. Nothing to configure; it fires from the
moment you install. Edit `session-rules.md` to change the wording.

**Via `CLAUDE.md` (manual).** The `skills` CLI route has no hooks, so add this to
`~/.claude/CLAUDE.md` (user-level, every project) or to a project's `CLAUDE.md`:

```markdown
## Workflow

Work test-first, always: Red → Green → Refactor. Load the `tdd` skill before writing
or changing any production code. No implementation before a test that fails for the
right reason. Run the focused test and smallest affected scope during each cycle,
then the complete CI-equivalent gate once against the final tree; never claim Red or
Green without visible runner evidence.
```

Neither installer writes to your `CLAUDE.md` on its own — that boundary is
deliberate.

## Requirements

- [`gh`](https://cli.github.com) authenticated (`gh auth login`)
- `git`; the [git-flow](https://github.com/nvie/gitflow) extension is optional
- `gh` ≥ 2.97 for `gh-project` — it relies on `item-edit --field/--value` and
  `item-list --query`, which avoid raw GraphQL node IDs
- Node.js ≥ 22 only for adapter generation and the Pi package

## Companion tools

Not shipped here, but part of how I actually work — install them separately.

| Tool | What it is | Why |
|---|---|---|
| [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | MCP server | code search over a knowledge graph instead of grep |
| [nestjs-best-practices](https://www.skills.sh/kadajett/agent-nestjs-skills/nestjs-best-practices) | Agent Skill | NestJS conventions on the projects that use it |

**codebase-memory-mcp** indexes the repo into a graph, so "who calls this", "what
breaks if I change it", and "where is X wired" are structural queries
(`search_graph`, `trace_path`, `get_code_snippet`) rather than a text sweep. It pairs
directly with `gh-issue`, whose triage step is mostly exploration: the sub-agents map
the affected areas from the graph instead of grepping their way there.

```bash
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
```

The installer detects the coding agent and registers the server itself — no
`claude mcp add`, no external database. Restart the agent, then index a repo once
with `index_repository` before the first query.

**nestjs-best-practices** is the stack-specific layer these skills deliberately don't
have — `tdd` and `gh-flow` say *how* to work; its 40 practices, ordered by priority
across architecture, DI, security and performance, say what good looks like in a
NestJS codebase.

```bash
npx skills add https://github.com/kadajett/agent-nestjs-skills --skill nestjs-best-practices
```

## Conventions

Skills and adapters here follow four rules, which is most of why they're reusable:

1. **Detect, never hardcode.** Repo name, base branch, branch prefix, test commands,
   board columns — all resolved at runtime.
2. **Evidence over assertion.** No "done" or "green" without visible runner evidence.
3. **Ask before anything irreversible.** No auto-merge, no push to a shared branch,
   no bulk board edits.
4. **Agent before model.** Match purpose and capabilities first; then spend only
   the model tier the selected role needs.

## Releasing

Marketplace installs from `tpapamichail/thomas-skills` clone GitHub's default
branch (`main`). A tag on `develop` is not enough: the release must reach `main`
before either plugin can be installed at its new version.

After bumping the version in the root plugin manifest, both marketplace entries,
both adapter plugin manifests, and `package.json`, run:

```bash
npm test
npm run check:generated
claude plugin validate . --strict
claude plugin validate adapters/claude --strict

VERSION=$(node -p "require('./package.json').version")
git flow release start "$VERSION"
git flow release finish -n "$VERSION"
git push origin main develop

git switch main
claude plugin tag . --dry-run
claude plugin tag . --push
git switch develop
```

`git flow release finish -n` deliberately leaves tagging to `claude plugin tag`,
which uses the plugin name and version to create the marketplace release tag.

`hooks/session-rules.md` (Claude Code) and `rules/session-rules.md` (omp) carry the
same TDD, git-flow, and agent-routing sections — edit one, edit the other.

## License

MIT — see [LICENSE](LICENSE).
