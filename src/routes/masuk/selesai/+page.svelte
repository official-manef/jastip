<script lang="ts">
  import { onMount } from "svelte";
  import { homeFor, isRole } from "../../../lib/titip/roles";
  import { authedFetch, PENDING_ROLE_KEY, refreshMe, session } from "../../../lib/titip/session.svelte";

  let notice = $state("Menyimpan peran…");

  onMount(() => {
    void (async () => {
      await refreshMe();
      if (!session.user) {
        window.location.assign("/masuk");
        return;
      }
      if (session.role) {
        window.location.assign(homeFor(session.role));
        return;
      }
      const pending = sessionStorage.getItem(PENDING_ROLE_KEY);
      sessionStorage.removeItem(PENDING_ROLE_KEY);
      if (!isRole(pending)) {
        window.location.assign("/masuk");
        return;
      }
      try {
        const res = await authedFetch("/api/peran", {
          method: "POST",
          body: JSON.stringify({ role: pending }),
        });
        const data = (await res.json()) as { role?: unknown; error?: string };
        if (data.error === "admin-forbidden") {
          notice = "Akun ini belum ditetapkan sebagai admin. Pilih klien atau jastiper.";
          return;
        }
        if (data.error === "admin-taken") {
          notice = "Peran admin sudah diambil. Pilih klien atau jastiper.";
          return;
        }
        if (!res.ok || !isRole(data.role)) {
          notice = "Peran belum tersimpan. Coba lagi dari halaman masuk.";
          return;
        }
        window.location.assign(homeFor(data.role));
      } catch {
        notice = "Peran belum tersimpan. Coba lagi dari halaman masuk.";
      }
    })();
  });
</script>

<section class="mx-auto max-w-lg">
  <p class="text-sm font-medium tracking-wide text-primary uppercase">Akun</p>
  <h1 class="mt-1 font-display text-4xl italic">Hampir selesai</h1>
  <p class="mt-3 text-muted" role="status">{notice}</p>
  {#if notice !== "Menyimpan peran…"}
    <a href="/masuk" class="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg">Pilih lagi</a>
  {/if}
</section>
