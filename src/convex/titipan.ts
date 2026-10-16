import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

const arah = v.union(v.literal("cgk-ist"), v.literal("ist-cgk"));
const status = v.union(v.literal("baru"), v.literal("dibawa"), v.literal("selesai"));

async function account(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return null;
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  return { user, role: profile?.role ?? null };
}

function canCarry(role: string | null) {
  return role === "jastiper" || role === "admin";
}
function canAsk(role: string | null) {
  return role === "klien" || role === "admin";
}

/** Klien melihat miliknya; jastiper/admin melihat semua. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const acc = await account(ctx);
    if (!acc) return { error: "masuk" as const };
    if (!acc.role) return { error: "peran" as const };
    // Ambil halaman terbaru tanpa membaca seluruh tabel (index by_user bila klien).
    const rows =
      acc.role === "klien"
        ? await ctx.db.query("titipan").withIndex("by_user", (q) => q.eq("userId", acc.user._id)).order("desc").take(100)
        : await ctx.db.query("titipan").order("desc").take(100);
    return {
      rows: rows.map((r) => ({
        id: r._id,
        userId: r.userId,
        pemilik: r.pemilik,
        arah: r.arah,
        nama: r.nama,
        kg: r.kg,
        catatan: r.catatan,
        status: r.status,
        createdAt: new Date(r._creationTime).toISOString(),
      })),
    };
  },
});

/** Buat titipan (klien/admin). */
export const create = mutation({
  args: { arah, nama: v.string(), kg: v.number(), catatan: v.string() },
  handler: async (ctx, args) => {
    const acc = await account(ctx);
    if (!acc) return { error: "masuk" as const };
    if (!canAsk(acc.role)) return { error: "bukan-klien" as const };
    const nama = args.nama.trim();
    const catatan = args.catatan.trim();
    if (nama.length < 1 || nama.length > 80 || catatan.length > 240) return { error: "isian" as const };
    if (!Number.isFinite(args.kg) || args.kg <= 0 || args.kg > 40) return { error: "kg" as const };
    const id = await ctx.db.insert("titipan", {
      userId: acc.user._id,
      pemilik: acc.user.name ?? acc.user.email ?? "",
      arah: args.arah,
      nama,
      kg: args.kg,
      catatan,
      status: "baru",
    });
    return { id };
  },
});

/** Ubah status titipan (jastiper/admin). */
export const setStatus = mutation({
  // `v.id("titipan")` menolak ID dari tabel lain sebelum handler berjalan.
  args: { id: v.id("titipan"), status },
  handler: async (ctx, args) => {
    const acc = await account(ctx);
    if (!acc) return { error: "masuk" as const };
    if (!canCarry(acc.role)) return { error: "bukan-jastiper" as const };
    const row = await ctx.db.get(args.id);
    if (!row) return { error: "tidak-ada" as const };
    await ctx.db.patch(args.id, { status: args.status });
    return { ok: true as const, id: args.id, status: args.status };
  },
});
