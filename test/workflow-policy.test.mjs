import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loadPolicy = () =>
  readFile(new URL("../workflow/session-rules.md", import.meta.url), "utf8");
const prose = (policy) => policy.replace(/\s+/g, " ").trim();

test("the canonical workflow policy stays compact and wrapper-free", async () => {
  const policy = await loadPolicy();
  const wordCount = policy.trim().split(/\s+/).length;

  assert.ok(wordCount <= 300, `workflow policy grew to ${wordCount} words`);
  assert.doesNotMatch(policy, /^---$/m);
});

test("the standing TDD contract distinguishes behavior changes from pure refactors", async () => {
  const policy = await loadPolicy();
  const text = prose(policy);

  assert.match(text, /Before changing observable production behavior or fixing a bug, load the `tdd` skill/);
  assert.match(text, /behavior-preserving refactor.*affected scope green first/);
  assert.match(text, /do not invent a failing test/);
  assert.match(text, /Runtime-affecting configuration is not exempt/);
  assert.match(text, /Exempt never means unverified/);
  assert.match(text, /final gate once on the unchanged final tree/);
});

test("the standing branch contract reuses repository conventions without silent setup", async () => {
  const policy = await loadPolicy();
  const text = prose(policy);

  assert.match(text, /Before the first repository change meant to land, load the `gh-flow` skill/);
  assert.match(text, /Resolve integration and production branches from repository configuration/);
  assert.match(text, /Reuse a task-matching feature branch; create one only when absent/);
  assert.match(text, /Never initialize git-flow silently/);
  assert.match(text, /If scope changes, ask once:.*finish current then start new.*park current then start new/);
  assert.match(text, /an explicit command already authorizes that exact operation/);
  assert.doesNotMatch(text, /git flow init -d/);
});

test("the standing delegation contract avoids unnecessary handoff and model cost", async () => {
  const policy = await loadPolicy();
  const text = prose(policy);

  assert.match(text, /Before delegation, load the `agent-routing` skill/);
  assert.match(text, /specialization, isolation, or parallelism beats handoff cost/);
  assert.match(text, /Select the agent first, then the cheapest reliable allowed tier/);
  assert.match(text, /Parallelize only independent tasks/);
});
