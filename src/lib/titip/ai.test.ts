import { test } from "node:test";
import assert from "node:assert/strict";
import { callProvider, parseAiRequest, providerUrl, DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL } from "./ai.ts";

const input = {
  baseUrl: DEFAULT_AI_BASE_URL,
  apiKey: "",
  model: DEFAULT_AI_MODEL,
  operation: "chat" as const,
  messages: [{ role: "user" as const, content: "Periksa trip" }],
  tools: [],
};

test("BYOK only sends a key to approved HTTPS hosts and rejects credential URLs", () => {
  assert.equal(providerUrl(DEFAULT_AI_BASE_URL + "/", ["token.conextlab.ai"]).href, DEFAULT_AI_BASE_URL + "/");
  for (const url of ["http://token.conextlab.ai/v1", "https://127.0.0.1/v1", "https://unapproved.example/v1", "https://token.conextlab.ai:8443/v1", "https://user:password@token.conextlab.ai/v1", "https://token.conextlab.ai/v1?key=embedded"]) {
    assert.throws(() => providerUrl(url, ["token.conextlab.ai"]));
  }
});

test("request parsing accepts a legacy prompt and empty key (server key fallback)", () => {
  const fromPrompt = parseAiRequest({ baseUrl: DEFAULT_AI_BASE_URL, apiKey: "", model: DEFAULT_AI_MODEL, prompt: "Halo", operation: "chat" });
  assert.equal(fromPrompt.apiKey, "");
  assert.deepEqual(fromPrompt.messages, [{ role: "user", content: "Halo" }]);
  for (const override of [{ messages: [] }, { operation: "invalid" }, { apiKey: "key\r\nInjected: header" }]) {
    assert.throws(() => parseAiRequest({ ...input, model: DEFAULT_AI_MODEL, operation: "chat", apiKey: "k", ...override }), /invalid-request/);
  }
});

test("tools and tool results survive parsing; unknown roles are dropped", () => {
  const parsed = parseAiRequest({
    baseUrl: DEFAULT_AI_BASE_URL, model: DEFAULT_AI_MODEL, operation: "chat", apiKey: "k",
    messages: [
      { role: "user", content: "ubah harga" },
      { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "set_trip", arguments: "{\"hargaPerKg\":1}" } }] },
      { role: "tool", tool_call_id: "c1", content: "{\"ok\":true}" },
      { role: "system", content: "x" },
      { role: "bogus", content: "drop me" },
    ],
    tools: [{ type: "function", function: { name: "set_trip", description: "d", parameters: { type: "object" } } }],
  });
  assert.equal(parsed.messages.length, 4);
  assert.equal(parsed.messages[1].tool_calls?.[0].function.name, "set_trip");
  assert.equal(parsed.messages[2].tool_call_id, "c1");
  assert.equal(parsed.tools.length, 1);
});

test("custom approved provider receives exact model, tools and no redirects", async () => {
  let called = false;
  const fetcher = (async (url, init) => {
    called = true;
    assert.equal(String(url), "https://custom.example/openai/v1/chat/completions");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer server-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, DEFAULT_AI_MODEL);
    assert.equal(body.max_tokens, 2048);
    assert.equal(body.stream, false);
    assert.equal(body.messages.at(-1).content, "Periksa trip");
    assert.equal(body.tool_choice, "auto");
    return Response.json({ choices: [{ message: { content: "Jawaban nyata", tool_calls: [{ id: "c9", type: "function", function: { name: "ringkasan_trip", arguments: "{}" } }] } }] });
  }) as typeof fetch;
  const tools = [{ type: "function" as const, function: { name: "ringkasan_trip", description: "d", parameters: { type: "object" } } }];
  const result = await callProvider({ ...input, baseUrl: "https://custom.example/openai/v1", tools }, ["custom.example"], "server-key", fetcher);
  assert.equal(called, true);
  assert.deepEqual(result, { content: "Jawaban nyata", toolCalls: [{ id: "c9", type: "function", function: { name: "ringkasan_trip", arguments: "{}" } }] });
});

test("unapproved destinations are rejected before a key leaves the server", async () => {
  let called = false;
  await assert.rejects(callProvider({ ...input, baseUrl: "https://unapproved.example/v1" }, ["token.conextlab.ai"], "server-key", (async () => { called = true; return Response.json({}); }) as typeof fetch));
  assert.equal(called, false);
});

test("provider error bodies are discarded rather than exposing request secrets", async () => {
  await assert.rejects(callProvider(input, ["token.conextlab.ai"], "server-key", (async () => new Response("secret payload must not surface", { status: 401 })) as typeof fetch), error => {
    assert.equal((error as Error).message, "provider-auth");
    return true;
  });
});

test("model listing preserves exact API IDs and filters invalid duplicate entries", async () => {
  const result = await callProvider({ ...input, operation: "models", messages: [] }, ["token.conextlab.ai"], "server-key", (async (url, init) => {
    assert.equal(String(url), DEFAULT_AI_BASE_URL + "/models");
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    return Response.json({ data: [{ id: "ollama/deepseek-v4.1-flash:cloud" }, { id: "ollama/deepseek-v4.1-flash:cloud" }, { id: 42 }] });
  }) as typeof fetch);
  assert.deepEqual(result, { models: ["ollama/deepseek-v4.1-flash:cloud"] });
});
