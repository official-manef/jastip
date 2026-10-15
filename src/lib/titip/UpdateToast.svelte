<script lang="ts">
  /**
   * Toast "versi baru tersedia" + status offline. Muncul sebagai overlay
   * (fixed), jadi boleh punya latar solid; tanpa blur.
   */
  import { onMount } from "svelte";

  let waiting = $state<ServiceWorker | null>(null);
  let reloading = $state(false);
  let offline = $state(false);

  onMount(() => {
    if (!("serviceWorker" in navigator)) return;

    const update = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) waiting = reg.waiting;
      });
    };
    update();

    const onController = () => {
      if (reloading) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);

    const onOnline = () => (offline = false);
    const onOffline = () => (offline = true);
    offline = navigator.onLine === false;
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const reg = navigator.serviceWorker.ready;
    reg.then((r) => r.addEventListener("updatefound", update));

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  });

  function applyUpdate() {
    if (!waiting) return;
    reloading = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }
</script>

{#if offline}
  <p class="fixed inset-x-4 bottom-4 z-50 rounded bg-fg px-4 py-3 text-body text-bg" role="status">
    Mode offline. Perubahan tetap tersimpan di perangkat.
  </p>
{/if}

{#if waiting}
  <div class="fixed inset-x-4 bottom-4 z-50 flex flex-wrap items-center justify-between gap-3 rounded bg-fg px-4 py-3 text-bg" role="status">
    <span class="text-body">Versi baru tersedia.</span>
    <button type="button" class="btn px-4" disabled={reloading} onclick={applyUpdate}>
      {reloading ? "Memuat…" : "Muat ulang"}
    </button>
  </div>
{/if}
