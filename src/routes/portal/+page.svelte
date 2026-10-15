<script lang="ts">
  import { idr, kg } from "../../lib/titip/model";
  import { contohTrip, PORTAL_MASUK, salinOrang, salinTitipan, type ContohOrang, type ContohTitipan } from "../../lib/titip/contoh";
  import Ringkas from "../../lib/titip/Ringkas.svelte";
  import { roleLabel, type Role } from "../../lib/titip/roles";
  import { ARAH, arahLabel, STATUSES, statusLabel, type Arah, type TitipanStatus } from "../../lib/titip/titipan";

  const field = "field";
  const trip = contohTrip();

  let orang = $state<ContohOrang[]>(salinOrang());
  let rows = $state<ContohTitipan[]>(salinTitipan());
  let siapa = $state<(typeof PORTAL_MASUK)[number]>("sari");
  let notice = $state("");
  let nama = $state("");
  let berat = $state("0,5");
  let catatan = $state("");
  let arah = $state<Arah>("cgk-ist");

  const aku = $derived(orang.find((item) => item.id === siapa) ?? orang[0]);
  const milikku = $derived(rows.filter((row) => row.orangId === aku.id));
  const antrian = $derived(rows.filter((row) => row.status !== "selesai"));
  const kgSaya = $derived(milikku.reduce((sum, row) => sum + row.kg, 0));
  const adminCount = $derived(orang.filter((item) => item.role === "admin").length);

  function namaOrang(id: string) {
    return orang.find((item) => item.id === id)?.name ?? "—";
  }

  function pilih(id: (typeof PORTAL_MASUK)[number]) {
    siapa = id;
    notice = "";
  }

  function ubahStatus(id: string, status: TitipanStatus) {
    rows = rows.map((row) => (row.id === id ? { ...row, status } : row));
  }

  function ubahPeran(id: string, role: Role) {
    const target = orang.find((item) => item.id === id);
    if (!target) return;
    if (role === "admin" && target.role !== "admin") {
      notice = "Hanya satu admin.";
      return;
    }
    if (target.role === "admin" && role !== "admin" && adminCount <= 1) {
      notice = "Admin terakhir tidak bisa diturunkan.";
      return;
    }
    notice = "";
    orang = orang.map((item) => (item.id === id ? { ...item, role } : item));
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

<section>
  <header class="max-w-[40rem]" data-rise style="--i: 0">
    <h1>Tiga meja, satu rute</h1>
    <p class="mt-4 text-lead">
      Dashboard contoh supaya alur terlihat tanpa akun sungguhan. Semua nama dan angka di halaman ini pura-pura.
    </p>
    <p class="mt-2 text-small text-muted">Tidak masuk akun mana pun dan hilang kalau halaman dimuat ulang.</p>
    <div class="mt-6" data-reveal>
      <Ringkas />
    </div>
  </header>

  <div class="mt-8 flex flex-wrap gap-1 rounded bg-surface p-1" role="tablist" aria-label="Masuk sebagai contoh" data-reveal>
    {#each PORTAL_MASUK as id (id)}
      {@const orangIni = orang.find((item) => item.id === id)}
      <button
        type="button"
        role="tab"
        aria-selected={siapa === id}
        class="min-h-11 rounded px-4 text-left text-body {siapa === id ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-field'}"
        onclick={() => pilih(id)}
      >
        <span class="block">{orangIni?.name}</span>
        <span class="block text-small {siapa === id ? 'text-primary-fg/80' : 'text-muted'}">{roleLabel(orangIni?.role ?? null)} · {orangIni?.city}</span>
      </button>
    {/each}
  </div>

  {#if notice}
    <p class="mt-4 text-body text-accent" role="status">{notice}</p>
  {/if}

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
        <dd class="num mt-1 text-lead">{kg(trip.sisa)}</dd>
      </div>
      <div class="panel p-4">
        <dt class="text-small text-muted">Laba trip contoh</dt>
        <dd class="num mt-1 text-lead {trip.laba < 0 ? 'text-accent' : ''}">{idr(trip.laba)}</dd>
      </div>
      <div class="panel p-4">
        <dt class="text-small text-muted">Antrian</dt>
        <dd class="num mt-1 text-lead">{antrian.length}</dd>
      </div>
    </dl>
    <p class="mt-3 text-body text-muted">CGK → IST, pergi saja. Angka mengikuti meja hitung. <a class="link" href="/meja">Buka meja</a>.</p>

    <ul class="mt-5 flex flex-col gap-3">
      {#each rows as row (row.id)}
        <li class="panel p-4">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="text-body">{row.nama}</p>
            <p class="num text-small text-muted">{kg(row.kg)}</p>
          </div>
          <p class="mt-1 text-small text-muted">{namaOrang(row.orangId)} · {arahLabel(row.arah)}</p>
          <div class="mt-3 flex flex-wrap gap-1">
            {#each STATUSES as item (item.id)}
              <button
                type="button"
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
        <dt class="text-small text-muted">Klien</dt>
        <dd class="num mt-1 text-lead">{orang.filter((item) => item.role === "klien").length}</dd>
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
          <label>
            <span class="sr-only">Peran {item.name}</span>
            <select
              class={field}
              value={item.role}
              onchange={(event) => {
                const value = event.currentTarget.value;
                if (value === "klien" || value === "jastiper" || value === "admin") ubahPeran(item.id, value);
              }}
            >
              <option value="klien">Klien</option>
              <option value="jastiper">Jastiper</option>
              <option value="admin" disabled={item.role !== "admin"}>Admin</option>
            </select>
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</section>
