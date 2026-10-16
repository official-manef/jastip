import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

/**
 * Langganan (DOKU). Aplikasi menyiapkan invoice `pending`; status sebenarnya
 * datang dari webhook DOKU. Fungsi di sini sengaja tipis:
 *
 * - `mine`      : status langganan pemilik sesi (dibaca UI).
 * - `buatInvoice`: buat baris `pending` + kembalikan `invoiceId` (kunci idempoten).
 * - `tandaiBayar`: dipanggil webhook (dengan `DOKU_WEBHOOK_SECRET`) untuk
 *                  mengubah `pending` → `aktif`. Tidak menerima harga dari luar.
 *
 * Harga paket ditentukan server (`HARGA.pro`), bukan dikirim klien.
 */

/** Harga resmi paket (rupiah per bulan). Satu sumber, tak dari klien. */
export const HARGA = { pro: 99000 } as const;
/** Lama langganan aktif (hari) setelah pembayaran. */
const DURASI_HARI = 30;

async function userIdOf(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  return user?._id ?? null;
}

/** Langganan aktif terbaru milik pemilik sesi, atau null. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" as const };
    const rows = await ctx.db.query("subscriptions").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const aktif = rows
      .filter((r) => r.status === "aktif")
      .sort((a, b) => b._creationTime - a._creationTime)[0];
    const pending = rows
      .filter((r) => r.status === "pending")
      .sort((a, b) => b._creationTime - a._creationTime)[0];
    return {
      aktif: aktif
        ? { plan: aktif.plan, harga: aktif.harga, mulai: aktif.mulai ?? null, selesai: aktif.selesai ?? null, metode: aktif.metode ?? null }
        : null,
      pending: pending ? { plan: pending.plan, harga: pending.harga, invoiceId: pending.invoiceId } : null,
      harga: HARGA.pro,
    };
  },
});

/** Buat invoice pending baru untuk pemilik sesi. Mengembalikan `invoiceId`. */
export const buatInvoice = mutation({
  args: { plan: v.union(v.literal("pro")) },
  handler: async (ctx, args) => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" as const };
    const invoiceId = `INV-${crypto.randomUUID()}`;
    await ctx.db.insert("subscriptions", {
      userId,
      plan: "pro",
      status: "pending",
      invoiceId,
      harga: HARGA[args.plan],
    });
    return { ok: true as const, invoiceId, harga: HARGA[args.plan], plan: args.plan };
  },
});

export type WebhookInput = {
  invoiceId: string;
  dokuInvoice?: string;
  metode?: string;
  sukses: boolean;
};

/**
 * Terapkan hasil webhook. Sumber kebenaran status. `secret` diperiksa di route
 * (`/api/doku/webhook`) terhadap env `DOKU_WEBHOOK_SECRET`; fungsi ini tetap
 * menerima `secret` dan membandingkan dengan env Convex supaya aman walau
 * dipanggil dari tempat lain.
 */
export const tandaiBayar = mutation({
  args: {
    secret: v.string(),
    invoiceId: v.string(),
    dokuInvoice: v.optional(v.string()),
    metode: v.optional(v.string()),
    sukses: v.boolean(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.DOKU_WEBHOOK_SECRET?.trim();
    if (!expected || args.secret !== expected) return { error: "rahasia" as const };
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .unique();
    if (!row) return { error: "tidak-ada" as const };
    if (row.status === "aktif") return { ok: true as const, sudah: true };

    if (!args.sukses) {
      await ctx.db.patch(row._id, { status: "batal", dokuInvoice: args.dokuInvoice, metode: args.metode });
      return { ok: true as const, status: "batal" as const };
    }

    const mulai = new Date();
    const selesai = new Date(mulai.getTime() + DURASI_HARI * 24 * 60 * 60 * 1000);
    await ctx.db.patch(row._id, {
      status: "aktif",
      mulai: mulai.toISOString(),
      selesai: selesai.toISOString(),
      dokuInvoice: args.dokuInvoice,
      metode: args.metode,
    });
    return { ok: true as const, status: "aktif" as const, selesai: selesai.toISOString() };
  },
});
