import assert from "node:assert/strict";
import test from "node:test";

import agentRoutingExtension from "../extensions/pi-agent-routing.mjs";


function fakePi(existingTools = []) {
  const handlers = new Map();
  const registered = [];
  let runtimeReady = false;
  return {
    handlers,
    registered,
    getAllTools: () => {
      if (!runtimeReady) {
        throw new Error("Extension runtime not initialized. Action methods cannot be called during extension loading.");
      }
      return existingTools;
    },
    on: (name, handler) => handlers.set(name, handler),
    registerTool: (tool) => registered.push(tool),
    start: async () => {
      runtimeReady = true;
      await handlers.get("session_start")?.({}, {});
    },
  };
}

test("Pi registers route_task, while OMP keeps its native task tool", async () => {
  const pi = fakePi();
  assert.doesNotThrow(() => agentRoutingExtension(pi));
  await pi.start();
  assert.deepEqual(pi.registered.map((tool) => tool.name), ["route_task"]);

  const piPrompt = await pi.handlers.get("before_agent_start")({
    systemPrompt: "base",
    systemPromptOptions: { selectedTools: ["route_task"] },
  });
  assert.match(piPrompt.systemPrompt, /Route the agent first, then the model/);

  const omp = fakePi([{ name: "task" }]);
  assert.doesNotThrow(() => agentRoutingExtension(omp));
  await omp.start();
  assert.deepEqual(omp.registered, []);
  const ompPrompt = await omp.handlers.get("before_agent_start")({
    systemPrompt: "base",
    systemPromptOptions: { selectedTools: ["task"] },
  });
  assert.match(ompPrompt.systemPrompt, /Route the agent first, then the model/);
});

test("OMP injects standing workflow rules even without a task tool", async () => {
  const omp = fakePi();
  agentRoutingExtension(omp);

  const prompt = await omp.handlers.get("before_agent_start")({
    systemPrompt: "base",
    systemPromptOptions: { selectedTools: [] },
  });

  assert.match(prompt.systemPrompt, /TDD is mandatory/);
  assert.match(prompt.systemPrompt, /Git flow is mandatory/);
  assert.match(prompt.systemPrompt, /Route the agent first, then the model/);
});

test("OMP generated agents request workflow skills for subagent sessions", async () => {
  const { readFile } = await import("node:fs/promises");
  const reviewer = await readFile(new URL("../adapters/omp/agents/reviewer.md", import.meta.url), "utf8");

  assert.match(reviewer, /^autoload-skills: tdd, gh-flow, agent-routing$/m);
});
