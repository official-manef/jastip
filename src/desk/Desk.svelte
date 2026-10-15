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
    setGood,
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
  import { DESTINASI, destinasiByCode } from "../lib/titip/destinasi";
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
  const meta = $derived(destinasiByCode(now.destinasi));
  const prev = $derived<Kaki | undefined>(idx > 0 ? kaki[idx - 1] : undefined);
  const shopCurrency = $derived(meta?.currency ?? "IDR");

  onMount(() => { initDesk(); });

  let draftName = $state("");
  let draftKg = $state("0,5");
  let draftBeli = $state("");
  let draftNotice = $state("");

  /** Total lintas kaki: jasa, muatan, kapasitas. */
  const lintas = $derived(tripLintas(kaki.map((k) => ({
    id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario,
  }))));

  const rev = $derived(computeRevenue(scenario.goods, scenario.hargaPerKg, shopCurrency));
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
    <h1>Trip {kaki.length} kaki</h1>
    <p class="mt-4 text-lead text-fg">
      Susun rute berurutan: tiap kaki punya negara, mata uang belanja, dan muatannya sendiri.
      Tandai kaki sebagai <strong>transit</strong> kalau cuma singgah sebentar.
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

  <!-- Pemilih kaki: rute berurutan, kaki aktif disorot. -->
  <section class="mt-8" data-reveal aria-labelledby="rute-kaki">
    <h2 id="rute-kaki" class="text-lead">Rute</h2>
    <div class="mt-3 flex flex-wrap items-stretch gap-2">
      {#each kaki as k, i (k.id)}
        {@const d = destinasiByCode(k.destinasi)}
        {@const aktif = i === idx}
        <button
          type="button"
          aria-current={aktif ? "true" : undefined}
          onclick={() => setAktif(i)}
          class="min-h-14 rounded px-4 text-left {aktif ? 'bg-primary text-primary-fg' : 'bg-surface text-fg hover:bg-field'}"
        >
          <span class="block text-small {aktif ? 'text-primary-fg/80' : 'text-muted'}">{kakiCode(k, i > 0 ? kaki[i - 1] : undefined)}</span>
          <span class="block text-body">{d?.kota ?? k.destinasi}</span>
          <span class="block text-small {aktif ? 'text-primary-fg/80' : 'text-muted'}">
            {k.jenis === "transit" ? `transit ${k.lama}j` : `${k.lama} hari`}
          </span>
        </button>
      {/each}
      <div class="flex flex-col justify-center gap-2">
        <button type="button" class="btn-quiet px-3 text-small" onclick={() => tambahKaki()} aria-label="Tambah kaki di akhir">+ Kaki</button>
        <button type="button" class="btn-quiet px-3 text-small" onclick={() => sisipKaki(idx, "singapura", "transit")} aria-label="Sisipkan kaki transit setelah kaki ini">+ Transit</button>
      </div>
    </div>
  </section>

  <!-- Pengaturan kaki aktif -->
  <section class="panel mt-6 p-5" data-reveal aria-labelledby="kaki-aktif">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h2 id="kaki-aktif" class="text-lead">{kakiLabel(now, prev)}</h2>
      {#if kaki.length > 1}
        <button type="button" class="link text-small" onclick={() => hapusKaki(idx)}>Hapus kaki ini</button>
      {/if}
    </div>

    <div class="mt-4 grid gap-4 sm:grid-cols-3">
      <label class="block">
        <span class="mb-2 block text-small text-muted">Negara tujuan</span>
        <select class={field} value={now.destinasi} onchange={(e) => setDestinasi(idx, e.currentTarget.value)}>
          {#each DESTINASI as d (d.code)}
            <option value={d.code}>{d.negara}</option>
          {/each}
          <option value="jakarta">Indonesia (Jakarta)</option>
        </select>
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
          oninput={(e) => setLama(idx, Number(e.currentTarget.value))} aria-label="Lama di kaki ini" />
      </label>
    </div>

    {#if meta}
      <p class="mt-3 text-small text-muted">
        Kategori khas: {meta.kategori.join(", ")}. {meta.alasan}
        Mata uang belanja {meta.currency} (kurs contoh {idr(meta.kurs)}).
      </p>
    {/if}
  </section>

  <!-- Instrumen: satu-satunya hal besar. Total trip + kaki aktif. -->
  <section class="panel-deep mt-6 p-5" data-rise data-ui style="--i: 2" aria-label="Sisa kuota dan laba">
    <p class="text-small">{kakiLabel(now, prev)} · {kakiCode(now, prev)}</p>
    <p class="readout mt-3 {over ? 'text-accent' : 'text-fg'}">
      {over ? `−${kg(-sisaKaki)}` : kg(sisaKaki)}
    </p>
    <p class="mt-2 text-body">{over ? "kelebihan bagasi kaki ini" : "sisa kuota kaki ini"} · {kg(terpakaiKaki)} dari {kg(bersihKaki)}</p>
    <div class="meter mt-4" aria-hidden="true"><span style="width: {Math.round(penuh * 100)}%; background: {over ? 'var(--color-accent)' : ''}"></span></div>

    <dl class="mt-6 grid gap-3 sm:grid-cols-2">
      {#if multivaluta}
        {#each Object.entries(lintas.perCurrency) as [cur, val] (cur)}
          {@render row(`Jasa (${cur})`, fmtTarif(val), "subtotal per mata uang")}
        {/each}
      {:else}
        {@render row("Jasa kaki ini", `${fmtTarif(rev.service)}${rev.currencies.length === 1 ? ` ${rev.currencies[0]}` : ""}`)}
      {/if}
      {@render row("Beban kaki ini", idr(bebanKaki(now)))}
      {#if !multivaluta}
        {@render row("Jasa seluruh trip", `${fmtTarif(lintas.service)}${lintas.currencies.length === 1 ? ` ${lintas.currencies[0]}` : ""}`, `${kaki.length} kaki`)}
      {/if}
      {@render row("Laba trip (estimasi)", idr(labaTrip), multivaluta ? "campur mata uang — perkiraan kasar" : "jasa semua kaki − beban semua kaki")}
    </dl>
    {#if multivaluta}
      <p class="mt-3 text-small text-accent" role="status">
        Baris memakai lebih dari satu mata uang ({lintas.currencies.join(", ")}). Angka dijumlahkan tanpa kurs, jadi
        "Laba trip" hanya perkiraan. Pakai satu mata uang per trip untuk laporan final.
      </p>
    {/if}

    <div class="mt-4 rounded bg-bg/40 p-4">
      <div class="flex items-end justify-between gap-3">
        <span class="text-body">Total muatan</span>
        <span class="num text-body">{kg(lintas.totalKg)} / {kg(lintas.capacityKg)}</span>
      </div>
      <div class="meter mt-3" aria-hidden="true">
        <span style="width: {Math.min(100, Math.max(0, Math.round((lintas.totalKg / Math.max(0.1, lintas.capacityKg)) * 100)))}%; background: {lintas.overKg > 0 ? 'var(--color-accent)' : ''}"></span>
      </div>
      {#if lintas.overKg > 0}
        <p class="mt-2 text-small text-accent">Kelebihan total {kg(lintas.overKg)}. Cek kaki paling ketat.</p>
      {/if}
    </div>

    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      <label class="block">
        <span class="mb-2 flex items-baseline justify-between gap-3">
          <span>Harga jual / kg</span><span class="num text-body">{idr(scenario.hargaPerKg)}</span>
        </span>
        <input type="range" min="50000" max="2000000" step="10000" value={scenario.hargaPerKg}
          oninput={(e) => patch({ hargaPerKg: Number(e.currentTarget.value) })} class="w-full" />
      </label>
      <label class="block">
        <span class="mb-2 flex items-baseline justify-between gap-3">
          <span>Markup atas modal</span><span class="num text-body">{scenario.margin}%</span>
        </span>
        <input type="range" min="0" max="120" step="5" value={scenario.margin}
          oninput={(e) => patch({ margin: Number(e.currentTarget.value) })} class="w-full" />
      </label>
    </div>
    <button type="button" class="btn-quiet mt-4 w-full disabled:opacity-50" disabled={saranPerKg === null}
      onclick={() => { if (saranPerKg !== null) patch({ hargaPerKg: saranPerKg }); }}>
      Pakai harga saran{saranPerKg === null ? " (kuota 0)" : ""}
    </button>

    <h3 class="mt-6 text-lead">Omzet & target</h3>
    <dl class="mt-2 grid gap-3 sm:grid-cols-2">
      {@render row("Berat baris", kg(lintas.totalKg), "presisi per baris, semua kaki")}
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
  </section>

  <section class="mt-14" aria-labelledby="bagasi">
    <h2 id="bagasi" data-reveal>Kuota bagasi kaki ini</h2>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
      {@render slider("Koper check-in", scenario.bags, 0, 3, 1, `${scenario.bags} koper`, (bags) => patch({ bags }))}
      {@render slider("Kg per koper", scenario.kgPerBag, 10, 60, 1, kg(scenario.kgPerBag), (kgPerBag) => patch({ kgPerBag }))}
      {@render slider("Kabin", scenario.cabin, 0, 12, 1, kg(scenario.cabin), (cabin) => patch({ cabin }))}
      {@render slider("Tara koper & pribadi", scenario.tare, 0, 12, 0.1, kg(scenario.tare), (tare) => patch({ tare }))}
      {@render slider("Denda kelebihan / kg", scenario.overPerKg, 0, 800000, 10000, idr(scenario.overPerKg), (overPerKg) => patch({ overPerKg }))}
      {@render slider("Uji muat 1 pcs", scenario.ujiKg, 0.1, 3, 0.1, kg(scenario.ujiKg), (ujiKg) => patch({ ujiKg }))}
    </div>
  </section>

  <section class="mt-14" aria-labelledby="muatan">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id="muatan" data-reveal>Muatan {meta?.kota ?? "kaki ini"}</h2>
      <p class="num text-body text-muted" data-reveal>{kg(terpakaiKaki)} terpakai · {fmtTarif(rev.service)} jasa</p>
    </div>

    <ul class="mt-5 flex flex-col gap-3">
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
              <button type="button" class="btn-quiet px-3" onclick={() => removeGood(g.id)}>Hapus</button>
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
        <li class="panel p-6 text-body text-muted">Belum ada barang di kaki ini.</li>
      {/each}
    </ul>

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
  </section>

  <section class="mt-14" aria-labelledby="opex">
    <h2 id="opex" data-reveal>Opex kaki ini</h2>
    <p class="num mt-2 text-body text-muted" data-reveal>
      {kakiCode(now, prev)} · tiket {idr(scenario.opex.find((l) => l.id === "tiket")?.amount ?? 0)}
    </p>
    <ul class="mt-5 flex flex-col gap-2">
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
  </section>

  <section class="mt-14" aria-labelledby="capex">
    <h2 id="capex" data-reveal>Capex, dipakai semua kaki</h2>
    <p class="mt-2 text-body text-muted" data-reveal>Koper dan timbangan dipakai bersama; dibagi umur trip, dihitung sekali.</p>
    <ul class="mt-5 flex flex-col gap-3">
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
        <li class="panel p-6 text-body text-muted">Belum ada capex.</li>
      {/each}
    </ul>
    <button type="button" class="link mt-5 block text-body" onclick={resetKaki}>Reset kaki ini ke skenario contoh</button>
  </section>

  <section class="mt-14" aria-labelledby="negara">
    <h2 id="negara" data-reveal>Negara tujuan jastip</h2>
    <p class="mt-3 text-body text-muted" data-reveal>
      Sepuluh tujuan paling populer untuk pasar Indonesia, plus Turki (koridor lama). Kategori dan kurs
      di bawah ini contoh untuk memulai.
    </p>
    <ul class="mt-5 grid gap-3 sm:grid-cols-2">
      {#each DESTINASI as d (d.code)}
        <li class="panel p-4">
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-body">{d.negara}</p>
            <span class="num text-small text-muted">{d.currency} · {idr(d.kurs)}</span>
          </div>
          <p class="mt-1 text-small text-muted">{d.ringkas}</p>
          <button type="button" class="link mt-2 text-small" onclick={() => setDestinasi(idx, d.code)}>Pakai untuk kaki ini</button>
        </li>
      {/each}
    </ul>
  </section>
</article>
