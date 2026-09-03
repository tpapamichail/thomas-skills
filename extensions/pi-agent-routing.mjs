import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Type } from "typebox";

import { loadPiModels } from "../src/pi-config.mjs";
import { buildPiArgs, preparePiTask } from "../src/pi-routing.mjs";
import { validateCatalog } from "../src/routing.mjs";

const catalog = JSON.parse(readFileSync(new URL("../routing/agents.json", import.meta.url), "utf8"));
const tiers = JSON.parse(readFileSync(new URL("../routing/model-tiers.json", import.meta.url), "utf8"));
validateCatalog(catalog, tiers);
const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const MAX_OUTPUT_BYTES = 100 * 1024;

const WORKFLOW_POLICY = readFileSync(
  new URL("../workflow/session-rules.md", import.meta.url),
  "utf8",
);

function invocation(args) {
  const currentScript = process.argv[1];
  const isBunVirtual = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtual && existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const executable = basename(process.execPath).toLowerCase();
  if (!/^(node|bun)(\.exe)?$/.test(executable)) {
    return { command: process.execPath, args };
  }
  return { command: "pi", args };
}

function textFromMessage(message) {
  if (message?.role !== "assistant" || !Array.isArray(message.content)) return "";
  return message.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

function truncateOutput(output) {
  if (Buffer.byteLength(output, "utf8") <= MAX_OUTPUT_BYTES) return output;
  let end = Math.min(output.length, MAX_OUTPUT_BYTES);
  while (Buffer.byteLength(output.slice(0, end), "utf8") > MAX_OUTPUT_BYTES) end -= 1;
  return `${output.slice(0, end)}\n\n[Output truncated by agent-routing.]`;
}

async function runPreparedTask(prepared, cwd, signal) {
  const directory = await mkdtemp(join(tmpdir(), "pi-agent-routing-"));
  const promptPath = join(directory, `${prepared.agent.id}.md`);
  await writeFile(promptPath, prepared.systemPrompt, { encoding: "utf8", mode: 0o600 });

  try {
    const target = invocation(buildPiArgs(prepared, promptPath));
    const result = await new Promise((resolve, reject) => {
      const child = spawn(target.command, target.args, {
        cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let buffer = "";
      let finalOutput = "";
      let aborted = false;

      const processLine = (line) => {
        if (!line.trim()) return;
        try {
          const event = JSON.parse(line);
          if (event.type === "message_end") {
            finalOutput = textFromMessage(event.message) || finalOutput;
          }
        } catch {
          stdout += `${line}\n`;
        }
      };

      child.stdout.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (buffer) processLine(buffer);
        if (aborted) return reject(new Error(`Agent ${prepared.agent.id} was aborted.`));
        if (code !== 0) {
          return reject(
            new Error(`Agent ${prepared.agent.id} exited with ${code}: ${stderr.trim() || stdout.trim()}`),
          );
        }
        resolve(finalOutput || stdout.trim() || "(no output)");
      });

      const abort = () => {
        aborted = true;
        child.kill("SIGTERM");
        const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
        timer.unref();
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
    });

    return {
      agent: prepared.agent.id,
      tier: prepared.tier,
      model: prepared.model,
      effort: prepared.effort,
      task: prepared.task,
      output: truncateOutput(result),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export default function agentRoutingExtension(pi) {
  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${WORKFLOW_POLICY}`,
  }));

  let toolRegistered = false;
  pi.on("session_start", async () => {
    if (toolRegistered || pi.getAllTools().some((tool) => tool.name === "task")) return;
    toolRegistered = true;

    const task = Type.Object({
      task: Type.String({
        minLength: 1,
        description: "Complete, self-contained task and acceptance criteria",
      }),
      activity: Type.Union(
        ["research", "mechanical", "implement", "verify", "review", "security-review"].map(
          (value) => Type.Literal(value),
        ),
      ),
      source: Type.Union(["local", "external", "none"].map((value) => Type.Literal(value))),
      risk: Type.Union(["low", "normal", "high"].map((value) => Type.Literal(value))),
      requestedAgent: Type.Optional(Type.String()),
      requiredCapabilities: Type.Optional(Type.Array(Type.String())),
      cwd: Type.Optional(Type.String()),
    });

    pi.registerTool({
      name: "route_task",
      label: "Route task",
      description: "Delegate one self-contained task, or an independent parallel batch, to the narrowest capable canonical agent. The extension resolves an explicit fast, standard, or deep model; it never inherits the parent model. Provide exactly one of task or tasks.",
      parameters: Type.Object({
        task: Type.Optional(task),
        tasks: Type.Optional(Type.Array(task, { maxItems: MAX_PARALLEL_TASKS })),
      }),
      async execute(_toolCallId, params, signal, onUpdate, ctx) {
        const requests = params.task ? [params.task] : params.tasks;
        if (!requests?.length || (params.task && params.tasks?.length)) {
          throw new Error("Provide exactly one of task or tasks.");
        }

        const prepared = await Promise.all(
          requests.map(async (request) => {
            const cwd = request.cwd ?? ctx.cwd;
            const models = await loadPiModels({ cwd });
            return { cwd, task: preparePiTask(request, { catalog, tiers, models }) };
          }),
        );
        onUpdate?.({
          content: [
            {
              type: "text",
              text: prepared
                .map(({ task }) => `→ ${task.agent.id}: ${task.model} @ ${task.effort} — ${task.task}`)
                .join("\n"),
            },
          ],
          details: { status: "running" },
        });

        const results = await mapWithConcurrency(prepared, MAX_CONCURRENCY, ({ cwd, task }) =>
          runPreparedTask(task, cwd, signal),
        );
        return {
          content: [
            {
              type: "text",
              text: results
                .map(
                  (result) =>
                    `### ${result.agent} (${result.model}, ${result.effort})\n\n${result.output}`,
                )
                .join("\n\n---\n\n"),
            },
          ],
          details: { status: "completed", results },
        };
      },
    });
  });

}
