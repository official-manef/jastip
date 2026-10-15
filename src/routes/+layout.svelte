<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import Dock from "../lib/titip/Dock.svelte";
  import Sidebar from "../lib/titip/Sidebar.svelte";
  import UpdateToast from "../lib/titip/UpdateToast.svelte";
  import { initLoopPause, initReveal } from "../lib/titip/motion";
  import { loadMe } from "../lib/titip/session.svelte";
  import { createSvelteAuthClient } from "@mmailaender/convex-better-auth-svelte/svelte";
  import { authClient } from "../lib/auth/client";
  import { convexUrl } from "../lib/convex-url";
  import "../styles.css";

  // Wire Better Auth <-> Convex client (setAuth) sekali per app.
  createSvelteAuthClient({ authClient, convexUrl });

  let { children } = $props();

  /**
   * Two shells, one layout:
   * - App shell (sidebar + full-width working area) for the tool pages.
   * - Public shell (no sidebar, centred column, whole viewport) for the
   *   landing page and sign-in.
   */
  const APP_PREFIXES = ["/meja", "/portal", "/titip", "/asisten", "/pengaturan", "/admin"];
  const path = $derived(page.url.pathname);
  const isApp = $derived(APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)));

  onMount(() => {
    void loadMe();
    const stopReveal = initReveal();
    const stopPause = initLoopPause();
    // Register the app's own service worker (offline shell + installable PWA).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    }
    return () => {
      stopReveal();
      stopPause();
    };
  });
</script>

<svelte:head>
  <title>Titipin. Kalkulator bagasi & laba jastip multi-negara</title>
  <meta
    name="description"
    content="Titipin. Kalkulator bagasi jastip multi-negara: susun rute berkaki, isi muatan tiap kaki, lihat laba. Daftar gratis untuk menyimpan trip di cloud."
  />
</svelte:head>

{#if isApp}
  <!-- Dua area scroll: rail setinggi layar, kolom konten scroll sendiri (F01). -->
  <div class="flex h-dvh overflow-hidden">
    <Sidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Header mobile di ATAS konten, sebelum main (F02). -->
      <Dock />
      <div class="flex-1 overflow-y-auto" id="konten-app">
        <main class="w-full px-4 py-6 lg:px-10 lg:py-10">
          <div class="mx-auto w-full max-w-[68rem]">
            {@render children()}
          </div>
        </main>

        <footer class="px-4 pb-10 lg:px-10 lg:pb-14">
          <div
            class="mx-auto grid w-full max-w-[68rem] gap-3 text-small text-muted sm:grid-cols-[1fr_auto_1fr] sm:items-baseline sm:gap-6"
          >
            <p class="max-w-none">Titipin. Hitung bagasi, tarif, dan laba satu trip.</p>
            <nav class="flex flex-wrap gap-6" aria-label="Tautan kaki">
              <a class="link text-fg" href="/meja">Meja</a>
              <a class="link text-fg" href="/portal">Portal</a>
              <a class="link text-fg" href="/">Beranda</a>
            </nav>
            <p class="max-w-none sm:text-right">Angka awal = contoh.</p>
          </div>
        </footer>
      </div>
    </div>
  </div>
{:else}
  <div class="flex min-h-dvh flex-col">
    <header class="flex items-center justify-between px-6 py-5 sm:px-10">
      <a href="/" class="font-display text-xl font-medium leading-none tracking-tight">titipin</a>
      <a class="link text-small text-fg" href="/masuk">Masuk</a>
    </header>

    <main class="grid w-full flex-1 place-items-center px-6 py-8 sm:px-10">
      <div class="w-full max-w-[46rem]">
        {@render children()}
      </div>
    </main>

    <footer class="px-6 pb-8 sm:px-10">
      <div
        class="mx-auto flex w-full max-w-[46rem] flex-wrap items-baseline justify-between gap-3 text-small text-muted"
      >
        <p class="max-w-none">
          Titipin. Rute berkaki, sepuluh negara.
        </p>
        <p class="max-w-none">
          Foto rute: Wikimedia Commons, CC BY-SA
          (<a class="link text-fg" href="https://commons.wikimedia.org/w/index.php?curid=84394752">Jwslubbock</a>,
          <a class="link text-fg" href="https://commons.wikimedia.org/w/index.php?curid=23174064">Moonik</a>,
          <a class="link text-fg" href="https://commons.wikimedia.org/w/index.php?curid=70870213">Gunawan Kartapranata</a>,
          <a class="link text-fg" href="https://commons.wikimedia.org/w/index.php?curid=58065331">Davidelit</a>,
          <a class="link text-fg" href="https://commons.wikimedia.org/wiki/File:A_ferry_in_the_Bosphorus_20251015.webm">Kurmanbek</a>).
        </p>
      </div>
    </footer>
  </div>
{/if}

<UpdateToast />
