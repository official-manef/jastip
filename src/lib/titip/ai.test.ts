import { test } from "node:test";
import assert from "node:assert/strict";
import { callProvider, parseAiRequest, providerUrl, DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL } from "./ai.ts";

const input = { baseUrl: DEFAULT_AI_BASE_URL, apiKey: "test-only-key", model: DEFAULT_AI_MODEL, prompt: "Periksa trip", operation: "chat" as const };

test("BYOK only sends a key to approved HTTPS hosts and rejects credential URLs", () => {
  assert.equal(providerUrl(DEFAULT_AI_BASE_URL + "/", ["token.conextlab.ai"]).href, DEFAULT_AI_BASE_URL + "/");
  for (const url of ["http://token.conextlab.ai/v1", "https://127.0.0.1/v1", "https://unapproved.example/v1", "https://token.conextlab.ai:8443/v1", "https://user:password@token.conextlab.ai/v1", "https://token.conextlab.ai/v1?key=embedded"]) {
    assert.throws(() => providerUrl(url, ["token.conextlab.ai"]));
  }
});

test("BYOK validates key headers and bounds model/prompt input", () => {
  assert.equal(parseAiRequest(input).model, DEFAULT_AI_MODEL);
  for (const override of [{ apiKey: "" }, { apiKey: "key\r\nInjected: header" }, { model: "" }, { prompt: "x".repeat(4001) }, { operation: "invalid" }]) {
    assert.throws(() => parseAiRequest({ ...input, ...override }), /invalid-request/);
  }
});

test("custom approved provider receives exact model, bounded output and no redirects", async () => {
  let called = false;
  const fetcher = (async (url, init) => {
    called = true;
    assert.equal(String(url), "https://custom.example/openai/v1/chat/completions");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-only-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, DEFAULT_AI_MODEL);
    assert.equal(body.max_tokens, 512);
    assert.equal(body.stream, false);
    assert.equal(body.messages[1].content, input.prompt);
    return Response.json({ choices: [{ message: { content: "Jawaban nyata dari transport uji" } }] });
  }) as typeof fetch;
  const result = await callProvider({ ...input, baseUrl: "https://custom.example/openai/v1" }, ["custom.example"], fetcher);
  assert.equal(called, true);
  assert.deepEqual(result, { content: "Jawaban nyata dari transport uji" });
});

test("unapproved destinations are rejected before a key leaves the server", async () => {
  let called = false;
  await assert.rejects(callProvider({ ...input, baseUrl: "https://unapproved.example/v1" }, ["token.conextlab.ai"], (async () => { called = true; return Response.json({}); }) as typeof fetch));
  assert.equal(called, false);
});

test("provider error bodies are discarded rather than exposing request secrets", async () => {
  await assert.rejects(callProvider(input, ["token.conextlab.ai"], (async () => new Response("secret payload must not surface", { status: 401 })) as typeof fetch), error => {
    assert.equal((error as Error).message, "provider-auth");
    return true;
  });
});

test("model listing preserves exact API IDs and filters invalid duplicate entries", async () => {
  const result = await callProvider({ ...input, operation: "models" }, ["token.conextlab.ai"], (async (url, init) => {
    assert.equal(String(url), DEFAULT_AI_BASE_URL + "/models");
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    return Response.json({ data: [{ id: "exact-model-id" }, { id: "exact-model-id" }, { id: 42 }] });
  }) as typeof fetch);
  assert.deepEqual(result, { models: ["exact-model-id"] });
});
