import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { dir, mode, scenario } from "./validators";


/**
 * Tabel auth (users/sessions/accounts/verifications) hidup di komponen
 * `@convex-dev/better-auth` (`components.betterAuth`), bukan di schema app.
 * Di sini hanya tabel milik aplikasi.
 */
export default defineSchema({
  // Historis: dokumen trip lama `key: live`. Meja kini pakai `tripScenarios`.
  trips: defineTable({
    key: v.literal("live"),
    dir,
    mode,
    cgkIst: scenario,
    istCgk: scenario,
  }).index("by_key", ["key"]),

  // Peran aplikasi per akun auth (`userId` = id user Better Auth).
  profiles: defineTable({
    userId: v.string(),
    role: v.union(v.literal("klien"), v.literal("jastiper"), v.literal("admin")),
  }).index("by_user", ["userId"]),

  // Titipan milik satu akun auth.
  titipan: defineTable({
    userId: v.string(),
    pemilik: v.string(),
    arah: v.union(v.literal("cgk-ist"), v.literal("ist-cgk")),
    nama: v.string(),
    kg: v.number(),
    catatan: v.string(),
    status: v.union(v.literal("baru"), v.literal("dibawa"), v.literal("selesai")),
  }).index("by_user", ["userId"]),

  // Skenario trip tersimpan per akun (multi-trip).
  tripScenarios: defineTable({
    userId: v.string(),
    id: v.string(),
    slug: v.string(),
    name: v.string(),
    state: v.any(),
    version: v.number(),
  }).index("by_user", ["userId"]).index("by_user_slug", ["userId", "slug"]),
});
