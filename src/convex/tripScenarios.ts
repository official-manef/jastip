import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

/** Slug per-owner; URL- dan index-safe. Sama seperti `lib/titip/trips.ts`. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
function isSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_RE.test(value);
}

async function userIdOf(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  return user?._id ?? null;
}

/** `utama` = trip aktif meja hitung. */
export const getMain = query({
  args: {},
  handler: async (ctx) => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" as const };
    const row = await ctx.db
      .query("tripScenarios")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", "utama"))
      .unique();
    return { trip: row?.state ?? null, version: row?.version ?? 0 };
  },
});

/**
 * Simpan trip aktif. `expected` = versi yang terakhir dilihat klien; beda =
 * konflik (jangan menimpa perubahan perangkat lain).
 */
export const saveMain = mutation({
  args: { trip: v.any(), version: v.number() },
  handler: async (ctx, args) => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" as const };
    const existing = await ctx.db
      .query("tripScenarios")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", "utama"))
      .unique();
    const current = existing?.version ?? null;
    if (current !== null && current !== args.version) return { error: "konflik" as const, version: current };
    const next = current === null ? 1 : current + 1;
    if (existing) await ctx.db.patch(existing._id, { state: args.trip, version: next });
    else await ctx.db.insert("tripScenarios", {
      userId, id: `trip-${crypto.randomUUID()}`, slug: "utama", name: "Trip utama",
      state: args.trip, version: 1,
    });
    return { ok: true as const, version: next };
  },
});

export const listTrips = query({
  args: {},
  handler: async (ctx) => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" as const };
    const rows = await ctx.db.query("tripScenarios").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    return {
      trips: rows
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 100)
        .map((r) => ({ slug: r.slug, name: r.name, version: r.version, updatedAt: new Date(r._creationTime).toISOString() })),
    };
  },
});

function uniqueSlug(name: string, taken: string[]): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const safe = base.length >= 1 && SLUG_RE.test(base) ? base : "trip";
  if (!taken.includes(safe)) return safe;
  for (let i = 2; i < 1000; i += 1) {
    const cand = `${safe}-${i}`.slice(0, 40).replace(/-+$/, "");
    if (!taken.includes(cand)) return cand;
  }
  return `${safe}-${Date.now().toString(36)}`.slice(0, 40);
}

export const createTrip = mutation({
  args: { name: v.string(), trip: v.any() },
  handler: async (ctx, args) => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" as const };
    const name = args.name.trim().slice(0, 80);
    if (!name) return { error: "isian" as const };
    const rows = await ctx.db.query("tripScenarios").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const slug = uniqueSlug(name, rows.map((r) => r.slug));
    const id = `trip-${crypto.randomUUID()}`;
    await ctx.db.insert("tripScenarios", { userId, id, slug, name, state: args.trip, version: 1 });
    return { id, slug, name, version: 1 };
  },
});

export const patchTrip = mutation({
  args: { slug: v.string(), name: v.optional(v.string()), trip: v.optional(v.any()), version: v.number() },
  handler: async (ctx, args) => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" as const };
    if (!isSlug(args.slug)) return { error: "slug" as const };
    const row = await ctx.db
      .query("tripScenarios")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", args.slug))
      .unique();
    if (!row) return { error: "tidak-ada" as const };
    if (row.version !== args.version) return { error: "konflik" as const, version: row.version };
    const patch: Record<string, unknown> = { version: row.version + 1 };
    if (args.name !== undefined) patch.name = args.name.trim().slice(0, 80);
    if (args.trip !== undefined) patch.state = args.trip;
    await ctx.db.patch(row._id, patch);
    return { ok: true as const, version: row.version + 1 };
  },
});

export const deleteTrip = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" as const };
    if (!isSlug(args.slug)) return { error: "slug" as const };
    const row = await ctx.db
      .query("tripScenarios")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", args.slug))
      .unique();
    if (!row) return { error: "tidak-ada" as const };
    await ctx.db.delete(row._id);
    return { ok: true as const, slug: args.slug };
  },
});
