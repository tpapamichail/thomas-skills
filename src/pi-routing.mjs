import { selectRoute } from "./routing.mjs";

const PI_TOOL_MAP = Object.freeze({
  "workspace-read": ["read"],
  "workspace-search": ["grep", "find", "ls"],
  "vcs-read": ["bash"],
  "external-read": ["read", "bash"],
  "web-search": ["bash"],
  "workspace-write": ["edit", "write"],
  execute: ["bash"],
});

function unique(values) {
  return [...new Set(values)];
}

function renderSystemPrompt(agent) {
  return [
    `You are the ${agent.id}.`,
    agent.description,
    `Use when: ${agent.useWhen.join(" ")}`,
    `Do not use when: ${agent.avoidWhen.join(" ")}`,
    `State access: ${agent.stateAccess}.`,
    `Output contract: ${agent.outputContract}`,
    "Complete only the assigned task. Do not perform unrelated validation, cleanup, or state changes. Report missing capabilities instead of broadening permissions.",
  ].join("\n\n");
}

export function preparePiTask(request, { catalog, tiers, models }) {
  const route = selectRoute({ ...request, delegate: true }, catalog, tiers);
  if (route.agent === "main") {
    throw new Error("No eligible subagent covers this task; keep it in the main session.");
  }

  const agent = catalog.agents.find((candidate) => candidate.id === route.agent);
  const tier = tiers.tiers.find((candidate) => candidate.id === route.tier);
  const model = models[route.tier];
  if (!agent || !tier) throw new Error("The routing catalog is internally inconsistent.");
  if (!model) throw new Error(`Missing model mapping for ${route.tier}.`);

  return {
    agent,
    task: request.task,
    tier: route.tier,
    model,
    effort: tier.effort,
    tools: unique(agent.capabilities.flatMap((capability) => PI_TOOL_MAP[capability] ?? [])),
    systemPrompt: renderSystemPrompt(agent),
  };
}

export function buildPiArgs(prepared, promptPath) {
  return [
    "--mode",
    "json",
    "-p",
    "--no-session",
    "--no-extensions",
    "--model",
    prepared.model,
    "--thinking",
    prepared.effort,
    "--tools",
    prepared.tools.join(","),
    "--append-system-prompt",
    promptPath,
    `Task: ${prepared.task}`,
  ];
}
