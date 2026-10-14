/**
 * Setelan AI bersama (chat + pengaturan). URL/model disimpan di perangkat; API
 * key hanya di memori halaman. Server bisa punya `AI_API_KEY` di env, kalau ada
 * key kosong tetap jalan (dianggap "env").
 */
import { browser } from "$app/env";
import { DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL } from "./ai";

const STORAGE_KEY = "titipin-ai-settings";

export const aiSettings = $state({
  baseUrl: DEFAULT_AI_BASE_URL,
  model: DEFAULT_AI_MODEL,
  /** Key user (BYOK); kosong = pakai key server di env. */
  apiKey: "",
  /** "env" bila server punya AI_API_KEY. */
  serverKey: "",
  loaded: false,
});

export function saveAiSettings() {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseUrl: aiSettings.baseUrl, model: aiSettings.model }));
  } catch { /* storage unavailable */ }
}

export async function loadAiSettings(): Promise<void> {
  if (!browser || aiSettings.loaded) return;
  aiSettings.loaded = true;
  try {
    const res = await fetch("/api/ai");
    const defaults = (await res.json()) as { baseUrl?: string; model?: string; serverKey?: string };
    if (typeof defaults.baseUrl === "string" && defaults.baseUrl) aiSettings.baseUrl = defaults.baseUrl;
    if (typeof defaults.model === "string" && defaults.model) aiSettings.model = defaults.model;
    if (defaults.serverKey) aiSettings.serverKey = defaults.serverKey;
  } catch { /* keep defaults */ }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (typeof saved?.baseUrl === "string" && saved.baseUrl) aiSettings.baseUrl = saved.baseUrl;
    if (typeof saved?.model === "string" && saved.model) aiSettings.model = saved.model;
  } catch { /* keep defaults */ }
}

/** Pesan kesalahan penyedia dalam bahasa Indonesia. */
export function aiError(code: string | undefined): string {
  const map: Record<string, string> = {
    masuk: "Masuk dulu untuk memakai asisten.",
    "tanpa-key": "Belum ada API key. Set AI_API_KEY di server, atau isi key Anda di halaman AI.",
    "invalid-request": "Permintaan tidak valid.",
    "provider-not-allowed": "Endpoint ini belum diizinkan admin.",
    "provider-auth": "API key ditolak penyedia.",
    "provider-limit": "Kuota penyedia tercapai.",
    "provider-error": "Penyedia menolak permintaan.",
    "provider-format": "Respons penyedia tidak sesuai format.",
    "provider-unreachable": "Penyedia belum dapat dihubungi.",
  };
  return map[code ?? ""] ?? "Permintaan belum berhasil. Coba lagi.";
}
