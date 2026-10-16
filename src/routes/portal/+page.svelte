<script lang="ts">
  import { onMount } from "svelte";
  import { idr, kg } from "../../lib/titip/model";
  import { PORTAL_MASUK, salinOrang, salinTitipan, type ContohOrang, type ContohTitipan } from "../../lib/titip/contoh";
  import Ringkas from "../../lib/titip/Ringkas.svelte";
  import { roleLabel } from "../../lib/titip/roles";
  import { ARAH, arahLabel, STATUSES, statusLabel, type Arah, type TitipanStatus } from "../../lib/titip/titipan";
  import { desk, initDesk } from "../../lib/titip/trip-store.svelte";
  import { computeRevenue, tripLintas } from "../../lib/titip/pricing";
  const field = "field";

  let orang = $state<ContohOrang[]>(salinOrang());
  let rows = $state<ContohTitipan[]>(salinTitipan());
  let siapa = $state<(typeof PORTAL_MASUK)[number]>("sari");
  let notice = $state("");
  let nama = $state("");
  let berat = $state("0,5");
  let catatan = $state("");
  let arah = $state<Arah>("cgk-ist");

  // F10: kartu jastiper memakai state trip aktif yang sama dengan kalkulator,
  // bukan skenario contoh statis. Tidak ada lagi dua angka berbeda di layar.
  onMount(() => { initDesk(); });

  const lintas = $derived(tripLintas(desk.kaki.map((k) => ({
    id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario,
  }))));
  const bebanTrip = $derived(desk.kaki.reduce((sum, k) => {
    const opex = k.scenario.opex.reduce((a, l) => a + l.amount, 0);
    const capex = k.scenario.capex.reduce((a, l) => a + l.price / Math.max(1, l.trips), 0);
    return sum + Math.round(opex + capex);
  }, 0));
  const labaTrip = $derived(Math.round(lintas.service - bebanTrip));
  /** Sisa kuota tahap paling ketat, sama seperti instrumen di kalkulator. */
  const sisaAktif = $derived.by(() => {
    if (desk.kaki.length === 0) return 0;
    const idx = Math.min(desk.aktif, desk.kaki.length - 1);
    const k = desk.kaki[idx];
    const rev = computeRevenue(k.scenario.goods, k.scenario.hargaPerKg, k.scenario.hargaCurrency ?? "IDR");
    const bersih = Math.max(0, k.scenario.bags * k.scenario.kgPerBag + k.scenario.cabin - k.scenario.tare);
    return Math.round((bersih - rev.totalKg) * 10) / 10;
  });

  const aku = $derived(orang.find((item) => item.id === siapa) ?? orang[0]);
  const milikku = $derived(rows.filter((row) => row.orangId === aku.id));
  const antrian = $derived(rows.filter((row) => row.status !== "selesai"));
  const kgSaya = $derived(milikku.reduce((sum, row) => sum + row.kg, 0));
  /** Jastiper contoh yang bisa ditemui klien (saling menemukan). */
  const jastiper = $derived(orang.filter((item) => item.role === "jastiper"));

  function namaOrang(id: string) {
    return orang.find((item) => item.id === id)?.name ?? "—";
  }

  function pilih(id: (typeof PORTAL_MASUK)[number]) {
    siapa = id;
    notice = "";
  }

  /** F15: roving tabindex untuk tablist — ArrowLeft/Right/Home/End memindah tab. */
  function tabKey(event: KeyboardEvent, index: number) {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const last = PORTAL_MASUK.length - 1;
    const next = event.key === "Home" ? 0
      : event.key === "End" ? last
      : event.key === "ArrowRight" ? (index + 1 > last ? 0 : index + 1)
      : (index - 1 < 0 ? last : index - 1);
    pilih(PORTAL_MASUK[next]);
    const el = document.getElementById(`tab-${PORTAL_MASUK[next]}`);
    el?.focus();
  }

  function ubahStatus(id: string, status: TitipanStatus) {
    rows = rows.map((row) => (row.id === id ? { ...row, status } : row));
  }

  function tambah(event: SubmitEvent) {
    event.preventDefault();
    const n = Number(berat.trim().replace(",", "."));
    if (!nama.trim()) {
      notice = "Isi nama barang.";
      return;
    }
    if (!Number.isFinite(n) || n <= 0 || n > 40) {
      notice = "Berat antara 0 dan 40 kg.";
      return;
    }
    rows = [
      {
        id: crypto.randomUUID(),
        orangId: aku.id,
        arah,
        nama: nama.trim(),
        kg: n,
        catatan: catatan.trim(),
        status: "baru",
      },
      ...rows,
    ];
    nama = "";
    catatan = "";
    notice = "Masuk ke daftar contoh. Tidak tersimpan.";
  }
</script>

<svelte:head><title>Portal contoh — Titipin</title></svelte:head>

<section>
  <header class="max-w-[40rem]" data-rise style="--i: 0">
    <h1>Dua sisi, satu rute</h1>
    <p class="mt-4 text-lead">
      Dashboard contoh supaya alur terlihat tanpa akun sungguhan. Semua nama dan angka di halaman ini pura-pura.
    </p>
    <p class="mt-2 text-small text-muted">Tidak masuk akun mana pun dan hilang kalau halaman dimuat ulang.</p>
    <div class="mt-6" data-reveal>
      <Ringkas />
    </div>
  </header>

  <div class="mt-8 flex flex-wrap gap-1 rounded bg-surface p-1" role="tablist" aria-label="Masuk sebagai contoh" data-reveal>
    {#each PORTAL_MASUK as id, i (id)}
      {@const orangIni = orang.find((item) => item.id === id)}
      <button
        type="button"
        id={`tab-${id}`}
        role="tab"
        aria-selected={siapa === id}
        aria-controls="panel-peran"
        tabindex={siapa === id ? 0 : -1}
        class="min-h-11 rounded px-4 text-left text-body {siapa === id ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-field'}"
        onclick={() => pilih(id)}
        onkeydown={(event) => tabKey(event, i)}
      >
        <span class="block">{orangIni?.name}</span>
        <span class="block text-small {siapa === id ? 'text-primary-fg/80' : 'text-muted'}">{roleLabel(orangIni?.role ?? null)} · {orangIni?.city}</span>
      </button>
    {/each}
  </div>

  {#if notice}
    <p class="mt-4 text-body text-accent" role="status">{notice}</p>
  {/if}

  <div id="panel-peran" role="tabpanel" aria-labelledby={`tab-${siapa}`}>
  {#if aku.role === "klien"}
    <dl class="mt-8 grid gap-3 sm:grid-cols-3">
      <div class="panel p-4">
        <dt class="text-small text-muted">Titipan saya</dt>
        <dd class="num mt-1 text-lead">{milikku.length}</dd>
      </div>
      <div class="panel p-4">
        <dt class="text-small text-muted">Berat</dt>
        <dd class="num mt-1 text-lead">{kg(kgSaya)}</dd>
      </div>
      <div class="panel p-4">
        <dt class="text-small text-muted">Masih jalan</dt>
        <dd class="num mt-1 text-lead">{milikku.filter((row) => row.status !== "selesai").length}</dd>
      </div>
    </dl>

    <!-- Klien melihat jastiper yang bisa membawa (saling menemukan). -->
    {#if jastiper.length}
      <div class="panel mt-4 p-4" data-reveal>
        <p class="text-body">Jastiper yang bisa membawa</p>
        <ul class="mt-3 flex flex-col gap-2">
          {#each jastiper as item (item.id)}
            <li class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="text-body">{item.name}</span>
              <span class="text-small text-muted">{item.city} · {arahLabel("cgk-ist")}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <form class="panel mt-4 grid gap-3 p-4 sm:grid-cols-2" onsubmit={tambah}>
      <label class="block sm:col-span-2">
        <span class="mb-2 block text-small text-muted">Arah</span>
        <select class={field} bind:value={arah}>
          {#each ARAH as item (item.id)}
            <option value={item.id}>{item.label}</option>
          {/each}
        </select>
      </label>
      <label class="block">
        <span class="mb-2 block text-small text-muted">Barang</span>
        <input class={field} bind:value={nama} placeholder="Nama barang" />
      </label>
      <label class="block">
        <span class="mb-2 block text-small text-muted">Kg</span>
        <input class="{field} num" bind:value={berat} inputmode="decimal" />
      </label>
      <label class="block sm:col-span-2">
        <span class="mb-2 block text-small text-muted">Catatan</span>
        <input class={field} bind:value={catatan} placeholder="Opsional" />
      </label>
      <button type="submit" class="btn sm:col-span-2">Tambah contoh</button>
    </form>

    <ul class="mt-4 flex flex-col gap-2">
      {#each milikku as row (row.id)}
        <li class="panel flex flex-wrap items-baseline justify-between gap-2 p-4">
          <div>
            <p class="text-body">{row.nama}</p>
            <p class="text-small text-muted">{arahLabel(row.arah)}{row.catatan ? ` · ${row.catatan}` : ""}</p>
          </div>
          <p class="num text-small">{kg(row.kg)} · {statusLabel(row.status)}</p>
        </li>
      {:else}
        <li class="panel p-6 text-body text-muted">Belum ada titipan.</li>
      {/each}
    </ul>
  {:else if aku.role === "jastiper"}
    <dl class="mt-8 grid gap-3 sm:grid-cols-3">
      <div class="panel p-4">
        <dt class="text-small text-muted">Sisa bagasi</dt>
        <dd class="num mt-1 text-lead">{kg(sisaAktif)}</dd>
      </div>
      <div class="panel p-4">
        <dt class="text-small text-muted">Laba trip (kalkulator)</dt>
        <dd class="num mt-1 text-lead {labaTrip < 0 ? 'text-accent' : ''}">{idr(labaTrip)}</dd>
      </div>
      <div class="panel p-4">
        <dt class="text-small text-muted">Antrian</dt>
        <dd class="num mt-1 text-lead">{antrian.length}</dd>
      </div>
    </dl>
    <p class="mt-3 text-body text-muted">Angka mengikuti kalkulator saat ini ({desk.kaki.length} tahap). <a class="link" href="/meja">Buka kalkulator</a>.</p>

    <ul class="mt-5 flex flex-col gap-3">
      {#each rows as row (row.id)}
        <li class="panel p-4">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="text-body">{row.nama}</p>
            <p class="num text-small text-muted">{kg(row.kg)}</p>
          </div>
          <p class="mt-1 text-small text-muted">{namaOrang(row.orangId)} · {arahLabel(row.arah)}</p>
          <div class="mt-3 flex flex-wrap gap-1" role="group" aria-label="Status {row.nama}">
            {#each STATUSES as item (item.id)}
              <button
                type="button"
                aria-pressed={row.status === item.id}
                class="min-h-11 rounded px-3 text-body {row.status === item.id ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-field'}"
                onclick={() => ubahStatus(row.id, item.id)}
              >
                {item.label}
              </button>
            {/each}
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <dl class="mt-8 grid gap-3 sm:grid-cols-3">
      <div class="panel p-4">
        <dt class="text-small text-muted">Orang</dt>
        <dd class="num mt-1 text-lead">{orang.length}</dd>
      </div>
      <div class="panel p-4">
        <dt class="text-small text-muted">Jastiper</dt>
        <dd class="num mt-1 text-lead">{orang.filter((item) => item.role === "jastiper").length}</dd>
      </div>
      <div class="panel p-4">
        <dt class="text-small text-muted">Titipan</dt>
        <dd class="num mt-1 text-lead">{rows.length}</dd>
      </div>
    </dl>

    <ul class="mt-5 flex flex-col gap-3">
      {#each orang as item (item.id)}
        <li class="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p class="text-body">{item.name}</p>
            <p class="text-small text-muted">{item.email} · {item.city}</p>
          </div>
          <span class="rounded bg-surface px-3 py-1.5 text-small">{roleLabel(item.role)}</span>
        </li>
      {/each}
    </ul>
  {/if}
  </div>
</section>
