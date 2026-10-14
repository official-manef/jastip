<script lang="ts">
  import { onMount } from "svelte";
  import Dock from "../lib/titip/Dock.svelte";
  import Sidebar from "../lib/titip/Sidebar.svelte";
  import { loadMe } from "../lib/titip/session.svelte";
  import "../styles.css";

  let { children } = $props();

  onMount(() => {
    void loadMe();
    // Register the app's own service worker (offline shell + installable PWA).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  });
</script>

<svelte:head>
  <title>Titipin — Jakarta ↔ Turki</title>
  <meta
    name="description"
    content="Titipin — kalkulator bagasi jastip Jakarta ↔ Turki. Pergi saja atau pulang-pergi."
  />
</svelte:head>

<div class="flex min-h-screen">
  <Sidebar />
  <div class="flex min-w-0 flex-1 flex-col">
    <!-- Bottom padding clears the mobile dock; removed at `lg` where the dock hides. -->
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 lg:pb-10">
      {@render children()}
    </main>
  </div>
</div>

<Dock />
