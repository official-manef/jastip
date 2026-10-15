import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL ?? "http://localhost:8080";
const devOrigins = ["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080"];

/** Component client: adapter DB + helper user untuk fungsi Convex lain. */
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    trustedOrigins: [siteUrl, ...devOrigins],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    // Plugin Convex wajib: menyediakan endpoint /convex/token & jwks.
    plugins: [convex({ authConfig })],
  });
