import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPiArgs, preparePiTask } from "../src/pi-routing.mjs";

const catalog = JSON.parse(
  await readFile(new URL("../routing/agents.json", import.meta.url), "utf8"),
);
const tiers = JSON.parse(
  await readFile(new URL("../routing/model-tiers.json", import.meta.url), "utf8"),
);
const models = {
  fast: "provider/fast-model",
  standard: "provider/standard-model",
  deep: "provider/deep-model",
};

test("Pi task preparation fixes the selected role, model, effort, and least-privilege tools", () => {
  const prepared = preparePiTask(
    {
      task: "Map the local authentication configuration.",
      activity: "research",
      source: "local",
      risk: "low",
    },
    { catalog, tiers, models },
  );

  assert.deepEqual(
    {
      agent: prepared.agent.id,
      tier: prepared.tier,
      model: prepared.model,
      effort: prepared.effort,
      tools: prepared.tools,
    },
    {
      agent: "local-researcher",
      tier: "fast",
      model: "provider/fast-model",
      effort: "low",
      tools: ["read", "grep", "find", "ls"],
    },
  );

  const args = buildPiArgs(prepared, "/tmp/agent-prompt.md");
  assert.deepEqual(args.slice(0, 10), [
    "--mode",
    "json",
    "-p",
    "--no-session",
    "--no-extensions",
    "--model",
    "provider/fast-model",
    "--thinking",
    "low",
    "--tools",
  ]);
  assert.equal(args[10], "read,grep,find,ls");
  assert.deepEqual(args.slice(11, 13), ["--append-system-prompt", "/tmp/agent-prompt.md"]);
  assert.match(args.at(-1), /^Task: Map the local authentication configuration\.$/);
});
