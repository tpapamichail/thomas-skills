import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const agentPluginsSchema =
  "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

test("the package exposes bundled skills through the Agent Plugins standard", async () => {
  let manifest;
  try {
    manifest = JSON.parse(
      await readFile(new URL("../plugin.json", import.meta.url), "utf8"),
    );
  } catch (error) {
    assert.fail(`Missing or invalid root plugin.json: ${error.message}`);
  }

  assert.equal(manifest.$schema, agentPluginsSchema);
  assert.equal(manifest.name, "thomas-skills");

  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.ok(
    packageJson.files.includes("plugin.json"),
    "npm/git installs must retain the portable plugin manifest",
  );
});
