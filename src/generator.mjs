import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { renderAgent } from "./adapters.mjs";

async function replaceMarkdownFiles(directory, files) {
  await mkdir(directory, { recursive: true });
  const existing = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    existing
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => rm(join(directory, entry.name))),
  );
  await Promise.all(
    files.map(({ name, content }) => writeFile(join(directory, name), content, "utf8")),
  );
}

function renderedFiles(catalog, tiers, harness, models) {
  const ranks = new Map(tiers.tiers.map((tier) => [tier.id, tier.rank]));
  return catalog.agents.flatMap((agent) =>
    tiers.tiers
      .filter(
        (tier) =>
          tier.rank >= ranks.get(agent.defaultTier) &&
          tier.rank <= ranks.get(agent.maximumTier),
      )
      .map((tier) => {
        const name = `${agent.id}${tier.id === agent.defaultTier ? "" : `-${tier.id}`}`;
        return {
          name: `${name}.md`,
          content: renderAgent(agent, harness, models, { name, tier: tier.id }),
        };
      }),
  );
}

export async function writeAgentAdapters({ catalog, tiers, destinations, models }) {
  await Promise.all(
    Object.entries(destinations).map(([harness, directory]) =>
      replaceMarkdownFiles(directory, renderedFiles(catalog, tiers, harness, models)),
    ),
  );
}
export async function checkAgentAdapters({ catalog, tiers, destinations, models }) {
  const stale = [];

  for (const [harness, directory] of Object.entries(destinations)) {
    const expected = new Map(
      renderedFiles(catalog, tiers, harness, models).map((file) => [file.name, file.content]),
    );
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    const actualNames = new Set(
      entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name),
    );

    for (const [name, content] of expected) {
      const path = join(directory, name);
      const actual = actualNames.has(name) ? await readFile(path, "utf8") : undefined;
      if (actual !== content) stale.push(path);
    }

    for (const name of actualNames) {
      if (!expected.has(name)) stale.push(join(directory, name));
    }
  }

  return stale.sort();
}
