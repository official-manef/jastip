<script lang="ts">
  import { idr, kg } from "../../lib/titip/model";
  import { contohTrip, PORTAL_MASUK, salinOrang, salinTitipan, type ContohOrang, type ContohTitipan } from "../../lib/titip/contoh";
  import { roleLabel, type Role } from "../../lib/titip/roles";
  import { ARAH, arahLabel, STATUSES, statusLabel, type Arah, type TitipanStatus } from "../../lib/titip/titipan";

  const field = "min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-base outline-none placeholder:text-muted";
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

<section class="rise">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="text-sm font-medium tracking-wide text-primary uppercase">Portal contoh</p>
      <h1 class="mt-1 font-display text-4xl italic">Tiga meja, satu rute</h1>
    </div>
    <p class="max-w-xs text-sm text-muted">Data ini pura-pura. Tidak masuk akun sungguhan dan hilang kalau halaman dimuat ulang.</p>
  </div>

  <div class="mt-6 grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Masuk sebagai contoh">
    {#each PORTAL_MASUK as id (id)}
      {@const orangIni = orang.find((item) => item.id === id)}
      <button
        type="button"
        role="tab"
        aria-selected={siapa === id}
        class="ticket min-h-11 px-4 py-4 text-left transition-opacity duration-150 {siapa === id ? 'opacity-100' : 'opacity-70'}"
        onclick={() => pilih(id)}
      >
        <span class="block font-display text-2xl italic leading-none">{orangIni?.name}</span>
        <span class="mt-2 block text-sm text-muted">{roleLabel(orangIni?.role ?? null)} · {orangIni?.city}</span>
      </button>
    {/each}
  </div>

  {#if notice}
    <p class="mt-4 text-sm text-accent" role="status">{notice}</p>
  {/if}

  {#if aku.role === "klien"}
    <div class="mt-8 grid gap-3 sm:grid-cols-3">
      <div class="ticket px-4 py-4">
        <p class="text-sm text-muted">Titipan saya</p>
        <p class="num mt-1 font-display text-3xl">{milikku.length}</p>
      </div>
      <div class="ticket px-4 py-4">
        <p class="text-sm text-muted">Berat</p>
        <p class="num mt-1 font-display text-3xl">{kg(kgSaya)}</p>
      </div>
      <div class="ticket px-4 py-4">
        <p class="text-sm text-muted">Masih jalan</p>
        <p class="num mt-1 font-display text-3xl">{milikku.filter((row) => row.status !== "selesai").length}</p>
      </div>
    </div>

    <form class="ticket mt-4 grid gap-3 p-4 sm:grid-cols-2" onsubmit={tambah}>
      <label class="block text-sm sm:col-span-2">
        Arah
        <select class="{field} mt-1" bind:value={arah}>
          {#each ARAH as item (item.id)}
            <option value={item.id}>{item.label}</option>
          {/each}
        </select>
      </label>
      <label class="block text-sm">
        Barang
        <input class="{field} mt-1" bind:value={nama} placeholder="Nama barang" />
      </label>
      <label class="block text-sm">
        Kg
        <input class="{field} num mt-1" bind:value={berat} inputmode="decimal" />
      </label>
      <label class="block text-sm sm:col-span-2">
        Catatan
        <input class="{field} mt-1" bind:value={catatan} placeholder="Opsional" />
      </label>
      <button type="submit" class="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg sm:col-span-2">Tambah contoh</button>
    </form>

    <ul class="ticket mt-4 divide-y divide-dashed divide-line">
      {#each milikku as row (row.id)}
        <li class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-4">
          <div>
            <p class="font-medium">{row.nama}</p>
            <p class="text-sm text-muted">{arahLabel(row.arah)}{row.catatan ? ` · ${row.catatan}` : ""}</p>
          </div>
          <p class="num text-sm">{kg(row.kg)} · {statusLabel(row.status)}</p>
        </li>
      {:else}
        <li class="px-4 py-6 text-sm text-muted">Belum ada titipan.</li>
      {/each}
    </ul>
  {:else if aku.role === "jastiper"}
    <div class="mt-8 grid gap-3 sm:grid-cols-3">
      <div class="ticket px-4 py-4">
        <p class="text-sm text-muted">Sisa bagasi</p>
        <p class="num mt-1 font-display text-3xl">{kg(trip.sisa)}</p>
      </div>
      <div class="ticket px-4 py-4">
        <p class="text-sm text-muted">Laba trip contoh</p>
        <p class="num mt-1 font-display text-3xl {trip.laba < 0 ? 'text-accent' : ''}">{idr(trip.laba)}</p>
      </div>
      <div class="ticket px-4 py-4">
        <p class="text-sm text-muted">Antrian</p>
        <p class="num mt-1 font-display text-3xl">{antrian.length}</p>
      </div>
    </div>
    <p class="mt-3 text-sm text-muted">CGK → IST, pergi saja. Angka mengikuti meja hitung. <a class="text-primary" href="/">Buka meja</a>.</p>

    <ul class="ticket mt-4">
      {#each rows as row (row.id)}
        <li class="hairline px-4 py-4 first:border-t-0">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="font-medium">{row.nama}</p>
            <p class="num text-sm text-muted">{kg(row.kg)}</p>
          </div>
          <p class="mt-1 text-sm text-muted">{namaOrang(row.orangId)} · {arahLabel(row.arah)}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            {#each STATUSES as item (item.id)}
              <button
                type="button"
                class="min-h-11 rounded-lg px-3 text-sm {row.status === item.id ? 'bg-primary text-primary-fg' : 'text-muted'}"
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
    <div class="mt-8 grid gap-3 sm:grid-cols-3">
      <div class="ticket px-4 py-4">
        <p class="text-sm text-muted">Orang</p>
        <p class="num mt-1 font-display text-3xl">{orang.length}</p>
      </div>
      <div class="ticket px-4 py-4">
        <p class="text-sm text-muted">Klien</p>
        <p class="num mt-1 font-display text-3xl">{orang.filter((item) => item.role === "klien").length}</p>
      </div>
      <div class="ticket px-4 py-4">
        <p class="text-sm text-muted">Titipan</p>
        <p class="num mt-1 font-display text-3xl">{rows.length}</p>
      </div>
    </div>

    <ul class="ticket mt-4">
      {#each orang as item (item.id)}
        <li class="hairline flex flex-wrap items-center justify-between gap-3 px-4 py-4 first:border-t-0">
          <div>
            <p class="font-medium">{item.name}</p>
            <p class="text-sm text-muted">{item.email} · {item.city}</p>
          </div>
          <label class="text-sm">
            <span class="sr-only">Peran {item.name}</span>
            <select
              class="min-h-11 rounded-lg border border-border bg-bg px-3"
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
