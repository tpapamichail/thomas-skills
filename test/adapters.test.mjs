import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderAgent } from "../src/adapters.mjs";

const catalog = JSON.parse(
  await readFile(new URL("../routing/agents.json", import.meta.url), "utf8"),
);
const byId = (id) => catalog.agents.find((agent) => agent.id === id);
const models = {
  fast: "provider/fast-model",
  standard: "provider/standard-model",
  deep: "provider/deep-model",
};

test("agent definitions use each harness's native model and permission schema", () => {
  const claude = renderAgent(byId("local-researcher"), "claude", models);
  assert.match(claude, /model: haiku/);
  assert.match(claude, /effort: low/);
  assert.match(claude, /tools: Read, Grep, Glob/);
  assert.doesNotMatch(claude, /\b(?:Edit|Write|Bash)\b/);

  const omp = renderAgent(byId("reviewer"), "omp", models);
  assert.match(omp, /model: "@task"/);
  assert.match(omp, /thinking-level: medium/);
  assert.match(omp, /tools: read, grep, glob, bash/);

  const claudeReviewer = renderAgent(byId("reviewer"), "claude", models);
  assert.match(claudeReviewer, /tools: Read, Grep, Glob, Bash/);
  assert.doesNotMatch(claudeReviewer, /\b(?:Edit|Write)\b/);

  const opencode = renderAgent(byId("implementer"), "opencode", models);
  assert.match(opencode, /model: provider\/standard-model/);
  assert.match(opencode, /mode: subagent/);
  assert.match(opencode, /steps: 30/);
  assert.match(opencode, /permission:\n  "\*": deny/);
  assert.match(opencode, /  edit: allow/);
  assert.match(opencode, /  bash: allow/);
});

test("escalated native variants preserve the role and resolve the selected tier", () => {
  const omp = renderAgent(byId("reviewer"), "omp", models, {
    name: "reviewer-deep",
    tier: "deep",
  });
  assert.match(omp, /name: reviewer-deep/);
  assert.match(omp, /model: "@slow"/);
  assert.match(omp, /thinking-level: high/);
  assert.match(omp, /Escalated deep variant/);

  const opencode = renderAgent(byId("reviewer"), "opencode", models, {
    name: "reviewer-deep",
    tier: "deep",
  });
  assert.match(opencode, /model: provider\/deep-model/);
  assert.match(opencode, /Escalated deep variant/);
  assert.match(
    opencode,
    /  bash:\n    "\*": deny\n    "git diff\*": allow\n    "git show\*": allow\n    "git log\*": allow\n    "git status\*": allow/,
  );
});
