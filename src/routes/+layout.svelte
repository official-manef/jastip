<script lang="ts">
  import { onMount } from "svelte";
  import Dock from "../lib/titip/Dock.svelte";
  import Sidebar from "../lib/titip/Sidebar.svelte";
  import UpdateToast from "../lib/titip/UpdateToast.svelte";
  import { initLoopPause, initReveal } from "../lib/titip/motion";
  import { loadMe } from "../lib/titip/session.svelte";
  import "../styles.css";

  let { children } = $props();

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
  <title>Titipin. Kalkulator bagasi Jakarta ↔ Turki</title>
  <meta
    name="description"
    content="Titipin. Kalkulator bagasi jastip Jakarta ↔ Turki. Pergi saja atau pulang-pergi."
  />
</svelte:head>

<div class="flex min-h-dvh">
  <Sidebar />
  <div class="flex min-w-0 flex-1 flex-col">
    <main class="w-full flex-1 px-4 pt-4 pb-16 lg:px-10 lg:pt-8">
      <div class="w-full max-w-[52rem]">
        {@render children()}
      </div>
    </main>

    <footer class="border-0 px-4 pb-10 lg:px-10 lg:pb-14">
      <div
        class="grid w-full max-w-[52rem] gap-3 text-small text-muted sm:grid-cols-[1fr_auto_1fr] sm:items-baseline sm:gap-6"
      >
        <p class="max-w-none">
          Titipin. Hitung bagasi, tarif, dan laba satu trip.
        </p>
        <nav class="flex flex-wrap gap-6" aria-label="Tautan kaki">
          <a class="link text-fg" href="/">Meja</a>
          <a class="link text-fg" href="/portal">Portal contoh</a>
          <a class="link text-fg" href="/masuk">Masuk</a>
        </nav>
        <p class="max-w-none sm:text-right">
          Foto rute: Wikimedia Commons, CC BY-SA (Jwslubbock, Gunawan Kartapranata, Moonik,
          Davidelit, Kurmanbek). Angka awal = contoh.
        </p>
      </div>
    </footer>
  </div>
</div>

<Dock />
<UpdateToast />
