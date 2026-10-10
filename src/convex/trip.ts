import { mutation, query } from "./_generated/server";
import { scenarioFor } from "../lib/titip/calc";
import { dir, mode, scenario } from "./validators";

const tripArgs = { dir, mode, cgkIst: scenario, istCgk: scenario };

function seed() {
  return {
    key: "live" as const,
    dir: "cgk-ist" as const,
    mode: "one" as const,
    cgkIst: scenarioFor("cgk-ist"),
    istCgk: scenarioFor("ist-cgk"),
  };
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("trips")
      .withIndex("by_key", (q) => q.eq("key", "live"))
      .unique();
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("trips")
      .withIndex("by_key", (q) => q.eq("key", "live"))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("trips", seed());
  },
});

export const save = mutation({
  args: tripArgs,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("trips")
      .withIndex("by_key", (q) => q.eq("key", "live"))
      .unique();
    const next = { key: "live" as const, ...args };
    if (existing) {
      await ctx.db.replace(existing._id, next);
      return existing._id;
    }
    return await ctx.db.insert("trips", next);
  },
});
