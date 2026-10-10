<script lang="ts">
  import { browser } from "$app/env";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { setupConvex } from "convex-svelte";
  import Akun from "../lib/titip/Akun.svelte";
  import { session, loadMe } from "../lib/titip/session.svelte";
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

  onMount(() => {
    void loadMe();
    return installPreviewHostBridge({
      navigate: (path) => history.pushState({}, "", path),
      getRoutePaths: () => ["/", "/portal", "/masuk", "/titip", "/admin"],
    });
  });

  const links = $derived.by(() => {
    const items = [
      { href: "/portal", label: "Portal" },
      { href: "/", label: "Meja" },
    ];
    if (session.role) items.push({ href: "/titip", label: "Titipan" });
    if (session.role === "admin") items.push({ href: "/admin", label: "Orang" });
    return items;
  });

  function active(href: string) {
    const path = page.url.pathname;
    return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
  }
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
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <a href="/" class="flex min-w-0 items-center gap-2">
        <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-lg italic leading-none text-primary-fg">t</span>
        <span class="truncate font-display text-2xl italic leading-none tracking-tight">titipin</span>
      </a>
      <nav class="order-3 flex w-full gap-1 sm:order-none sm:w-auto" aria-label="Utama">
        {#each links as link (link.href)}
          <a
            href={link.href}
            aria-current={active(link.href) ? "page" : undefined}
            class="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium {active(link.href) ? 'bg-primary text-primary-fg' : 'text-muted'}"
          >
            {link.label}
          </a>
        {/each}
      </nav>
      <div class="ml-auto">
        <Akun />
      </div>
    </div>
  </header>
  <main class="mx-auto max-w-6xl px-4 pt-4 pb-10">
    {@render children()}
  </main>
</div>
