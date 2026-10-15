<script lang="ts">
  import { onMount } from "svelte";
  import {
    desk,
    initDesk,
    patch,
    patchDir,
    resetDir,
    retrySync,
    setCapex,
    setDir,
    setGood,
    setMode,
    setOpex,
    setPricing,
    clearPricing,
    addGood,
    removeGood,
  } from "../lib/titip/trip-store.svelte";
  import { computeTrip, DIR_META, type CapexLine, type Dir, type LinePricing, type TripMode } from "../lib/titip/calc";
  import { capacity, computeRevenue, CURRENCIES, ITEM_UNITS, lineWeightKg, targetProgress } from "../lib/titip/pricing";
  import { idr, kg } from "../lib/titip/model";

  const field = "field";
  const btn = "btn";

  const dir = $derived(desk.dir);
  const mode = $derived(desk.mode);
  const byDir = $derived(desk.byDir);
  const source = $derived(desk.source);
  const syncFailed = $derived(desk.syncFailed);
  const conflict = $derived(desk.conflict);

  onMount(() => { initDesk(); });

  let draftName = $state("");
  let draftKg = $state("0,5");
  let draftBeli = $state("");
  let draftNotice = $state("");

  const scenario = $derived(byDir[dir]);
  const meta = $derived(DIR_META[dir]);
  const other = $derived<Dir>(dir === "cgk-ist" ? "ist-cgk" : "cgk-ist");
  const n = $derived(computeTrip(mode, dir, byDir));
  const rev = $derived(computeRevenue(scenario.goods, scenario.hargaPerKg, meta.shop === "TRY" ? "TRY" : "IDR"));
  const progres = $derived(targetProgress(rev.service, scenario.target ?? 0));
  const kapasitas = $derived(capacity(n.bersih, rev.totalKg));
  const punyaTarif = $derived(rev.hasPricing);
  const tarifKosong = $derived(rev.rows.filter((r) => (scenario.goods.find((g) => g.id === r.id)?.pricing?.rate ?? 0) <= 0).length);
  const asumsi = $derived(tarifKosong > 0 || rev.needsRate);
  const rowById = $derived(new Map(rev.rows.map((r) => [r.id, r])));
  const tiketHere = $derived(scenario.opex.find((line) => line.id === "tiket")?.label ?? "Tiket");
  const tiketThere = $derived(byDir[other].opex.find((line) => line.id === "tiket")?.label ?? "Tiket lawan");
  const over = $derived(n.sisa < 0);

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
    <input
      type="range"
      {min}
      {max}
      {step}
      {value}
      oninput={(e) => {
        const next = Number(e.currentTarget.value);
        onChange(step < 1 ? Math.round(next * 10) / 10 : next);
      }}
      class="w-full"
    />
  </label>
{/snippet}

{#snippet seg(pressed: boolean, label: string, onPick: () => void)}
  <button
    type="button"
    aria-pressed={pressed}
    onclick={onPick}
    class="min-h-11 rounded px-4 text-body {pressed ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-field'}"
  >
    {label}
  </button>
{/snippet}

{#snippet row(k: string, v: string, hint?: string)}
  <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
    <dt class="text-body">
      {k}
      {#if hint}<span class="block text-small text-muted">{hint}</span>{/if}
    </dt>
    <dd class="num shrink-0 text-body">{v}</dd>
  </div>
{/snippet}

<article class="pb-4">
  <header class="max-w-[40rem]" data-rise style="--i: 0">
    <h1>{meta.from} → {meta.to}</h1>
    <p class="mt-4 text-lead text-fg">
      {mode === "pp"
        ? "Pulang-pergi. Tiket dan opex kedua kaki dijumlahkan; capex tetap sekali."
        : `${meta.blurb} Hanya tiket dan opex arah ini yang dihitung.`}
    </p>
    <div class="mt-6 flex flex-wrap items-center gap-3">
      <button type="button" class={btn} onclick={focusDraft}>Tambah barang</button>
      <a class="link text-body" href="/portal">Lihat portal contoh</a>
    </div>
    <p class="mt-4 text-small text-muted" role="status">{source}</p>
    {#if syncFailed}<button type="button" class="link mt-2 block text-body" onclick={() => retrySync()}>Coba simpan ke akun lagi</button>{/if}
    {#if conflict}<button type="button" class="link mt-2 block text-body" onclick={() => window.location.reload()}>Muat ulang trip dari akun</button>{/if}
  </header>

  <div class="mt-10 flex flex-wrap gap-2" role="group" aria-label="Pengaturan tampilan" data-rise style="--i: 1">
    <div class="flex flex-wrap gap-1 rounded bg-surface p-1" role="group" aria-label="Arah rute">
      {@render seg(dir === "cgk-ist", "Jakarta → Turki", () => setDir("cgk-ist"))}
      {@render seg(dir === "ist-cgk", "Turki → Jakarta", () => setDir("ist-cgk"))}
    </div>
    <div class="flex flex-wrap gap-1 rounded bg-surface p-1" role="group" aria-label="Jenis trip">
      {@render seg(mode === "one", "Pergi saja", () => setMode("one"))}
      {@render seg(mode === "pp", "Pulang-pergi", () => setMode("pp"))}
    </div>
  </div>

  <!-- The instrument: the one large thing, sticky while the load is edited. -->
  <section class="panel mt-6 p-5" data-rise data-ui style="--i: 2" aria-label="Sisa kuota dan laba">
    <p class="readout {over ? 'text-accent' : 'text-fg'}">
      {over ? `−${kg(n.overKg)}` : kg(Math.max(0, n.sisa))}
    </p>
    <p class="mt-2 text-body">
      {over ? "kelebihan bagasi" : "sisa kuota bersih"} · {kg(n.terpakai)} terpakai dari {kg(n.bersih)}
    </p>
    <div class="meter mt-4" aria-hidden="true">
      <span style="width: {Math.round(n.penuh * 100)}%; background: {over ? 'var(--color-accent)' : ''}"></span>
    </div>

    <dl class="mt-6 grid gap-3 sm:grid-cols-2">
      {@render row("Muat lagi", `${n.pcsUji} pcs`, `pcs ${kg(scenario.ujiKg)}`)}
      {@render row("Harga jual / kg", idr(scenario.hargaPerKg))}
      {@render row("Modal / kg", idr(n.modalPerKg), mode === "pp" ? "beban trip / kuota dua kaki" : "opex + capex / kuota")}
      {@render row("Saran jual / kg", idr(n.saranPerKg), `margin ${scenario.margin}%`)}
    </dl>

    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      <label class="block">
        <span class="mb-2 flex items-baseline justify-between gap-3">
          <span>Harga per kg</span>
          <span class="num text-body">{idr(scenario.hargaPerKg)}</span>
        </span>
        <input type="range" min="50000" max="2000000" step="10000" value={scenario.hargaPerKg} oninput={(e) => patch({ hargaPerKg: Number(e.currentTarget.value) })} class="w-full" />
      </label>
      <label class="block">
        <span class="mb-2 flex items-baseline justify-between gap-3">
          <span>Target margin</span>
          <span class="num text-body">{scenario.margin}%</span>
        </span>
        <input type="range" min="0" max="120" step="5" value={scenario.margin} oninput={(e) => patch({ margin: Number(e.currentTarget.value) })} class="w-full" />
      </label>
    </div>
    <button type="button" class="btn-quiet mt-4 w-full" onclick={() => patch({ hargaPerKg: n.saranPerKg })}>
      Pakai harga saran
    </button>

    <dl class="mt-6 grid gap-3 sm:grid-cols-2">
      {@render row("Omzet jasa", `${fmtTarif(rev.service)}${rev.currencies.length === 1 ? ` ${rev.currencies[0]}` : ""}`, punyaTarif ? "dari tarif per baris" : "tarif global / kg")}
      {@render row("Berat baris", kg(rev.totalKg), "presisi per baris")}
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
        <input
          type="number"
          min="0"
          step="50"
          value={scenario.target ?? 0}
          class="{field} num"
          aria-label="Target omzet jasa"
          oninput={(e) => patch({ target: Math.max(0, Number(e.currentTarget.value)) })}
        />
      </label>
      <label class="block">
        <span class="mb-2 block">Mata uang target</span>
        <select
          value={scenario.hargaCurrency ?? meta.shop}
          class={field}
          aria-label="Mata uang target"
          onchange={(e) => patch({ hargaCurrency: e.currentTarget.value })}
        >
          {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
        </select>
      </label>
    </div>
    {#if asumsi}
      <p class="mt-3 text-small text-accent" role="status">
        Proyeksi potensi & impas memakai tarif asumsi global; {tarifKosong > 0 ? `${tarifKosong} baris belum bertarif` : "baris bercampur mata uang tanpa kurs"}. Bukan laporan final.
      </p>
    {/if}

    <div class="panel-deep mt-6 p-4">
      <div class="flex items-end justify-between gap-3">
        <span class="text-body">{mode === "pp" ? "Laba trip" : "Laba bawa"}</span>
        <span class="num text-lead {n.laba < 0 ? 'text-accent' : 'text-fg'}">{idr(n.laba)}</span>
      </div>
      <p class="mt-3 text-small">
        {idr(n.pendapatan)} jasa{mode === "pp" ? " dua kaki" : ""} − {idr(n.beban)} beban. Impas di {kg(n.breakEvenKg)}. Sisa kuota kaki ini {asumsi ? "berpotensi" : ""} {idr(n.potensi)}.
      </p>
    </div>
  </section>

  <section class="mt-14" aria-labelledby="bagasi">
    <h2 id="bagasi" data-reveal>Kuota bagasi</h2>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
      {@render slider("Koper check-in", scenario.bags, 0, 3, 1, `${scenario.bags} koper`, (bags) => patch({ bags }))}
      {@render slider("Kg per koper", scenario.kgPerBag, 10, 40, 1, kg(scenario.kgPerBag), (kgPerBag) => patch({ kgPerBag }))}
      {@render slider("Kabin", scenario.cabin, 0, 12, 1, kg(scenario.cabin), (cabin) => patch({ cabin }))}
      {@render slider("Tara koper & pribadi", scenario.tare, 0, 12, 0.1, kg(scenario.tare), (tare) => patch({ tare }))}
      {@render slider("Denda kelebihan / kg", scenario.overPerKg, 0, 800000, 10000, idr(scenario.overPerKg), (overPerKg) => patch({ overPerKg }))}
      {@render slider("Uji muat 1 pcs", scenario.ujiKg, 0.1, 3, 0.1, kg(scenario.ujiKg), (ujiKg) => patch({ ujiKg }))}
    </div>
  </section>

  <section class="mt-14" aria-labelledby="muatan">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id="muatan" data-reveal>Muatan</h2>
      <p class="num text-body text-muted" data-reveal>
        {kg(n.terpakai)} terpakai · {idr(n.pendapatan)} jasa
      </p>
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
                {kg(g.kg)} × {g.qty} = {kg(lineWeightKg(g))} · beli {meta.shop === "TRY" ? `₺${g.beli}` : idr(g.beli)}
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
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={tarif.rate}
                  class="{field} num w-24"
                  aria-label="Tarif {g.name}"
                  oninput={(e) => setPricing(g.id, { rate: Math.max(0, Number(e.currentTarget.value)) })}
                />
              </label>
              {#if tarif.model === "per_item"}
                <label class="flex items-center gap-2 text-small text-muted">
                  Satuan
                  <select
                    value={tarif.unit ?? "unit"}
                    class="{field} w-28"
                    aria-label="Satuan {g.name}"
                    onchange={(e) => setPricing(g.id, { unit: e.currentTarget.value })}
                  >
                    {#each ITEM_UNITS as u (u)}<option value={u}>{u}</option>{/each}
                  </select>
                </label>
              {/if}
              <label class="flex items-center gap-2 text-small text-muted">
                Mata uang
                <select
                  value={tarif.currency ?? meta.shop}
                  class="{field} w-24"
                  aria-label="Mata uang {g.name}"
                  onchange={(e) => setPricing(g.id, { currency: e.currentTarget.value })}
                >
                  {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
                </select>
              </label>
              {#if (tarif.rate ?? 0) <= 0}
                <span class="text-small text-accent">tarif belum ditetapkan</span>
              {/if}
            {/if}
          </div>
        </li>
      {/each}
    </ul>

    <form
      class="panel mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_6rem_7rem_auto]"
      onsubmit={(e) => { e.preventDefault(); addDraft(); }}
    >
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
        <input bind:value={draftBeli} inputmode="numeric" placeholder={meta.shop === "TRY" ? "₺" : "Rp"} class="{field} num" aria-label="Harga beli" />
      </label>
      <button type="submit" class="btn self-end">Tambah</button>
    </form>
    {#if draftNotice}<p class="mt-3 text-body text-accent" role="status">{draftNotice}</p>{/if}
  </section>

  <section class="mt-14" aria-labelledby="opex">
    <h2 id="opex" data-reveal>{mode === "pp" ? "Opex kaki ini" : "Opex trip ini"}</h2>
    <p class="num mt-2 text-body text-muted" data-reveal>
      {mode === "pp"
        ? `Tiket total ${idr(n.tiketTotal)} · kaki ini ${idr(n.tiket)} + lawan ${idr(n.tiketLawan)}`
        : `Tiket ${idr(n.tiket)}`}
    </p>
    <ul class="mt-5 flex flex-col gap-2">
      {#each scenario.opex as line (line.id)}
        <li class="flex items-center justify-between gap-3">
          <label class="text-body" for={"opex-" + line.id}>{line.label}</label>
          <input
            id={"opex-" + line.id}
            type="number"
            value={line.amount}
            min="0"
            step="50000"
            class="{field} num w-40"
            oninput={(e) => setOpex(line.id, Number(e.currentTarget.value))}
          />
        </li>
      {/each}
    </ul>
    {#if dir === "ist-cgk" || mode === "pp"}
      <label class="mt-5 block">
        <span class="mb-2 flex items-baseline justify-between gap-3">
          <span>Kurs 1 TRY</span>
          <span class="num text-body">{idr(byDir["ist-cgk"].kursTry)}</span>
        </span>
        <input
          type="range"
          min="200"
          max="900"
          step="10"
          value={byDir["ist-cgk"].kursTry}
          oninput={(e) => patchDir("ist-cgk", { kursTry: Number(e.currentTarget.value) })}
          class="w-full"
        />
      </label>
    {/if}
  </section>

  <section class="mt-14" aria-labelledby="capex">
    <h2 id="capex" data-reveal>Capex, dibagi per trip</h2>
    {#if mode === "pp"}<p class="mt-2 text-body text-muted" data-reveal>Pulang-pergi tetap dihitung 1 trip.</p>{/if}
    <ul class="mt-5 flex flex-col gap-3">
      {#each scenario.capex as line (line.id)}
        <li class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_7rem] sm:items-end">
          <p class="text-body">
            {line.label}
            <span class="num mt-1 block text-small text-muted">
              {idr(Math.round(line.price / Math.max(1, line.trips)))} / trip
            </span>
          </p>
          <label class="block">
            <span class="mb-2 block text-small text-muted">Harga alat</span>
            <input id={"capex-price-" + line.id} type="number" value={line.price} min="0" class="{field} num" oninput={(e) => setCapex(line.id, { price: Number(e.currentTarget.value) })} />
          </label>
          <label class="block">
            <span class="mb-2 block text-small text-muted">Umur trip</span>
            <input id={"capex-trips-" + line.id} type="number" value={line.trips} min="1" class="{field} num" oninput={(e) => setCapex(line.id, { trips: Math.max(1, Number(e.currentTarget.value)) })} />
          </label>
        </li>
      {/each}
    </ul>
    <button type="button" class="link mt-5 block text-body" onclick={resetDir}>Reset arah ini ke skenario contoh</button>
  </section>

  <section class="mt-14" aria-labelledby="rute">
    <h2 id="rute" data-reveal>Rute yang dihitung</h2>
    <p class="mt-3 text-body text-muted" data-reveal>
      Satu koridor saja: Jakarta (CGK) dan Istanbul (IST). Foto di bawah ini adalah rute sungguhan, bukan
      hasil produk Titipin. Semua angka di meja adalah skenario contoh.
    </p>

    <!-- Signature move: the atmosphere crossfades like light shifting. -->
    <div class="crossfade relative mt-6 aspect-[16/10] overflow-hidden rounded bg-surface" data-reveal aria-hidden="true">
      <img class="absolute inset-0 size-full object-cover" src="/img/terminal3soekarnohatt.jpg" alt="" width="1920" height="1503" />
      <img class="absolute inset-0 size-full object-cover" src="/img/istanbul-bosphorus-ferry.jpg" alt="" width="1920" height="1080" loading="lazy" />
      <img class="absolute inset-0 size-full object-cover" src="/img/soetta-skytrain-9.jpg" alt="" width="1920" height="1280" loading="lazy" />
    </div>

    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      <figure data-reveal>
        <img class="w-full rounded object-cover" src="/img/sultanahmet-ferry-on-the-bosphorus-in-istanbul.jpg" alt="Kapal feri Sultanahmet di Selat Bosphorus, Istanbul" width="1920" height="1275" loading="lazy" decoding="async" />
        <figcaption class="mt-2 text-small text-muted">
          Feri di Bosphorus, sisi Istanbul dari rute. "Sultanahmet ferry on the Bosphorus", Moonik, CC BY-SA 3.0, Wikimedia Commons.
        </figcaption>
      </figure>
      <figure data-reveal>
        <video class="w-full rounded" autoplay muted loop playsinline preload="metadata" poster="/img/a-ferry-in-the-bosphorus-20251015-poster.jpg" width="854" height="480" aria-label="Feri berlayar di Selat Bosphorus">
          <source src="/img/a-ferry-in-the-bosphorus-20251015.webm" type="video/webm" />
        </video>
        <figcaption class="mt-2 text-small text-muted">
          Feri berlayar, siang hari. "A ferry in the Bosphorus", Kurmanbek, CC BY-SA 4.0, Wikimedia Commons.
        </figcaption>
      </figure>
    </div>
  </section>
</article>
