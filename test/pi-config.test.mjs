import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadPiModels } from "../src/pi-config.mjs";

test("Pi model config uses environment, nearest project, then global precedence", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "agent-routing-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const home = join(root, "home");
  const project = join(root, "project");
  const nested = join(project, "src", "nested");
  await mkdir(join(home, ".pi", "agent"), { recursive: true });
  await mkdir(join(project, ".pi"), { recursive: true });
  await mkdir(nested, { recursive: true });
  await writeFile(
    join(home, ".pi", "agent", "agent-routing.json"),
    JSON.stringify({
      models: {
        fast: "provider/fast-global",
        standard: "provider/standard-global",
        deep: "provider/deep-global",
      },
    }),
  );
  await writeFile(
    join(project, ".pi", "agent-routing.json"),
    JSON.stringify({ models: { standard: "provider/standard-project" } }),
  );

  assert.deepEqual(
    await loadPiModels({
      cwd: nested,
      home,
      env: { AGENT_ROUTING_MODEL_DEEP: "provider/deep-env" },
    }),
    {
      fast: "provider/fast-global",
      standard: "provider/standard-project",
      deep: "provider/deep-env",
    },
  );
});
