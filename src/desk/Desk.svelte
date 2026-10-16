<script lang="ts">
  import { onMount } from "svelte";
  import {
    desk,
    initDesk,
    kakiAktif,
    patch,
    patchKaki,
    resetKaki,
    retrySync,
    setAktif,
    setCapex,
    setDestinasi,
    setDestinasiCustom,
    setGood,
    setGoods,
    setJenis,
    setLama,
    setNama,
    setOpex,
    setPricing,
    clearPricing,
    addGood,
    removeGood,
    tambahKaki,
    sisipKaki,
    hapusKaki,
  } from "../lib/titip/trip-store.svelte";
  import { type CapexLine, type LinePricing } from "../lib/titip/calc";
  import { capacity, computeRevenue, CURRENCIES, ITEM_UNITS, lineWeightKg, targetProgress, tripLintas } from "../lib/titip/pricing";
  import { DESTINASI, viewOf, type CustomDest } from "../lib/titip/destinasi";
  import PilihNegara from "../lib/titip/PilihNegara.svelte";
  import { kakiCode, kakiLabel, type Kaki } from "../lib/titip/kaki";
  import { idr, kg } from "../lib/titip/model";

  const field = "field";
  const btn = "btn";

  const source = $derived(desk.source);
  const syncFailed = $derived(desk.syncFailed);
  const conflict = $derived(desk.conflict);
  const kaki = $derived(desk.kaki);
  const idx = $derived(Math.min(desk.aktif, Math.max(0, kaki.length - 1)));
  const now = $derived<Kaki>(kaki[idx]);
  const scenario = $derived(now.scenario);
  const meta = $derived(viewOf(now.destinasi, now.custom));
  const prev = $derived<Kaki | undefined>(idx > 0 ? kaki[idx - 1] : undefined);
  const shopCurrency = $derived(meta?.currency ?? "IDR");
  /** F06: tarif jasa punya mata uangnya sendiri (`hargaCurrency`), terpisah dari
   *  mata uang belanja destinasi. Omzet/laba mengikuti mata uang tarif. */
  const tariffCurrency = $derived(scenario.hargaCurrency ?? "IDR");

  onMount(() => { initDesk(); });

  /**
   * Wizard bertahap (ala booking pesawat): Rute → Muatan → Biaya → Ringkasan.
   * Stepper di atas (desktop) dan accordion (mobile) memakai `langkah` yang sama.
   */
  const LANGKAH = ["Rute", "Muatan", "Biaya", "Ringkasan"] as const;
  let langkah = $state(0);
  function maju() { langkah = Math.min(LANGKAH.length - 1, langkah + 1); }
  function mundur() { langkah = Math.max(0, langkah - 1); }

  let draftName = $state("");
  let draftKg = $state("0,5");
  let draftBeli = $state("");
  let draftNotice = $state("");
  /** F11: item terakhir yang dihapus (untuk Undo), atau null. */
  let undoBarang = $state<{ name: string; goods: typeof scenario.goods } | null>(null);
  /** F11: konfirmasi reset sebelum menimpa skenario. */
  let konfirmReset = $state(false);
  /** Pilih negara custom untuk tahap aktif. */
  function pilihCustom(c: CustomDest) { setDestinasiCustom(idx, c); }

  /** Hapus barang dengan simpan snapshot untuk Undo. */
  function hapusBarang(id: string) {
    const item = scenario.goods.find((g) => g.id === id);
    if (!item) return;
    undoBarang = { name: item.name, goods: scenario.goods };
    removeGood(id);
  }

  /** Total lintas kaki: jasa, muatan, kapasitas. */
  const lintas = $derived(tripLintas(kaki.map((k) => ({
    id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario,
  }))));

  const rev = $derived(computeRevenue(scenario.goods, scenario.hargaPerKg, tariffCurrency));
  const progres = $derived(targetProgress(rev.service, scenario.target ?? 0));
  const kapasitas = $derived(capacity(lintas.capacityKg, lintas.totalKg));
  const punyaTarif = $derived(rev.hasPricing);
  const tarifKosong = $derived(rev.rows.filter((r) => (scenario.goods.find((g) => g.id === r.id)?.pricing?.rate ?? 0) <= 0).length);
  const asumsi = $derived(tarifKosong > 0 || rev.needsRate);
  const rowById = $derived(new Map(rev.rows.map((r) => [r.id, r])));

  /** Hitungan satu kaki (beban, laba) untuk readout & total trip. */
  function bebanKaki(k: Kaki): number {
    const opex = k.scenario.opex.reduce((sum, line) => sum + line.amount, 0);
    const capex = k.scenario.capex.reduce((sum, line) => sum + line.price / Math.max(1, line.trips), 0);
    return Math.round(opex + capex);
  }
  const bebanTrip = $derived(kaki.reduce((sum, k) => sum + bebanKaki(k), 0));
  const omzetTrip = $derived(lintas.service);
  const labaTrip = $derived(Math.round(omzetTrip - bebanTrip));

  const bersihKaki = $derived(Math.max(0, scenario.bags * scenario.kgPerBag + scenario.cabin - scenario.tare));
  const terpakaiKaki = $derived(rev.totalKg);
  const sisaKaki = $derived(Math.round((bersihKaki - terpakaiKaki) * 10) / 10);
  const over = $derived(sisaKaki < 0);
  const penuh = $derived(bersihKaki > 0 ? Math.min(1, terpakaiKaki / bersihKaki) : 1);
  /** F07: kuota nol → saran harga & impas tidak bermakna. */
  const kuotaNol = $derived(bersihKaki <= 0);
  /** F05: lebih dari satu mata uang → tampilkan subtotal, jangan satu total. */
  const multivaluta = $derived(lintas.currencies.length > 1);
  /** F04/F05: impas hanya bermakna kalau harga/kg > 0 dan kuota > 0. */
  const impasKg = $derived(kuotaNol || scenario.hargaPerKg <= 0 ? null : Math.round((bebanKaki(now) / scenario.hargaPerKg) * 10) / 10);
  const saranPerKg = $derived(kuotaNol ? null : Math.round((bebanKaki(now) / bersihKaki) * (1 + scenario.margin / 100)));

  function fmtTarif(rate: number): string {
    return Number.isInteger(rate) ? rate.toLocaleString("id-ID") : String(rate);
  }

  function pickTarifLabel(p: LinePricing): string {
    const money = `${fmtTarif(p.rate)}${p.currency ? ` ${p.currency}` : ""}`;
    return p.model === "per_item" ? `${money}/${p.unit || "item"}` : `${money}/kg`;
  }

  function addDraft() {
    const name = draftName.trim();
    const kgEach = Number(draftKg.replace(",", "."));
    const beli = Number(draftBeli.replace(/\./g, "").replace(",", "."));
    if (name.length < 2 || name.length > 80 || !Number.isFinite(kgEach) || kgEach <= 0 || kgEach > 100 ||
        !Number.isFinite(beli) || beli < 0 || beli > 1_000_000_000_000 || scenario.goods.length >= 200) {
      draftNotice = "Isi nama 2–80 karakter, berat 0–100 kg, dan harga beli yang tidak negatif. Maksimal 200 barang.";
      return;
    }
    draftNotice = "";
    addGood({ id: `g${Date.now().toString(36)}`, name, kg: kgEach, qty: 1, beli });
    draftName = "";
    draftBeli = "";
  }

  function focusDraft() {
    document.getElementById("barang-baru")?.focus();
  }
</script>

{#snippet slider(label: string, value: number, min: number, max: number, step: number, shown: string, onChange: (n: number) => void)}
  <label class="block">
    <span class="mb-2 flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span class="num text-body">{shown}</span>
    </span>
    <input type="range" {min} {max} {step} {value}
      oninput={(e) => { const next = Number(e.currentTarget.value); onChange(step < 1 ? Math.round(next * 10) / 10 : next); }}
      class="w-full" />
  </label>
{/snippet}

{#snippet row(k: string, v: string, hint?: string)}
  <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
    <dt class="text-body">{k}{#if hint}<span class="block text-small text-muted">{hint}</span>{/if}</dt>
    <dd class="num shrink-0 text-body">{v}</dd>
  </div>
{/snippet}

<article class="pb-4">
  <header class="max-w-[44rem]" data-rise style="--i: 0">
    <h1>Trip {kaki.length} tahap</h1>
    <p class="mt-4 text-lead text-fg">
      Susun rute berurutan: tiap tahap punya negara, mata uang belanja, dan muatannya sendiri.
      Tandai tahap sebagai <strong>transit</strong> kalau cuma singgah sebentar.
    </p>

    <label class="mt-5 block max-w-[28rem]">
      <span class="mb-2 block text-small text-muted">Nama trip</span>
      <input class={field} maxlength="80" value={desk.nama} oninput={(e) => setNama(e.currentTarget.value)} aria-label="Nama trip" />
    </label>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <button type="button" class={btn} onclick={focusDraft}>Tambah barang</button>
      <a class="link text-body" href="/portal">Lihat portal contoh</a>
    </div>
    <p class="mt-4 text-small text-muted" role="status">{source}</p>
    {#if syncFailed}<button type="button" class="link mt-2 block text-body" onclick={() => retrySync()}>Coba simpan ke akun lagi</button>{/if}
    {#if conflict}<button type="button" class="link mt-2 block text-body" onclick={() => window.location.reload()}>Muat ulang trip dari akun</button>{/if}
  </header>

  <!-- Layout ala booking: kolom kerja (wizard) + ringkasan lengket di kanan (>=lg). -->
  <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
    <div class="min-w-0">
      <!-- Stepper: satu sumber langkah, juga dipakai accordion di mobile. -->
      <nav class="stepper" aria-label="Tahapan kalkulator">
        {#each LANGKAH as nama, i (nama)}
          <button
            type="button"
            class="stepper-item {i === langkah ? 'is-active' : ''} {i < langkah ? 'is-done' : ''}"
            aria-current={i === langkah ? "step" : undefined}
            onclick={() => (langkah = i)}
          >
            <span class="stepper-num">{i + 1}</span>
            <span class="stepper-label">{nama}</span>
          </button>
        {/each}
      </nav>

      {#if langkah === 0}
      <!-- 1) Rute -->
      <section class="panel mt-5 p-5" data-reveal aria-labelledby="rute-kaki">
        <h2 id="rute-kaki" class="text-lead">Rute</h2>
        <p class="mt-2 text-small text-muted">Pilih tahap, lalu negara dan jenis singgah. Urutan tombol = urutan penerbangan.</p>

        <div class="mt-4 flex flex-wrap items-stretch gap-2">
          {#each kaki as k, i (k.id)}
            {@const d = viewOf(k.destinasi, k.custom)}
            {@const aktif = i === idx}
            <button
              type="button"
              aria-current={aktif ? "true" : undefined}
              onclick={() => setAktif(i)}
              class="min-h-14 rounded px-4 text-left {aktif ? 'bg-primary text-primary-fg' : 'bg-bg text-fg hover:bg-field'}"
            >
              <span class="block text-small {aktif ? 'text-primary-fg/80' : 'text-muted'}">{kakiCode(k, i > 0 ? kaki[i - 1] : undefined)}</span>
              <span class="block text-body">{d?.kota ?? k.destinasi}</span>
              <span class="block text-small {aktif ? 'text-primary-fg/80' : 'text-muted'}">
                {k.jenis === "transit" ? `transit ${k.lama}j` : `${k.lama} hari`}
              </span>
            </button>
          {/each}
          <div class="flex flex-col justify-center gap-2">
            <button type="button" class="btn-quiet px-3 text-small" onclick={() => tambahKaki()} aria-label="Tambah tahap di akhir">+ Tahap</button>
            <button type="button" class="btn-quiet px-3 text-small" onclick={() => sisipKaki(idx, "singapura", "transit")} aria-label="Sisipkan tahap transit setelah tahap ini">+ Transit</button>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-end justify-between gap-3">
          <h3 class="text-body">{kakiLabel(now, prev)}</h3>
          {#if kaki.length > 1}
            <button type="button" class="link text-small" onclick={() => hapusKaki(idx)}>Hapus tahap ini</button>
          {/if}
        </div>

        <div class="mt-3 grid gap-4 sm:grid-cols-3">
          <label class="block">
            <span class="mb-2 block text-small text-muted">Negara tujuan</span>
            <PilihNegara
              nilai={now.destinasi}
              custom={now.custom}
              onpilih={(kode) => setDestinasi(idx, kode)}
              oncustom={pilihCustom}
            />
          </label>
          <label class="block">
            <span class="mb-2 block text-small text-muted">Jenis singgah</span>
            <select class={field} value={now.jenis} onchange={(e) => setJenis(idx, e.currentTarget.value === "transit" ? "transit" : "utama")}>
              <option value="utama">Utama (belanja)</option>
              <option value="transit">Transit (singgah)</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-2 block text-small text-muted">{now.jenis === "transit" ? "Lama (jam)" : "Lama (hari)"}</span>
            <input type="number" min="0" class="{field} num" value={now.lama}
              oninput={(e) => setLama(idx, Number(e.currentTarget.value))} aria-label="Lama di tahap ini" />
          </label>
        </div>
        {#if meta && !meta.custom && meta.alasan}
          <p class="mt-3 text-small text-muted">{meta.alasan}</p>
        {/if}
      </section>
      {/if}

      {#if langkah === 1}
      <!-- 2) Muatan: kuota + barang tahap ini -->
      <section class="mt-5" data-reveal aria-labelledby="bagasi">
        <div class="panel p-5">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="bagasi" class="text-lead">Kuota bagasi {meta?.kota ?? "tahap ini"}</h2>
            <span class="num text-body text-muted">{kg(terpakaiKaki)} dari {kg(bersihKaki)}</span>
          </div>
          <div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {@render slider("Koper check-in", scenario.bags, 0, 3, 1, `${scenario.bags} koper`, (bags) => patch({ bags }))}
            {@render slider("Kg per koper", scenario.kgPerBag, 10, 60, 1, kg(scenario.kgPerBag), (kgPerBag) => patch({ kgPerBag }))}
            {@render slider("Kabin", scenario.cabin, 0, 12, 1, kg(scenario.cabin), (cabin) => patch({ cabin }))}
            {@render slider("Tara koper & pribadi", scenario.tare, 0, 12, 0.1, kg(scenario.tare), (tare) => patch({ tare }))}
            {@render slider("Denda kelebihan / kg", scenario.overPerKg, 0, 800000, 10000, idr(scenario.overPerKg), (overPerKg) => patch({ overPerKg }))}
            {@render slider("Uji muat 1 pcs", scenario.ujiKg, 0.1, 3, 0.1, kg(scenario.ujiKg), (ujiKg) => patch({ ujiKg }))}
          </div>
        </div>

        <div class="mt-5" aria-labelledby="muatan">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="muatan" class="text-lead">Muatan {meta?.kota ?? "tahap ini"}</h2>
            <p class="num text-body text-muted">{kg(terpakaiKaki)} terpakai · {fmtTarif(rev.service)} jasa</p>
          </div>

          <ul class="mt-4 flex flex-col gap-3">
            {#each scenario.goods as g (g.id)}
              {@const r = rowById.get(g.id)}
              {@const tarif = g.pricing}
              <li class="panel p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-body">{g.name}</p>
                    <p class="num mt-1 text-small text-muted">
                      {kg(g.kg)} × {g.qty} = {kg(lineWeightKg(g))} · beli {meta?.currency === "IDR" || now.destinasi === "jakarta" ? idr(g.beli) : `${meta?.currency ?? ""} ${g.beli}`}
                    </p>
                    <p class="num mt-1 text-small {tarif ? 'text-fg' : 'text-muted'}">
                      {#if r && tarif}
                        {pickTarifLabel(tarif)} = {fmtTarif(r.service)}
                      {:else}
                        tarif global {idr(r?.rate ?? scenario.hargaPerKg)}/kg = {fmtTarif(r?.service ?? 0)}
                      {/if}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" aria-label="Kurangi {g.name}" class="grid size-11 place-items-center rounded bg-bg text-lead" onclick={() => setGood(g.id, { qty: Math.max(0, g.qty - 1) })}>−</button>
                    <span class="num w-8 text-center text-body">{g.qty}</span>
                    <button type="button" aria-label="Tambah {g.name}" class="grid size-11 place-items-center rounded bg-bg text-lead" onclick={() => setGood(g.id, { qty: g.qty + 1 })}>+</button>
                    <button type="button" class="btn-quiet px-3" aria-label="Hapus {g.name}" onclick={() => hapusBarang(g.id)}>Hapus</button>
                  </div>
                </div>
                <div class="mt-4 flex flex-wrap items-center gap-3">
                  <div class="flex gap-1 rounded bg-bg p-1" role="group" aria-label="Model tarif {g.name}">
                    <button type="button" aria-pressed={!tarif} class="min-h-9 rounded px-3 text-small {!tarif ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-field'}" onclick={() => clearPricing(g.id)}>Global</button>
                    <button type="button" aria-pressed={tarif?.model === "per_kg"} class="min-h-9 rounded px-3 text-small {tarif?.model === 'per_kg' ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-field'}" onclick={() => setPricing(g.id, { model: "per_kg" })}>Per kg</button>
                    <button type="button" aria-pressed={tarif?.model === "per_item"} class="min-h-9 rounded px-3 text-small {tarif?.model === 'per_item' ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-field'}" onclick={() => setPricing(g.id, { model: "per_item" })}>Per item</button>
                  </div>
                  {#if tarif}
                    <label class="flex items-center gap-2 text-small text-muted">
                      Tarif
                      <input type="number" min="0" step="1" value={tarif.rate} class="{field} num w-24"
                        aria-label="Tarif {g.name}" oninput={(e) => setPricing(g.id, { rate: Math.max(0, Number(e.currentTarget.value)) })} />
                    </label>
                    {#if tarif.model === "per_item"}
                      <label class="flex items-center gap-2 text-small text-muted">
                        Satuan
                        <select value={tarif.unit ?? "unit"} class="{field} w-28" aria-label="Satuan {g.name}"
                          onchange={(e) => setPricing(g.id, { unit: e.currentTarget.value })}>
                          {#each ITEM_UNITS as u (u)}<option value={u}>{u}</option>{/each}
                        </select>
                      </label>
                    {/if}
                    <label class="flex items-center gap-2 text-small text-muted">
                      Mata uang
                      <select value={tarif.currency ?? shopCurrency} class="{field} w-24" aria-label="Mata uang {g.name}"
                        onchange={(e) => setPricing(g.id, { currency: e.currentTarget.value })}>
                        {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
                      </select>
                    </label>
                    {#if (tarif.rate ?? 0) <= 0}
                      <span class="text-small text-accent">tarif belum ditetapkan</span>
                    {/if}
                  {/if}
                </div>
              </li>
            {:else}
              <li class="panel p-6 text-body text-muted">Belum ada barang di tahap ini.</li>
            {/each}
          </ul>

          {#if undoBarang}
            <p class="mt-3 flex flex-wrap items-center gap-3 text-body" role="status">
              <span class="text-muted">“{undoBarang.name}” dihapus.</span>
              <button
                type="button"
                class="link text-body"
                onclick={() => { if (undoBarang) { setGoods(undoBarang.goods); undoBarang = null; } }}
              >Urungkan</button>
            </p>
          {/if}

          <form class="panel mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_6rem_7rem_auto]"
            onsubmit={(e) => { e.preventDefault(); addDraft(); }}>
            <label class="block">
              <span class="mb-2 block text-small text-muted">Barang baru</span>
              <input id="barang-baru" bind:value={draftName} class={field} aria-label="Nama barang" />
            </label>
            <label class="block">
              <span class="mb-2 block text-small text-muted">Kg per pcs</span>
              <input bind:value={draftKg} inputmode="decimal" class="{field} num" aria-label="Kg per pcs" />
            </label>
            <label class="block">
              <span class="mb-2 block text-small text-muted">Harga beli</span>
              <input bind:value={draftBeli} inputmode="numeric" placeholder={shopCurrency === "IDR" ? "Rp" : shopCurrency} class="{field} num" aria-label="Harga beli" />
            </label>
            <button type="submit" class="btn self-end">Tambah</button>
          </form>
          {#if draftNotice}<p class="mt-3 text-body text-accent" role="status">{draftNotice}</p>{/if}
        </div>
      </section>
      {/if}

      {#if langkah === 2}
      <!-- 3) Biaya: jalan + alat + target -->
      <section class="mt-5" aria-labelledby="opex">
        <div class="panel p-5">
          <h2 id="opex" class="text-lead">Biaya jalan {meta?.kota ?? "tahap ini"}</h2>
          <p class="num mt-2 text-body text-muted" data-reveal>
            {kakiCode(now, prev)} · tiket {idr(scenario.opex.find((l) => l.id === "tiket")?.amount ?? 0)}
          </p>
          <ul class="mt-4 flex flex-col gap-2">
            {#each scenario.opex as line (line.id)}
              <li class="flex items-center justify-between gap-3">
                <label class="text-body" for={"opex-" + line.id}>{line.label}</label>
                <input id={"opex-" + line.id} type="number" value={line.amount} min="0" step="50000"
                  class="{field} num w-40" oninput={(e) => setOpex(line.id, Number(e.currentTarget.value))} />
              </li>
            {/each}
          </ul>
          {#if now.destinasi === "turki"}
            <label class="mt-5 block">
              <span class="mb-2 flex items-baseline justify-between gap-3">
                <span>Kurs 1 TRY</span><span class="num text-body">{idr(scenario.kursTry)}</span>
              </span>
              <input type="range" min="200" max="900" step="10" value={scenario.kursTry}
                oninput={(e) => patchKaki(idx, { kursTry: Number(e.currentTarget.value) })} class="w-full" />
            </label>
          {/if}
        </div>

        <div class="panel mt-5 p-5" aria-labelledby="capex">
          <h2 id="capex" class="text-lead">Biaya alat, dipakai semua tahap</h2>
          <p class="mt-2 text-body text-muted">Koper dan timbangan dipakai bersama; dibagi umur trip, dihitung sekali.</p>
          <ul class="mt-4 flex flex-col gap-3">
            {#each scenario.capex as line (line.id)}
              <li class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_7rem] sm:items-end">
                <p class="text-body">
                  {line.label}
                  <span class="num mt-1 block text-small text-muted">{idr(Math.round(line.price / Math.max(1, line.trips)))} / trip</span>
                </p>
                <label class="block">
                  <span class="mb-2 block text-small text-muted">Harga alat</span>
                  <input type="number" value={line.price} min="0" class="{field} num" oninput={(e) => setCapex(line.id, { price: Number(e.currentTarget.value) })} />
                </label>
                <label class="block">
                  <span class="mb-2 block text-small text-muted">Umur trip</span>
                  <input type="number" value={line.trips} min="1" class="{field} num" oninput={(e) => setCapex(line.id, { trips: Math.max(1, Number(e.currentTarget.value)) })} />
                </label>
              </li>
            {:else}
              <li class="panel p-6 text-body text-muted">Belum ada biaya alat.</li>
            {/each}
          </ul>
          {#if konfirmReset}
            <div class="panel mt-5 p-4" role="alertdialog" aria-label="Konfirmasi reset tahap">
              <p class="text-body">Reset tahap ini ke skenario contoh? Perubahan yang belum disalin akan hilang.</p>
              <div class="mt-3 flex flex-wrap gap-3">
                <button type="button" class="btn" onclick={() => { resetKaki(); konfirmReset = false; undoBarang = null; }}>Ya, reset</button>
                <button type="button" class="btn-quiet" onclick={() => (konfirmReset = false)}>Batal</button>
              </div>
            </div>
          {:else}
            <button type="button" class="link mt-5 block text-body" onclick={() => (konfirmReset = true)}>Reset tahap ini ke skenario contoh</button>
          {/if}
        </div>
      </section>
      {/if}

      {#if langkah === 3}
      <!-- 4) Ringkasan: omzet, tarif, target, katalog -->
      <section class="panel mt-5 p-5" data-rise data-ui aria-label="Ringkasan omzet dan target">
        <h2 class="text-lead">Omzet & target</h2>
        <dl class="mt-3 grid gap-3 sm:grid-cols-2">
          {#if multivaluta}
            {#each Object.entries(lintas.perCurrency) as [cur, val] (cur)}
              {@render row(`Jasa (${cur})`, fmtTarif(val), "subtotal per mata uang")}
            {/each}
          {:else}
            {@render row("Jasa tahap ini", `${fmtTarif(rev.service)}${rev.currencies.length === 1 ? ` ${rev.currencies[0]}` : ""}`)}
          {/if}
          {@render row("Beban tahap ini", idr(bebanKaki(now)))}
          {@render row("Berat baris", kg(lintas.totalKg), "presisi per baris, semua tahap")}
          {#if progres.set}
            {@render row("Target omzet", `${fmtTarif(scenario.target ?? 0)} ${scenario.hargaCurrency ?? "USD"}`, `${progres.persen}% tercapai`)}
            {@render row(progres.achieved ? "Lebih target" : "Butuh lagi", fmtTarif(progres.achieved ? progres.lebih : progres.butuh))}
          {:else}
            {@render row("Target omzet", "belum diatur")}
          {/if}
        </dl>
        <div class="meter mt-4" aria-hidden="true">
          <span style="width: {Math.min(100, Math.max(0, Math.round(progres.persen)))}%"></span>
        </div>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-2 block">Target omzet jasa</span>
            <input type="number" min="0" step="50" value={scenario.target ?? 0} class="{field} num"
              aria-label="Target omzet jasa" oninput={(e) => patch({ target: Math.max(0, Number(e.currentTarget.value)) })} />
          </label>
          <label class="block">
            <span class="mb-2 block">Mata uang target</span>
            <select class={field} value={scenario.hargaCurrency ?? shopCurrency} aria-label="Mata uang target"
              onchange={(e) => patch({ hargaCurrency: e.currentTarget.value })}>
              {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
            </select>
          </label>
        </div>
        {#if asumsi}
          <p class="mt-3 text-small text-accent" role="status">
            Proyeksi memakai tarif asumsi global; {tarifKosong > 0 ? `${tarifKosong} baris belum bertarif` : "baris bercampur mata uang tanpa kurs"}. Bukan laporan final.
          </p>
        {/if}

        <h3 class="mt-8 text-lead" id="negara">Negara tujuan jastip</h3>
        <p class="mt-2 text-body text-muted">
          Katalog {DESTINASI.length} negara + Turki. Kategori dan kurs contoh untuk memulai. Kalau negara
          tak ada, pilih "Negara lain…" di pemilih rute.
        </p>
        <ul class="mt-4 grid gap-3 sm:grid-cols-2">
          {#each DESTINASI as d (d.code)}
            <li class="panel p-4">
              <div class="flex items-baseline justify-between gap-3">
                <p class="text-body">{d.negara}</p>
                <span class="num text-small text-muted">{d.currency} · {idr(d.kurs)}</span>
              </div>
              <p class="mt-1 text-small text-muted">{d.ringkas}</p>
              <button type="button" class="link mt-2 text-small" onclick={() => { setDestinasi(idx, d.code); langkah = 0; }}>Pakai untuk tahap ini</button>
            </li>
          {/each}
        </ul>
      </section>
      {/if}

      <!-- Navigasi langkah -->
      <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" class="btn-quiet disabled:opacity-50" disabled={langkah === 0} onclick={mundur}>← Sebelumnya</button>
        <span class="text-small text-muted">Langkah {langkah + 1} dari {LANGKAH.length}</span>
        <button type="button" class="btn disabled:opacity-50" disabled={langkah === LANGKAH.length - 1} onclick={maju}>Berikutnya →</button>
      </div>
    </div>

    <!-- Ringkasan lengket (desktop): angka kunci selalu terlihat ala ringkasan harga tiket. -->
    <aside class="lg:sticky lg:top-6" aria-label="Ringkasan trip">
      <div class="panel-deep rounded p-5" data-ui>
        <p class="text-small">{kakiLabel(now, prev)} · {kakiCode(now, prev)}</p>
        <p class="readout mt-3 {over ? 'text-accent' : 'text-fg'}">
          {over ? `−${kg(-sisaKaki)}` : kg(sisaKaki)}
        </p>
        <p class="mt-2 text-body">{over ? "kelebihan bagasi tahap ini" : "sisa kuota tahap ini"}</p>
        <div class="meter mt-3" aria-hidden="true"><span style="width: {Math.round(penuh * 100)}%; background: {over ? 'var(--color-accent)' : ''}"></span></div>

        <dl class="mt-5 grid gap-2 text-body">
          <div class="flex items-baseline justify-between gap-3">
            <dt>Total muatan</dt>
            <dd class="num">{kg(lintas.totalKg)} / {kg(lintas.capacityKg)}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt>Jasa trip</dt>
            <dd class="num">{multivaluta ? "campur" : fmtTarif(lintas.service)}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt>Beban trip</dt>
            <dd class="num">{idr(bebanTrip)}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt>Laba trip</dt>
            <dd class="num {labaTrip < 0 ? 'text-accent' : 'text-fg'}">{idr(labaTrip)}</dd>
          </div>
        </dl>
        {#if lintas.overKg > 0}
          <p class="mt-3 text-small text-accent">Kelebihan total {kg(lintas.overKg)}. Cek tahap paling ketat.</p>
        {/if}
        {#if multivaluta}
          <p class="mt-3 text-small text-accent">
            Baris memakai lebih dari satu mata uang ({lintas.currencies.join(", ")}). "Laba trip" hanya perkiraan.
          </p>
        {/if}
      </div>
    </aside>
  </div>
</article>
