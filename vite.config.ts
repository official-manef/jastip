import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import adapter from "@sveltejs/adapter-vercel";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/** App routes that must hit SvelteKit, not the Convex backend. */
function bypassLocalApi(req: { url?: string }): string | undefined {
  const path = (req.url ?? "").split("?", 1)[0] ?? "";
  const local =
    path === "/api/ai" ||
    path === "/api/trip" ||
    path === "/api/auth" ||
    path.startsWith("/api/auth/") ||
    path === "/api/saya" ||
    path.startsWith("/api/saya/") ||
    path === "/api/peran" ||
    path.startsWith("/api/peran/") ||
    path === "/api/titipan" ||
    path.startsWith("/api/titipan/") ||
    path === "/api/admin" ||
    path.startsWith("/api/admin/");
  return local ? req.url : undefined;
}

const convexProxy = {
  "/api": {
    target: "http://127.0.0.1:3210",
    changeOrigin: true,
    ws: true,
    bypass: bypassLocalApi,
  },
};

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
export default defineConfig(async () => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    proxy: convexProxy,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
    proxy: convexProxy,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    tailwindcss(),
    ...(await sveltekit({
      adapter: adapter({ runtime: "bun1.x" }),
      preprocess: vitePreprocess(),
      // Static assets live in `public/` (not SvelteKit's default `static/`).
      files: { assets: "public" },
    })),
  ],
}));
