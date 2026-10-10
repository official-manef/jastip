import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ledger: defineTable({
    key: v.string(),
    dir: v.union(v.literal("cgk-ist"), v.literal("ist-cgk")),
    mode: v.union(v.literal("one"), v.literal("pp")),
    byDir: v.any(),
  }).index("by_key", ["key"]),
});
