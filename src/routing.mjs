const RISK_TIER = Object.freeze({
  low: "fast",
  normal: "standard",
  high: "deep",
});

const MODEL_TIERS = Object.freeze(["fast", "standard", "deep"]);

function tierIndex(tiers) {
  return new Map(tiers.tiers.map((tier) => [tier.id, tier.rank]));
}

function clampTier(requested, minimum, maximum, tiers) {
  const ranks = tierIndex(tiers);
  const requestedRank = ranks.get(requested);
  const minimumRank = ranks.get(minimum);
  const maximumRank = ranks.get(maximum);

  if ([requestedRank, minimumRank, maximumRank].some((rank) => rank === undefined)) {
    throw new Error("Routing catalog references an unknown model tier.");
  }

  const rank = Math.min(Math.max(requestedRank, minimumRank), maximumRank);
  const match = tiers.tiers.find((tier) => tier.rank === rank);
  if (!match) throw new Error(`No model tier has rank ${rank}.`);
  return match.id;
}

function coversCapabilities(agent, requiredCapabilities = []) {
  return requiredCapabilities.every((capability) => agent.capabilities.includes(capability));
}

export function validateCatalog(catalog, tiers) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.agents)) {
    throw new Error("Unsupported or malformed agent catalog.");
  }
  if (tiers?.schemaVersion !== 1 || !Array.isArray(tiers.tiers)) {
    throw new Error("Unsupported or malformed model-tier catalog.");
  }

  const ranks = tierIndex(tiers);
  if (
    ranks.size !== MODEL_TIERS.length ||
    MODEL_TIERS.some((tier, rank) => ranks.get(tier) !== rank)
  ) {
    throw new Error("Model tiers must be fast, standard, and deep with ascending ranks.");
  }

  const ids = new Set();
  for (const agent of catalog.agents) {
    if (ids.has(agent.id)) throw new Error(`Duplicate agent id: ${agent.id}.`);
    ids.add(agent.id);

    if (
      !agent.id ||
      !agent.description ||
      !Array.isArray(agent.activities) ||
      agent.activities.length === 0 ||
      !Array.isArray(agent.sources) ||
      agent.sources.length === 0 ||
      !Array.isArray(agent.capabilities) ||
      agent.capabilities.length === 0 ||
      !Array.isArray(agent.useWhen) ||
      agent.useWhen.length === 0 ||
      !Array.isArray(agent.avoidWhen) ||
      agent.avoidWhen.length === 0 ||
      !agent.outputContract
    ) {
      throw new Error(`Agent ${agent.id || "(unnamed)"} is missing required routing boundaries.`);
    }

    const minimum = ranks.get(agent.defaultTier);
    const maximum = ranks.get(agent.maximumTier);
    if (minimum === undefined || maximum === undefined) {
      throw new Error(`Agent ${agent.id} references an unknown tier.`);
    }
    if (minimum > maximum) {
      throw new Error(`Agent ${agent.id} default tier exceeds its maximum.`);
    }
  }
}

export function resolveModels({ env = {}, projectConfig = {}, globalConfig = {} }) {
  const models = Object.fromEntries(
    MODEL_TIERS.map((tier) => {
      const envName = `AGENT_ROUTING_MODEL_${tier.toUpperCase()}`;
      const value = env[envName] || projectConfig.models?.[tier] || globalConfig.models?.[tier];
      return [tier, typeof value === "string" ? value.trim() : ""];
    }),
  );
  const missing = MODEL_TIERS.filter((tier) => !models[tier]);

  if (missing.length > 0) {
    throw new Error(
      `Missing model mapping for ${missing.join(", ")}. Configure every routing tier explicitly.`,
    );
  }

  return models;
}

export function selectRoute(classification, catalog, tiers) {
  const riskTier = RISK_TIER[classification.risk];
  if (!riskTier) throw new Error(`Unknown routing risk: ${classification.risk}`);

  if (!classification.delegate) {
    return { agent: "main", tier: riskTier };
  }

  const eligible = catalog.agents.filter(
    (agent) =>
      agent.activities.includes(classification.activity) &&
      agent.sources.includes(classification.source) &&
      coversCapabilities(agent, classification.requiredCapabilities),
  );

  if (classification.requestedAgent) {
    if (classification.requestedAgent === "main") {
      return { agent: "main", tier: riskTier };
    }

    const requested = eligible.find((agent) => agent.id === classification.requestedAgent);
    if (!requested) {
      throw new Error(`Requested agent ${classification.requestedAgent} is not eligible for this task.`);
    }

    return {
      agent: requested.id,
      tier: clampTier(riskTier, requested.defaultTier, requested.maximumTier, tiers),
    };
  }

  if (eligible.length === 0) {
    return { agent: "main", tier: riskTier };
  }

  const [agent] = eligible;
  return {
    agent: agent.id,
    tier: clampTier(riskTier, agent.defaultTier, agent.maximumTier, tiers),
  };
}
