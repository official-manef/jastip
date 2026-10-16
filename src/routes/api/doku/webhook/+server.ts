import { api } from "../../../../convex/_generated/api";
import { json } from "../../../../lib/titip/accounts.server";
import { convexServer } from "../../../../lib/titip/convex.server";

/**
 * Webhook DOKU. DOKU memanggil ini setelah pembayaran. Format nyata bergantung
 * akun merchant, jadi route ini menerima bentuk netral dan memetakannya:
 *
 *   POST /api/doku/webhook
 *   { "invoiceId": "INV-...", "dokuInvoice"?: "...", "metode"?: "QRIS",
 *     "status"?: "SUCCESS"|"PAID"|"SUCCESS", "sukses"?: true }
 *
 * Sekuriti: `DOKU_WEBHOOK_SECRET` (env Vercel) dibandingkan dengan header
 * `x-doku-secret` ATAU field `secret`. Fungsi Convex juga membandingkan dengan
 * env Convex, jadi dua lapis. **Jangan** taruh kredensial DOKU di route ini.
 *
 * ponytail: verifikasi signature resmi DOKU (HMAC atas raw body) belum ada —
 * butuh spec merchant. Sekarang pakai shared secret. Ganti saat kredensial ada.
 */

const SUKSES = new Set(["SUCCESS", "PAID", "SETTLEMENT", "CAPTURED", "BERHASIL"]);

export async function POST({ request }: { request: Request }) {
  const expected = process.env.DOKU_WEBHOOK_SECRET?.trim();
  if (!expected) return json({ error: "belum-dikonfigurasi" }, 503);

  const headerSecret = request.headers.get("x-doku-secret") ?? "";
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return json({ error: "isian" }, 400);
  }
  const secret = headerSecret || (typeof body.secret === "string" ? body.secret : "");
  if (secret !== expected) return json({ error: "rahasia" }, 401);

  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
  if (!invoiceId) return json({ error: "isian" }, 400);
  const status = typeof body.status === "string" ? body.status.toUpperCase() : "";
  const sukses = body.sukses === true || SUKSES.has(status);

  const result = await convexServer().mutation(api.subscriptions.tandaiBayar, {
    secret: expected,
    invoiceId,
    dokuInvoice: typeof body.dokuInvoice === "string" ? body.dokuInvoice : undefined,
    metode: typeof body.metode === "string" ? body.metode : undefined,
    sukses,
  });
  if ("error" in result && result.error) {
    return json({ error: result.error }, result.error === "tidak-ada" ? 404 : 401);
  }
  return json(result);
}
