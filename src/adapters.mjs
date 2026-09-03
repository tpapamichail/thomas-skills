const CLAUDE_MODELS = Object.freeze({ fast: "haiku", standard: "sonnet", deep: "opus" });
const OMP_MODELS = Object.freeze({ fast: "@smol", standard: "@task", deep: "@slow" });
const EFFORT = Object.freeze({ fast: "low", standard: "medium", deep: "high" });

const TOOL_MAP = Object.freeze({
  claude: {
    "workspace-read": ["Read"],
    "workspace-search": ["Grep", "Glob"],
    "vcs-read": ["Bash"],
    "external-read": ["WebFetch"],
    "web-search": ["WebSearch"],
    "workspace-write": ["Edit", "Write"],
    execute: ["Bash"],
  },
  omp: {
    "workspace-read": ["read"],
    "workspace-search": ["grep", "glob"],
    "external-read": ["read"],
    "vcs-read": ["bash"],
    "web-search": ["web_search"],
    "workspace-write": ["edit", "write"],
    execute: ["bash"],
  },
});

const OPENCODE_PERMISSION_MAP = Object.freeze({
  "workspace-read": ["read"],
  "workspace-search": ["glob", "grep", "list"],
  "external-read": ["webfetch"],
  "web-search": ["websearch"],
  "workspace-write": ["edit"],
  execute: ["bash"],
});

function unique(values) {
  return [...new Set(values)];
}

function mappedTools(agent, harness) {
  return unique(agent.capabilities.flatMap((capability) => TOOL_MAP[harness][capability] ?? []));
}

function descriptionFor(agent, name, tier) {
  if (name === agent.id && tier === agent.defaultTier) return agent.description;
  return `Escalated ${tier} variant of ${agent.id}. Use only after routing selected this role and tier. ${agent.description}`;
}

function renderPrompt(agent, tier) {
  return [
    `You are the ${agent.id}.`,
    `Selected model tier: ${tier}.`,
    "",
    `Use when: ${agent.useWhen.join(" ")}`,
    `Do not use when: ${agent.avoidWhen.join(" ")}`,
    `State access: ${agent.stateAccess}.`,
    `Output contract: ${agent.outputContract}`,
    "",
    "Complete only the assigned task. Stay within the stated target and non-goals. Do not perform unrelated validation, cleanup, or state changes. Report missing capabilities instead of broadening permissions or approximating another role.",
  ].join("\n");
}

function renderClaude(agent, name, tier) {
  return [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(descriptionFor(agent, name, tier))}`,
    `tools: ${mappedTools(agent, "claude").join(", ")}`,
    `model: ${CLAUDE_MODELS[tier]}`,
    `effort: ${EFFORT[tier]}`,
    `maxTurns: ${agent.maxTurns}`,
    "---",
    "",
    renderPrompt(agent, tier),
    "",
  ].join("\n");
}

function renderOmp(agent, name, tier) {
  return [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(descriptionFor(agent, name, tier))}`,
    `tools: ${mappedTools(agent, "omp").join(", ")}`,
    `model: ${JSON.stringify(OMP_MODELS[tier])}`,
    `thinking-level: ${EFFORT[tier]}`,
    "blocking: false",
    "---",
    "",
    renderPrompt(agent, tier),
    "",
  ].join("\n");
}

function renderOpenCode(agent, models, name, tier) {
  const permissions = unique(
    agent.capabilities.flatMap((capability) => OPENCODE_PERMISSION_MAP[capability] ?? []),
  );

  if (!models?.[tier]) {
    throw new Error(`Missing OpenCode model mapping for ${tier}.`);
  }

  return [
    "---",
    `description: ${JSON.stringify(descriptionFor(agent, name, tier))}`,
    "mode: subagent",
    `model: ${models[tier]}`,
    `steps: ${agent.maxTurns}`,
    "permission:",
    '  "*": deny',
    ...permissions.map((permission) => `  ${permission}: allow`),
    ...(agent.capabilities.includes("vcs-read")
      ? [
          "  bash:",
          '    "*": deny',
          '    "git diff*": allow',
          '    "git show*": allow',
          '    "git log*": allow',
          '    "git status*": allow',
        ]
      : []),
    "---",
    "",
    renderPrompt(agent, tier),
    "",
  ].join("\n");
}

export function renderAgent(agent, harness, models, options = {}) {
  const name = options.name ?? agent.id;
  const tier = options.tier ?? agent.defaultTier;
  if (!EFFORT[tier]) throw new Error(`Unsupported model tier: ${tier}`);

  if (harness === "claude") return renderClaude(agent, name, tier);
  if (harness === "omp") return renderOmp(agent, name, tier);
  if (harness === "opencode") return renderOpenCode(agent, models, name, tier);
  throw new Error(`Unsupported agent harness: ${harness}`);
}
