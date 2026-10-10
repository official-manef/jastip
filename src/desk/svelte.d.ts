declare module "*.svelte" {
  import type { Component } from "svelte";
  const component: Component<Record<string, never>>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}