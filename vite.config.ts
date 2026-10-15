import type { Plugin } from "vite";
import { defineConfig } from "vite";
import adapter from "@sveltejs/adapter-vercel";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

/** App routes that must hit SvelteKit, not the Convex backend. */
function bypassLocalApi(req: { url?: string }): string | undefined {
  const path = (req.url ?? "").split("?", 1)[0] ?? "";
  const local =
    path === "/api/ai" ||
    path.startsWith("/api/ai/") ||
    path === "/api/trip" ||
    path.startsWith("/api/trip/") ||
    path === "/api/trips" ||
    path.startsWith("/api/trips/") ||
    path === "/api/readiness" ||
    path.startsWith("/api/readiness/") ||
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

// A no-op plugin kept as the array's first element; the app needs no Vite-time
// side effects now that auth + data live in Convex.
const appBuilderPlugin = (): Plugin => ({ name: "app-builder:noop" });

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
  // Ekspos `PUBLIC_*` (mis. PUBLIC_CONVEX_URL) ke `import.meta.env` di klien.
  envPrefix: ["VITE_", "PUBLIC_"],
  plugins: [
    appBuilderPlugin(),
    tailwindcss(),
    ...(await sveltekit({
      adapter: adapter({ runtime: "bun1.x" }),
      preprocess: vitePreprocess(),
      // Static assets live in `public/` (not SvelteKit's default `static/`).
      files: { assets: "public" },
    })),
  ],
}));
