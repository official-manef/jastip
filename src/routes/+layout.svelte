<script lang="ts">
  import { browser } from "$app/env";
  import { onMount } from "svelte";
  import { setupConvex } from "convex-svelte";
  import { installPreviewHostBridge } from "../lib/preview-host-bridge";
  import "../styles.css";

  let { children } = $props();

  function convexUrl() {
    const configured = import.meta.env.PUBLIC_CONVEX_URL;
    if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured;
    return window.location.origin;
  }

  if (browser) setupConvex(convexUrl());
  else setupConvex("https://convex.invalid");

  onMount(() =>
    installPreviewHostBridge({
      navigate: (path) => history.pushState({}, "", path),
      getRoutePaths: () => ["/"],
    }),
  );
</script>

<svelte:head>
  <title>Titipin — Jakarta ↔ Turki</title>
  <meta
    name="description"
    content="Titipin — kalkulator bagasi jastip Jakarta ↔ Turki. Pergi saja atau pulang-pergi."
  />
</svelte:head>

<div class="min-h-screen">
  <header class="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
    <div class="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-3 px-4">
      <a href="/" class="flex min-w-0 items-center gap-2">
        <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-lg italic leading-none text-primary-fg">t</span>
        <span class="truncate font-display text-2xl italic leading-none tracking-tight">titipin</span>
      </a>
      <p class="text-sm text-muted">Satu rute · Jakarta ↔ Turki</p>
    </div>
  </header>
  <main class="mx-auto max-w-6xl px-4 pt-4 pb-10">
    {@render children()}
  </main>
</div>
