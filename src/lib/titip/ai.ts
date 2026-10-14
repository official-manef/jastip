export const DEFAULT_AI_BASE_URL = "https://token.conextlab.ai/v1";
// Kept exactly as supplied. Use the provider's model list to confirm its API ID.
export const DEFAULT_AI_MODEL = "deepseakv4.1 flash";

export type AiRequest = {
  baseUrl: string;
  apiKey: string;
  model: string;
  operation: "models" | "chat";
  prompt: string;
};

export function providerUrl(baseUrl: string, allowedHosts: string[]): URL {
  const url = new URL(baseUrl.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search ||
      (url.port && url.port !== "443") || !allowedHosts.includes(url.hostname)) {
    throw new Error("provider-not-allowed");
  }
  url.pathname = url.pathname.replace(/\/+$/, "") + "/";
  return url;
}

export function parseAiRequest(body: Record<string, unknown>): AiRequest {
  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const baseUrl = text("baseUrl");
  const apiKey = text("apiKey");
  const model = text("model");
  const prompt = text("prompt");
  if (!baseUrl || baseUrl.length > 2048 || !apiKey || apiKey.length > 4096 || /[\r\n]/.test(apiKey) ||
      (body.operation !== "models" && body.operation !== "chat") ||
      (body.operation === "chat" && (!model || model.length > 200 || !prompt || prompt.length > 4000))) {
    throw new Error("invalid-request");
  }
  return { baseUrl, apiKey, model, prompt, operation: body.operation };
}

export async function callProvider(input: AiRequest, allowedHosts: string[], fetcher: typeof fetch = fetch) {
  const base = providerUrl(input.baseUrl, allowedHosts);
  const url = new URL(input.operation === "models" ? "models" : "chat/completions", base);
  const response = await fetcher(url, {
    method: input.operation === "models" ? "GET" : "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json", accept: "application/json" },
    ...(input.operation === "chat" ? { body: JSON.stringify({
      model: input.model,
      messages: [
        { role: "system", content: "Anda asisten TITIPIN. Jawab dalam bahasa Indonesia. Saran hanya proyeksi, bukan pesanan atau omzet aktual. Jangan mengarang aturan cukai, sumber hukum, atau peluang pemeriksaan. Jika data belum cukup, nyatakan informasi yang diperlukan." },
        { role: "user", content: input.prompt },
      ],
      max_tokens: 512,
      stream: false,
    }) } : {}),
  });
  if (!response.ok) {
    // Never expose provider error bodies: they may contain request data or keys.
    throw new Error(response.status === 401 || response.status === 403 ? "provider-auth" :
      response.status === 429 ? "provider-limit" : "provider-error");
  }
  const data = await response.json();
  if (input.operation === "models") {
    if (!Array.isArray(data?.data)) throw new Error("provider-format");
    const models = [...new Set<string>(data.data.flatMap((row: { id?: unknown }) =>
      typeof row?.id === "string" && row.id.length <= 200 ? [row.id] : []))].sort().slice(0, 500);
    return { models };
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("provider-format");
  return { content: content.slice(0, 16000) };
}
