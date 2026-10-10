import { mutation, query } from "convex/server";
import { v } from "convex/values";

const dir = v.union(v.literal("cgk-ist"), v.literal("ist-cgk"));
const mode = v.union(v.literal("one"), v.literal("pp"));

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("ledger").withIndex("by_key", (q) => q.eq("key", "uji")).unique();
  },
});

export const save = mutation({
  args: { dir, mode, byDir: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ledger")
      .withIndex("by_key", (q) => q.eq("key", "uji"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("ledger", { key: "uji", ...args });
  },
});
