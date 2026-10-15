import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { authComponent } from "./auth";

const role = v.union(v.literal("klien"), v.literal("jastiper"), v.literal("admin"));

async function userIdOf(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  return user?._id ?? null;
}

async function myRole(ctx: QueryCtx | MutationCtx, userId: string): Promise<"klien" | "jastiper" | "admin" | null> {
  const row = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return row?.role ?? null;
}

/** Semua akun auth (tabel `user` ada di komponen Better Auth). */
async function listAuthUsers(ctx: QueryCtx): Promise<{ id: string; name: string; email: string }[]> {
  const out: { id: string; name: string; email: string }[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i += 1) {
    const page: { page: unknown[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      { model: "user", paginationOpts: { cursor, numItems: 100 } },
    );
    for (const doc of page.page) {
      const row = doc as Record<string, unknown>;
      out.push({
        id: String(row._id),
        name: typeof row.name === "string" ? row.name : "",
        email: typeof row.email === "string" ? row.email : "",
      });
    }
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  return out;
}

/** Akun + peran. Dipakai route `/api/saya`. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { user: null, role: null, canClaimAdmin: false };
    const adminUserId = process.env.TITIPIN_ADMIN_USER_ID?.trim();
    return {
      user: { id: user._id, name: user.name ?? "", email: user.email ?? "", image: user.image ?? null },
      role: await myRole(ctx, user._id),
      canClaimAdmin: Boolean(adminUserId) && user._id === adminUserId,
    };
  },
});

/** Klaim peran sekali. Klien/jastiper terkunci; admin hanya oleh ID operator. */
export const claimRole = mutation({
  args: { role },
  handler: async (ctx, args) => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" as const };
    const existing = await myRole(ctx, userId);
    if (existing) return { role: existing, locked: true as const };

    if (args.role === "admin") {
      const adminUserId = process.env.TITIPIN_ADMIN_USER_ID?.trim();
      if (!adminUserId || userId !== adminUserId) return { error: "admin-forbidden" as const };
      const admins = await ctx.db.query("profiles").collect();
      if (admins.some((p) => p.role === "admin")) return { error: "admin-taken" as const };
    }
    await ctx.db.insert("profiles", { userId, role: args.role });
    return { role: args.role, locked: false as const };
  },
});

export type Person = { id: string; name: string; email: string; role: "klien" | "jastiper" | "admin" | null };

/** Admin saja: daftar akun + peran. */
export const listPeople = query({
  args: {},
  handler: async (ctx): Promise<{ people: Person[] } | { error: string }> => {
    const userId = await userIdOf(ctx);
    if (!userId) return { error: "masuk" };
    if ((await myRole(ctx, userId)) !== "admin") return { error: "bukan-admin" };
    const users = await listAuthUsers(ctx);
    const profiles = await ctx.db.query("profiles").collect();
    const byUser = new Map(profiles.map((p) => [p.userId, p.role]));
    return { people: users.map((u) => ({ ...u, role: byUser.get(u.id) ?? null })) };
  },
});

/** Admin saja: ubah peran, jaga aturan admin tunggal. */
export const setRole = mutation({
  args: { userId: v.string(), role },
  handler: async (ctx, args) => {
    const meId = await userIdOf(ctx);
    if (!meId) return { error: "masuk" as const };
    if ((await myRole(ctx, meId)) !== "admin") return { error: "bukan-admin" as const };

    const users = await listAuthUsers(ctx);
    if (!users.some((u) => u.id === args.userId)) return { error: "tidak-ada" as const };

    const profiles = await ctx.db.query("profiles").collect();
    const admins = profiles.filter((p) => p.role === "admin");
    const targetIsAdmin = admins.some((p) => p.userId === args.userId);
    if (args.role === "admin" && admins.length > 0 && !targetIsAdmin) return { error: "admin-taken" as const };
    if (args.role !== "admin" && targetIsAdmin && admins.length === 1) return { error: "admin-terakhir" as const };

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { role: args.role });
    else await ctx.db.insert("profiles", { userId: args.userId, role: args.role });
    return { ok: true as const };
  },
});
