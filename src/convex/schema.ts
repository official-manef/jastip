import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { dir, mode, scenario } from "./validators";

export default defineSchema({
  trips: defineTable({
    key: v.literal("live"),
    dir,
    mode,
    cgkIst: scenario,
    istCgk: scenario,
  }).index("by_key", ["key"]),
});
