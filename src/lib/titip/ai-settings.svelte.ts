/**
 * Setelan AI bersama (chat + pengaturan), mode BYOK: URL, model, dan API key
 * semuanya milik pengguna. URL/model disimpan di perangkat; key hanya di
 * memori halaman. Tidak ada key server.
 */
import { browser } from "$app/env";

const STORAGE_KEY = "titipin-ai-settings";

export const aiSettings = $state({
  baseUrl: "",
  model: "",
  /** Key user (BYOK). */
  apiKey: "",
  loaded: false,
});

export function saveAiSettings() {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseUrl: aiSettings.baseUrl, model: aiSettings.model }));
  } catch { /* storage unavailable */ }
}

export function loadAiSettings(): void {
  if (!browser || aiSettings.loaded) return;
  aiSettings.loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (typeof saved?.baseUrl === "string") aiSettings.baseUrl = saved.baseUrl;
    if (typeof saved?.model === "string") aiSettings.model = saved.model;
  } catch { /* keep defaults */ }
}

/** Pesan kesalahan penyedia dalam bahasa Indonesia. */
export function aiError(code: string | undefined): string {
  const map: Record<string, string> = {
    masuk: "Masuk dulu untuk memakai asisten.",
    "tanpa-key": "Isi API key penyedia Anda di halaman Pengaturan dulu.",
    "invalid-request": "Lengkapi URL penyedia dan ID model.",
    "provider-not-allowed": "URL penyedia tidak valid (harus HTTPS publik tanpa port/kredensial).",
    "provider-auth": "API key ditolak penyedia.",
    "provider-limit": "Kuota penyedia tercapai.",
    "provider-error": "Penyedia menolak permintaan.",
    "provider-format": "Respons penyedia tidak sesuai format.",
    "provider-unreachable": "Penyedia belum dapat dihubungi.",
  };
  return map[code ?? ""] ?? "Permintaan belum berhasil. Coba lagi.";
}
