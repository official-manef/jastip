<script lang="ts">
  import { onMount } from "svelte";
  import { kg } from "../../lib/titip/model";
  import { authedFetch, loadMe, session } from "../../lib/titip/session.svelte";
  import { ARAH, arahLabel, isArah, STATUSES, statusLabel, type TitipanRow, type TitipanStatus } from "../../lib/titip/titipan";

  const field = "field";

  let rows = $state<TitipanRow[]>([]);
  let loading = $state(true);
  let carriers = $state<{ id: string; name: string; email: string; role: string | null }[]>([]);
  let updating = $state<string | null>(null);
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
      if (session.role === "admin") {
        const people = await authedFetch("/api/admin");
        if (!people.ok) throw new Error("Daftar jastiper belum terbaca");
        carriers = ((await people.json()).people ?? []).filter((person: { role: string | null }) => person.role === "jastiper");
      }
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
    if (updating) return;
    updating = id;
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
    } finally {
      updating = null;
    }
  }
  async function tugaskan(id: string, jastiperId: string) {
    if (updating) return;
    updating = id;
    notice = "";
    try {
      const res = await authedFetch("/api/titipan", {
        method: "PATCH", body: JSON.stringify({ id, jastiperId: jastiperId || null }),
      });
      if (!res.ok) throw new Error("assign");
      await muat();
    } catch {
      notice = "Penugasan belum berubah. Coba muat ulang.";
    } finally {
      updating = null;
    }
  }
</script>

<svelte:head><title>Titipan — Titipin</title></svelte:head>

<section>
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
      <h1>{session.role === "klien" ? "Titipanmu" : session.role === "jastiper" ? "Titipan tugasmu" : "Semua titipan"}</h1>
      <p class="mt-4 text-lead">
        {#if session.role === "klien"}
          Catat barang yang mau dibawa. Jastiper yang mengubah status.
        {:else if session.role === "jastiper"}
          Hanya titipan yang ditugaskan operator kepadamu. Tandai saat barang dibawa atau selesai.
        {:else}
          Tugaskan titipan ke jastiper. Jastiper lain tidak dapat melihat atau mengubahnya.
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
      <p class="panel mt-6 p-6 text-body text-muted">{session.role === "jastiper" ? "Belum ada titipan yang ditugaskan kepadamu." : "Belum ada titipan."}</p>
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
            {#if session.role === "admin"}
              <label class="mt-4 block">
                <span class="mb-2 block text-small text-muted">Jastiper untuk {row.nama}</span>
                <select class={field} value={row.jastiperId ?? ""} disabled={updating !== null}
                  onchange={(event) => tugaskan(row.id, event.currentTarget.value)}>
                  <option value="">Belum ditugaskan</option>
                  {#each carriers as person (person.id)}
                    <option value={person.id}>{person.name || person.email}</option>
                  {/each}
                </select>
              </label>
            {/if}
            {#if canCarry}
              <div class="mt-4 flex flex-wrap gap-1" role="group" aria-label="Status {row.nama}">
                {#each STATUSES as item (item.id)}
                  <button
                    type="button"
                    disabled={updating !== null}
                    aria-pressed={row.status === item.id}
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
      <!-- F14: tujuan harus beda dari halaman ini. Klien rumahnya /titip, jadi
           "Kembali" ke rumah hanya no-op. Arahkan ke kalkulator. -->
      <a class="link" href="/meja">Buka kalkulator</a>
    </p>
  {/if}
</section>
