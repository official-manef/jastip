import { test } from "node:test";
import assert from "node:assert/strict";
import { callProvider, parseAiRequest, providerUrl } from "./ai.ts";

const input = {
  baseUrl: "https://api.example.com/v1",
  apiKey: "user-key",
  model: "gpt-4o-mini",
  operation: "chat" as const,
  messages: [{ role: "user" as const, content: "Periksa trip" }],
  tools: [],
};

test("BYOK only sends a key to public HTTPS URLs and rejects private/credential URLs", () => {
  assert.equal(providerUrl("https://api.example.com/v1/").href, "https://api.example.com/v1/");
  for (const url of [
    "http://api.example.com/v1",
    "https://127.0.0.1/v1",
    "https://localhost/v1",
    "https://10.0.0.5/v1",
    "https://192.168.1.4/v1",
    "https://169.254.169.254/v1",
    "https://api.example.com:8443/v1",
    "https://user:password@api.example.com/v1",
    "https://api.example.com/v1?key=embedded",
    "https://intranet/v1",
  ]) {
    assert.throws(() => providerUrl(url), Error, url);
  }
});

test("request parsing requires an explicit baseUrl and model", () => {
  const ok = parseAiRequest({ baseUrl: input.baseUrl, apiKey: "k", model: input.model, prompt: "Halo", operation: "chat" });
  assert.equal(ok.apiKey, "k");
  assert.deepEqual(ok.messages, [{ role: "user", content: "Halo" }]);
  for (const override of [{ baseUrl: "" }, { model: "" }, { messages: [] }, { operation: "invalid" }, { apiKey: "key\r\nInjected: header" }]) {
    assert.throws(() => parseAiRequest({ baseUrl: input.baseUrl, apiKey: "k", model: input.model, operation: "chat", ...override }), /invalid-request/);
  }
});

test("tools and tool results survive parsing; unknown roles are dropped", () => {
  const parsed = parseAiRequest({
    baseUrl: input.baseUrl, model: input.model, operation: "chat", apiKey: "k",
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

test("custom provider receives exact model, tools and no redirects", async () => {
  let called = false;
  const fetcher = (async (url, init) => {
    called = true;
    assert.equal(String(url), "https://custom.example/openai/v1/chat/completions");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer user-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "gpt-4o-mini");
    assert.equal(body.max_tokens, 2048);
    assert.equal(body.stream, false);
    assert.equal(body.messages.at(-1).content, "Periksa trip");
    assert.equal(body.tool_choice, "auto");
    return Response.json({ choices: [{ message: { content: "Jawaban nyata", tool_calls: [{ id: "c9", type: "function", function: { name: "ringkasan_trip", arguments: "{}" } }] } }] });
  }) as typeof fetch;
  const tools = [{ type: "function" as const, function: { name: "ringkasan_trip", description: "d", parameters: { type: "object" } } }];
  const result = await callProvider({ ...input, baseUrl: "https://custom.example/openai/v1", tools }, "user-key", fetcher);
  assert.equal(called, true);
  assert.deepEqual(result, { content: "Jawaban nyata", toolCalls: [{ id: "c9", type: "function", function: { name: "ringkasan_trip", arguments: "{}" } }] });
});

test("private destinations are rejected before a key leaves the server", async () => {
  let called = false;
  await assert.rejects(callProvider({ ...input, baseUrl: "https://10.0.0.9/v1" }, "user-key", (async () => { called = true; return Response.json({}); }) as typeof fetch));
  assert.equal(called, false);
});

test("provider error bodies are discarded rather than exposing request secrets", async () => {
  await assert.rejects(callProvider(input, "user-key", (async () => new Response("secret payload must not surface", { status: 401 })) as typeof fetch), error => {
    assert.equal((error as Error).message, "provider-auth");
    return true;
  });
});

test("model listing preserves exact API IDs and filters invalid duplicate entries", async () => {
  const result = await callProvider({ ...input, operation: "models", messages: [] }, "user-key", (async (url, init) => {
    assert.equal(String(url), "https://api.example.com/v1/models");
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    return Response.json({ data: [{ id: "gpt-4o-mini" }, { id: "gpt-4o-mini" }, { id: 42 }] });
  }) as typeof fetch);
  assert.deepEqual(result, { models: ["gpt-4o-mini"] });
});
