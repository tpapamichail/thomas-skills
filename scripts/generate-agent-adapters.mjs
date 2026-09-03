#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkAgentAdapters,
  checkSessionRules,
  writeAgentAdapters,
  writeSessionRules,
} from "../src/generator.mjs";
import { resolveModels, validateCatalog } from "../src/routing.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const only = option("--only");
const check = args.includes("--check");
const catalog = JSON.parse(await readFile(join(root, "routing", "agents.json"), "utf8"));
const tiers = JSON.parse(await readFile(join(root, "routing", "model-tiers.json"), "utf8"));
validateCatalog(catalog, tiers);

let destinations;
let models;
if (only === "opencode") {
  const output = option("--output");
  if (!output) throw new Error("OpenCode generation requires --output <agents-directory>.");
  destinations = { opencode: resolve(output) };
  models = resolveModels({ env: process.env });
} else if (only) {
  throw new Error(`Unsupported --only value: ${only}`);
} else {
  destinations = {
    claude: join(root, "adapters", "claude", "agents"),
    omp: join(root, "adapters", "omp", "agents"),
  };
}

const sessionRules = only
  ? undefined
  : {
      policy: await readFile(join(root, "workflow", "session-rules.md"), "utf8"),
      destinations: {
        claude: join(root, "hooks", "session-rules.md"),
        omp: join(root, "rules", "session-rules.md"),
      },
    };

if (check) {
  const stale = [
    ...(await checkAgentAdapters({ catalog, tiers, destinations, models })),
    ...(sessionRules ? await checkSessionRules(sessionRules) : []),
  ];
  if (stale.length > 0) {
    console.error(`Generated artifacts are stale:\n${stale.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Generated artifacts are current (${catalog.agents.length} canonical roles and session rules).`,
    );
  }
} else {
  await Promise.all([
    writeAgentAdapters({ catalog, tiers, destinations, models }),
    ...(sessionRules ? [writeSessionRules(sessionRules)] : []),
  ]);
  console.log(
    `Generated all routable ${Object.keys(destinations).join(" and ")} role-tier definitions${
      sessionRules ? " and runtime session rules" : ""
    }.`,
  );
}
