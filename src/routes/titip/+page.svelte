<script lang="ts">
  import { onMount } from "svelte";
  import { kg } from "../../lib/titip/model";
  import { homeFor } from "../../lib/titip/roles";
  import { authedFetch, loadMe, session } from "../../lib/titip/session.svelte";
  import { ARAH, arahLabel, isArah, STATUSES, statusLabel, type TitipanRow, type TitipanStatus } from "../../lib/titip/titipan";

  const field = "min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none placeholder:text-muted";

  let rows = $state<TitipanRow[]>([]);
  let loading = $state(true);
  let notice = $state("");
  let arah = $state<(typeof ARAH)[number]["id"]>("cgk-ist");
  let nama = $state("");
  let berat = $state("0,5");
  let catatan = $state("");
  let busy = $state(false);

  const canAsk = $derived(session.role === "klien" || session.role === "admin");
  const canCarry = $derived(session.role === "jastiper" || session.role === "admin");

  async function muat() {
    loading = true;
    notice = "";
    try {
      const res = await authedFetch("/api/titipan");
      if (res.status === 401) {
        rows = [];
        return;
      }
      const data = (await res.json()) as { rows?: TitipanRow[]; error?: string };
      if (!res.ok) {
        notice = data.error === "peran" ? "Pilih peran dulu." : "Titipan belum terbaca.";
        rows = [];
        return;
      }
      rows = data.rows ?? [];
    } catch {
      notice = "Titipan belum terbaca.";
      rows = [];
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void (async () => {
      await loadMe();
      if (session.user && session.role) await muat();
      else loading = false;
    })();
  });

  function parseKg(raw: string): number {
    const n = Number(raw.trim().replace(",", "."));
    return Number.isFinite(n) ? n : Number.NaN;
  }

  async function kirim(event: SubmitEvent) {
    event.preventDefault();
    if (!canAsk || busy) return;
    const kgValue = parseKg(berat);
    if (!nama.trim()) {
      notice = "Isi nama barang.";
      return;
    }
    if (!Number.isFinite(kgValue) || kgValue <= 0 || kgValue > 40) {
      notice = "Berat antara 0 dan 40 kg.";
      return;
    }
    busy = true;
    notice = "";
    try {
      const res = await authedFetch("/api/titipan", {
        method: "POST",
        body: JSON.stringify({ arah, nama: nama.trim(), kg: kgValue, catatan: catatan.trim() }),
      });
      if (!res.ok) {
        notice = "Titipan belum terkirim.";
        busy = false;
        return;
      }
      nama = "";
      catatan = "";
      berat = "0,5";
      await muat();
    } catch {
      notice = "Titipan belum terkirim.";
    } finally {
      busy = false;
    }
  }

  async function ubah(id: string, status: TitipanStatus) {
    notice = "";
    const previous = rows;
    rows = rows.map((row) => (row.id === id ? { ...row, status } : row));
    try {
      const res = await authedFetch("/api/titipan", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        rows = previous;
        notice = "Status belum berubah.";
      }
    } catch {
      rows = previous;
      notice = "Status belum berubah.";
    }
  }
</script>

<section class="mx-auto max-w-3xl">
  {#if session.pending || loading}
    <div class="h-9 w-40 animate-pulse rounded-lg bg-line" aria-hidden="true"></div>
    <div class="mt-4 h-36 animate-pulse rounded-2xl bg-line" aria-hidden="true"></div>
    <p class="sr-only">Memuat titipan</p>
  {:else if !session.user}
    <h1 class="font-display text-4xl italic">Titipan</h1>
    <p class="mt-3 text-muted">Masuk dulu untuk menitip atau melihat permintaan.</p>
    <a href="/masuk" class="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg">Masuk</a>
  {:else if !session.role}
    <h1 class="font-display text-4xl italic">Titipan</h1>
    <p class="mt-3 text-muted">Pilih peran dulu. Klien menitip, jastiper yang membawa.</p>
    <a href="/masuk" class="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg">Pilih peran</a>
  {:else}
    <p class="text-sm font-medium tracking-wide text-primary uppercase">{session.role === "klien" ? "Permintaanmu" : "Semua titipan"}</p>
    <h1 class="mt-1 font-display text-4xl italic">Titipan</h1>
    <p class="mt-3 text-muted">
      {#if session.role === "klien"}
        Catat barang yang mau dibawa. Jastiper yang mengubah status.
      {:else if session.role === "jastiper"}
        Permintaan klien di rute Jakarta ↔ Turki. Tandai saat barang dibawa atau selesai.
      {:else}
        Kamu bisa menitip untuk uji, dan mengubah status seperti jastiper.
      {/if}
    </p>

    {#if canAsk}
      <form class="mt-6 rounded-2xl border border-border bg-surface p-4 shadow-ticket" onsubmit={kirim}>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1 block text-muted">Arah</span>
            <select class={field} bind:value={arah}>
              {#each ARAH as item (item.id)}
                <option value={item.id}>{item.label}</option>
              {/each}
            </select>
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-muted">Berat (kg)</span>
            <input class={field} inputmode="decimal" bind:value={berat} />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1 block text-muted">Barang</span>
            <input class={field} maxlength="80" placeholder="Misalnya krim wajah" bind:value={nama} />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1 block text-muted">Catatan</span>
            <input class={field} maxlength="240" placeholder="Opsional" bind:value={catatan} />
          </label>
        </div>
        <button type="submit" class="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg disabled:opacity-50" disabled={busy}>
          {busy ? "Mengirim…" : "Titip"}
        </button>
      </form>
    {/if}

    {#if notice}
      <p class="mt-4 text-sm text-accent" role="status">{notice}</p>
    {/if}

    {#if rows.length === 0}
      <p class="mt-6 rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">Belum ada titipan.</p>
    {:else}
      <ul class="mt-6 grid gap-3">
        {#each rows as row (row.id)}
          <li class="rounded-2xl border border-border bg-surface p-4 shadow-ticket">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="font-display text-2xl italic">{row.nama}</h2>
              <p class="text-sm text-muted">{kg(row.kg)}</p>
            </div>
            <p class="mt-1 text-sm text-muted">
              {isArah(row.arah) ? arahLabel(row.arah) : row.arah}
              {#if session.role !== "klien"}
                · {row.pemilik}
              {/if}
            </p>
            {#if row.catatan}
              <p class="mt-2 text-sm">{row.catatan}</p>
            {/if}
            {#if canCarry}
              <div class="mt-3 flex flex-wrap gap-1">
                {#each STATUSES as item (item.id)}
                  <button
                    type="button"
                    class="min-h-11 rounded-full px-3 text-sm {row.status === item.id ? 'bg-primary text-primary-fg' : 'text-muted'}"
                    onclick={() => ubah(row.id, item.id)}
                  >
                    {item.label}
                  </button>
                {/each}
              </div>
            {:else}
              <p class="mt-3 text-sm font-medium text-primary">{statusLabel(row.status)}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <p class="mt-6 text-sm text-muted">
      <a class="underline decoration-line underline-offset-4" href={homeFor(session.role)}>Kembali</a>
    </p>
  {/if}
</section>
