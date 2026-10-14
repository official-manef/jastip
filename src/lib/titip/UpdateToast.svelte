<script lang="ts">
  /**
   * Toast "versi baru tersedia". Muncul saat service worker baru terpasang dan
   * menunggu. Menekan tombol mengirim SKIP_WAITING, lalu reload sekali setelah
   * SW mengambil alih — membersihkan cache lama tanpa memaksa reload diam-diam.
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

    // SW baru selesai install (halaman mungkin perlu di-reload agar terlihat).
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
  <div class="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6" role="status">
    <p class="rounded-full bg-fg px-4 py-2 text-sm text-bg shadow-ticket">Mode offline — perubahan tetap tersimpan di perangkat.</p>
  </div>
{/if}

{#if waiting}
  <div class="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
    <div class="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 shadow-ticket" role="status">
      <span class="text-sm">Versi baru tersedia.</span>
      <button
        type="button"
        class="min-h-9 rounded-full bg-primary px-3 text-sm font-medium text-primary-fg"
        disabled={reloading}
        onclick={applyUpdate}
      >
        {reloading ? "Memuat…" : "Muat ulang"}
      </button>
    </div>
  </div>
{/if}
