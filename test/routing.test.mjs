import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveModels, selectRoute, validateCatalog } from "../src/routing.mjs";

const loadJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("acceptance classifications select the expected agent and tier", async () => {
  const catalog = await loadJson("../routing/agents.json");
  const tiers = await loadJson("../routing/model-tiers.json");
  const acceptance = await loadJson("../routing/acceptance-cases.json");

  for (const fixture of acceptance.cases) {
    assert.deepEqual(
      selectRoute(fixture.classification, catalog, tiers),
      fixture.expected,
      fixture.name,
    );
  }
});

test("an explicitly requested agent must be eligible", async () => {
  const catalog = await loadJson("../routing/agents.json");
  const tiers = await loadJson("../routing/model-tiers.json");

  assert.throws(
    () =>
      selectRoute(
        {
          delegate: true,
          requestedAgent: "external-researcher",
          activity: "research",
          source: "local",
          risk: "low",
        },
        catalog,
        tiers,
      ),
    /Requested agent external-researcher is not eligible/,
  );
});

test("model resolution is explicit, layered, and complete", () => {
  assert.deepEqual(
    resolveModels({
      env: { AGENT_ROUTING_MODEL_DEEP: "provider/deep-env" },
      projectConfig: {
        models: { standard: "provider/standard-project" },
      },
      globalConfig: {
        models: {
          fast: "provider/fast-global",
          standard: "provider/standard-global",
          deep: "provider/deep-global",
        },
      },
    }),
    {
      fast: "provider/fast-global",
      standard: "provider/standard-project",
      deep: "provider/deep-env",
    },
  );

  assert.throws(
    () =>
      resolveModels({
        env: {},
        projectConfig: { models: {} },
        globalConfig: { models: { fast: "provider/fast" } },
      }),
    /Missing model mapping for standard, deep/,
  );
});

test("the canonical catalog rejects duplicate roles and inverted tier bounds", async () => {
  const catalog = await loadJson("../routing/agents.json");
  const tiers = await loadJson("../routing/model-tiers.json");
  assert.doesNotThrow(() => validateCatalog(catalog, tiers));

  const duplicate = structuredClone(catalog);
  duplicate.agents[1].id = duplicate.agents[0].id;
  assert.throws(() => validateCatalog(duplicate, tiers), /Duplicate agent id/);

  const inverted = structuredClone(catalog);
  inverted.agents[0].defaultTier = "deep";
  inverted.agents[0].maximumTier = "standard";
  assert.throws(() => validateCatalog(inverted, tiers), /default tier exceeds its maximum/);
});
