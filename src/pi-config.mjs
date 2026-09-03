import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, parse } from "node:path";

import { resolveModels } from "./routing.mjs";

async function readConfig(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid agent-routing config at ${path}: ${error.message}`, { cause: error });
  }
}

async function findProjectConfig(cwd) {
  let directory = cwd;
  const root = parse(directory).root;

  while (true) {
    const path = join(directory, ".pi", "agent-routing.json");
    const config = await readConfig(path);
    if (config) return config;
    if (directory === root) return {};
    directory = dirname(directory);
  }
}

export async function loadPiModels({ cwd = process.cwd(), home = homedir(), env = process.env } = {}) {
  const [projectConfig, globalConfig] = await Promise.all([
    findProjectConfig(cwd),
    readConfig(join(home, ".pi", "agent", "agent-routing.json")),
  ]);

  return resolveModels({
    env,
    projectConfig,
    globalConfig: globalConfig ?? {},
  });
}
