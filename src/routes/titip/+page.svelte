<script lang="ts">
  import { onMount } from "svelte";
  import { kg } from "../../lib/titip/model";
  import { homeFor } from "../../lib/titip/roles";
  import { authedFetch, loadMe, session } from "../../lib/titip/session.svelte";
  import { ARAH, arahLabel, isArah, STATUSES, statusLabel, type TitipanRow, type TitipanStatus } from "../../lib/titip/titipan";

  const field = "field";

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

<section class="max-w-[42rem]">
  {#if session.pending || loading}
    <p class="text-body text-muted" role="status">Memuat titipan…</p>
  {:else if !session.user}
    <h1>Titipan</h1>
    <p class="mt-4 text-lead">Masuk dulu untuk menitip atau melihat permintaan.</p>
    <a href="/masuk" class="btn mt-6">Masuk</a>
  {:else if !session.role}
    <h1>Titipan</h1>
    <p class="mt-4 text-lead">Pilih peran dulu. Klien menitip, jastiper yang membawa.</p>
    <a href="/masuk" class="btn mt-6">Pilih peran</a>
  {:else}
    <header class="max-w-[40rem]" data-rise style="--i: 0">
      <h1>{session.role === "klien" ? "Titipanmu" : "Semua titipan"}</h1>
      <p class="mt-4 text-lead">
        {#if session.role === "klien"}
          Catat barang yang mau dibawa. Jastiper yang mengubah status.
        {:else if session.role === "jastiper"}
          Permintaan klien di rute Jakarta ↔ Turki. Tandai saat barang dibawa atau selesai.
        {:else}
          Kamu bisa menitip untuk uji, dan mengubah status seperti jastiper.
        {/if}
      </p>
    </header>

    {#if canAsk}
      <form class="panel mt-8 grid gap-3 p-4 sm:grid-cols-2" onsubmit={kirim} data-reveal>
        <label class="block">
          <span class="mb-2 block text-small text-muted">Arah</span>
          <select class={field} bind:value={arah}>
            {#each ARAH as item (item.id)}
              <option value={item.id}>{item.label}</option>
            {/each}
          </select>
        </label>
        <label class="block">
          <span class="mb-2 block text-small text-muted">Berat (kg)</span>
          <input class="{field} num" inputmode="decimal" bind:value={berat} />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-2 block text-small text-muted">Barang</span>
          <input class={field} maxlength="80" placeholder="Misalnya krim wajah" bind:value={nama} />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-2 block text-small text-muted">Catatan</span>
          <input class={field} maxlength="240" placeholder="Opsional" bind:value={catatan} />
        </label>
        <button type="submit" class="btn disabled:opacity-50 sm:col-span-2" disabled={busy}>
          {busy ? "Mengirim…" : "Titip"}
        </button>
      </form>
    {/if}

    {#if notice}
      <p class="mt-4 text-body text-accent" role="status">{notice}</p>
    {/if}

    {#if rows.length === 0}
      <p class="panel mt-6 p-6 text-body text-muted">Belum ada titipan.</p>
    {:else}
      <ul class="mt-6 flex flex-col gap-3" data-reveal>
        {#each rows as row (row.id)}
          <li class="panel p-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="text-lead">{row.nama}</h2>
              <p class="num text-small text-muted">{kg(row.kg)}</p>
            </div>
            <p class="mt-1 text-small text-muted">
              {isArah(row.arah) ? arahLabel(row.arah) : row.arah}
              {#if session.role !== "klien"}
                · {row.pemilik}
              {/if}
            </p>
            {#if row.catatan}
              <p class="mt-2 text-body">{row.catatan}</p>
            {/if}
            {#if canCarry}
              <div class="mt-4 flex flex-wrap gap-1">
                {#each STATUSES as item (item.id)}
                  <button
                    type="button"
                    class="min-h-11 rounded px-3 text-body {row.status === item.id ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-field'}"
                    onclick={() => ubah(row.id, item.id)}
                  >
                    {item.label}
                  </button>
                {/each}
              </div>
            {:else}
              <p class="mt-4 text-body">{statusLabel(row.status)}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <p class="mt-8 text-body">
      <a class="link" href={homeFor(session.role)}>Kembali</a>
    </p>
  {/if}
</section>
