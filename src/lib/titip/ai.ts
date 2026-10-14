export const DEFAULT_AI_BASE_URL = "https://token.conextlab.ai/v1";
/** ID persis dari daftar model penyedia (tools=true, vision=false). */
export const DEFAULT_AI_MODEL = "ollama/deepseek-v4.1-flash:cloud";

/** Definisi tool dalam format OpenAI `tools`. */
export type AiToolDef = {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
};

/** Satu panggilan tool dari model. */
export type AiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: AiToolCall[];
  tool_call_id?: string;
};

export type AiRequest = {
  baseUrl: string;
  /** Boleh kosong: server memakai `AI_API_KEY` dari env. */
  apiKey: string;
  model: string;
  operation: "models" | "chat";
  messages: AiMessage[];
  tools: AiToolDef[];
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

const MAX_MESSAGES = 60;
const MAX_CONTENT = 8000;
const MAX_TOOLS = 64;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > max ? null : text;
}

function parseMessage(raw: unknown): AiMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const role = row.role;
  if (role !== "system" && role !== "user" && role !== "assistant" && role !== "tool") return null;
  const content = typeof row.content === "string" ? row.content.slice(0, MAX_CONTENT) : "";
  const message: AiMessage = { role, content };
  if (role === "tool") {
    const id = cleanText(row.tool_call_id, 200);
    if (!id) return null;
    message.tool_call_id = id;
  }
  if (Array.isArray(row.tool_calls)) {
    message.tool_calls = row.tool_calls.flatMap((call) => {
      if (!call || typeof call !== "object") return [];
      const c = call as Record<string, unknown>;
      const fn = c.function as Record<string, unknown> | undefined;
      const id = cleanText(c.id, 200);
      const name = cleanText(fn?.name, 100);
      if (!id || !name) return [];
      const args = typeof fn?.arguments === "string" ? fn.arguments.slice(0, MAX_CONTENT) : "{}";
      return [{ id, type: "function" as const, function: { name, arguments: args } }];
    });
  }
  return message;
}

function parseTools(raw: unknown): AiToolDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_TOOLS).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const fn = (entry as Record<string, unknown>).function as Record<string, unknown> | undefined;
    const name = cleanText(fn?.name, 100);
    if (!name) return [];
    const description = typeof fn?.description === "string" ? fn.description.slice(0, 1000) : undefined;
    const parameters = fn?.parameters && typeof fn.parameters === "object"
      ? (fn.parameters as Record<string, unknown>)
      : { type: "object", properties: {} };
    return [{ type: "function" as const, function: { name, description, parameters } }];
  });
}

export function parseAiRequest(body: Record<string, unknown>): AiRequest {
  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const baseUrl = text("baseUrl") || DEFAULT_AI_BASE_URL;
  const apiKey = text("apiKey");
  const model = text("model") || DEFAULT_AI_MODEL;
  if (baseUrl.length > 2048 || apiKey.length > 4096 || /[\r\n]/.test(apiKey)) throw new Error("invalid-request");
  if (body.operation === "models") {
    return { baseUrl, apiKey, model, operation: "models", messages: [], tools: [] };
  }
  if (body.operation !== "chat") throw new Error("invalid-request");
  if (!model || model.length > 200) throw new Error("invalid-request");
  // `prompt` dipertahankan untuk pemanggil lama; `messages` untuk chat + tools.
  const rawMessages = Array.isArray(body.messages)
    ? body.messages
    : typeof body.prompt === "string" ? [{ role: "user", content: body.prompt }] : [];
  if (!rawMessages.length || rawMessages.length > MAX_MESSAGES) throw new Error("invalid-request");
  const messages = rawMessages.flatMap((m) => parseMessage(m) ?? []);
  if (!messages.length) throw new Error("invalid-request");
  return { baseUrl, apiKey, model, operation: "chat", messages, tools: parseTools(body.tools) };
}

export type AiChatResult = { content: string; toolCalls: AiToolCall[] };

export async function callProvider(
  input: AiRequest,
  allowedHosts: string[],
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<AiChatResult | { models: string[] }> {
  const base = providerUrl(input.baseUrl, allowedHosts);
  const url = new URL(input.operation === "models" ? "models" : "chat/completions", base);
  const response = await fetcher(url, {
    method: input.operation === "models" ? "GET" : "POST",
    redirect: "error",
    signal: AbortSignal.timeout(60000),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" },
    ...(input.operation === "chat" ? { body: JSON.stringify({
      model: input.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...input.messages,
      ],
      ...(input.tools.length ? { tools: input.tools, tool_choice: "auto" } : {}),
      max_tokens: 2048,
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
  const message = data?.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content.slice(0, 16000) : "";
  const toolCalls: AiToolCall[] = Array.isArray(message?.tool_calls) ? message.tool_calls.flatMap((call: unknown) => {
    const c = call as Record<string, unknown>;
    const fn = c?.function as Record<string, unknown> | undefined;
    if (typeof c?.id !== "string" || typeof fn?.name !== "string") return [];
    return [{ id: c.id, type: "function" as const, function: {
      name: fn.name,
      arguments: typeof fn.arguments === "string" ? fn.arguments : "{}",
    } }];
  }) : [];
  if (!content.trim() && !toolCalls.length) throw new Error("provider-format");
  return { content, toolCalls };
}

export const SYSTEM_PROMPT = [
  "Anda asisten TITIPIN (jastip Jakarta ↔ Turki). Jawab dalam bahasa Indonesia, ringkas.",
  "Anda punya tool untuk mengubah data aplikasi langsung. JIKA pengguna meminta perubahan, panggil tool — jangan hanya menjelaskan.",
  "Setelah tool dipanggil, ringkas apa yang berubah.",
  "Saran omzet dari tool adalah PROYEKSI, bukan omzet diakui atau pesanan.",
  "Jangan mengarang aturan cukai, sumber hukum, peluang pemeriksaan, atau ID/tarif yang tidak ada di data.",
  "Jika data belum cukup, sebutkan yang diperlukan.",
].join(" ");
