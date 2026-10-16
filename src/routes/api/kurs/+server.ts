import { json } from "../../../lib/titip/accounts.server";
import { DESTINASI } from "../../../lib/titip/destinasi";
import { fetchKurs, type KursSnapshot } from "../../../lib/titip/kurs";

/**
 * Kurs dinamis (rupiah per 1 unit). Diambil dari provider gratis tanpa key,
 * dengan cache in-memory 6 jam supaya tidak memanggil tiap request. Bila
 * provider gagal, kirim kurs seed katalog + `sumber: "seed"` supaya UI tetap
 * jalan dan jelas bahwa angkanya contoh.
 */

const TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; snapshot: KursSnapshot } | null = null;

/** Kurs contoh dari katalog bila provider belum/tak bisa dipakai. */
function seedSnapshot(): KursSnapshot {
  const rates: KursSnapshot["rates"] = {};
  for (const d of DESTINASI) if (!(d.currency in rates)) rates[d.currency] = d.kurs;
  return { updatedAt: "", rates, sumber: "seed" };
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return json({ ...cache.snapshot, cached: true });
  }
  try {
    const snapshot = await fetchKurs();
    cache = { at: now, snapshot };
    return json({ ...snapshot, cached: false });
  } catch {
    // Jangan cache kegagalan terlalu lama: fallback ke seed, tandai jelas.
    return json({ ...seedSnapshot(), cached: false, fallback: true });
  }
}
