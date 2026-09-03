import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkAgentAdapters, writeAgentAdapters } from "../src/generator.mjs";

const catalog = JSON.parse(
  await readFile(new URL("../routing/agents.json", import.meta.url), "utf8"),
);
const tiers = JSON.parse(
  await readFile(new URL("../routing/model-tiers.json", import.meta.url), "utf8"),
);
const tierRanks = new Map(tiers.tiers.map((tier) => [tier.id, tier.rank]));
const expectedNames = catalog.agents
  .flatMap((agent) =>
    tiers.tiers
      .filter(
        (tier) =>
          tier.rank >= tierRanks.get(agent.defaultTier) &&
          tier.rank <= tierRanks.get(agent.maximumTier),
      )
      .map((tier) => `${agent.id}${tier.id === agent.defaultTier ? "" : `-${tier.id}`}.md`),
  )
  .sort();
const models = {
  fast: "provider/fast-model",
  standard: "provider/standard-model",
  deep: "provider/deep-model",
};

test("adapter generation writes every routable role-tier variant and removes stale definitions", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "agent-routing-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const destinations = {
    claude: join(root, "claude"),
    omp: join(root, "omp"),
    opencode: join(root, "opencode"),
  };
  await writeFile(join(root, "stale.md"), "unused");
  destinations.claude = root;

  await writeAgentAdapters({ catalog, tiers, destinations, models });

  assert.deepEqual((await readdir(destinations.claude)).filter((name) => name.endsWith(".md")).sort(), expectedNames);
  assert.deepEqual((await readdir(destinations.omp)).sort(), expectedNames);
  assert.deepEqual((await readdir(destinations.opencode)).sort(), expectedNames);

  assert.match(
    await readFile(join(destinations.opencode, "security-reviewer.md"), "utf8"),
    /model: provider\/deep-model/,
  );
});

test("adapter checks report stale or modified generated files", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "agent-routing-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const destinations = {
    claude: join(root, "claude"),
    omp: join(root, "omp"),
    opencode: join(root, "opencode"),
  };
  await writeAgentAdapters({ catalog, tiers, destinations, models });
  assert.deepEqual(await checkAgentAdapters({ catalog, tiers, destinations, models }), []);

  await writeFile(join(destinations.omp, "reviewer.md"), "stale", "utf8");
  assert.deepEqual(await checkAgentAdapters({ catalog, tiers, destinations, models }), [
    join(destinations.omp, "reviewer.md"),
  ]);
});
