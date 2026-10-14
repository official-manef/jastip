<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "../lib/titip/session.svelte";
  import { desk, initDesk, patch, patchDir, resetDir, retrySync, setCapex, setDir, setGood, setMode, setOpex, setPricing, clearPricing, addGood, removeGood } from "../lib/titip/trip-store.svelte";
  import { computeTrip, DIR_META, type CapexLine, type Dir, type Good, type LinePricing, type PricingModel, type Scenario, type TripMode } from "../lib/titip/calc";
  import { capacity, computeRevenue, CURRENCIES, ITEM_UNITS, lineWeightKg, targetProgress } from "../lib/titip/pricing";
  import { idr, kg } from "../lib/titip/model";

  const control =
    "min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none placeholder:text-muted";

  // State trip hidup di trip-store supaya asisten AI bisa mengubahnya juga.
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
</script>

{#snippet slider(label: string, value: number, min: number, max: number, step: number, shown: string, onChange: (n: number) => void)}
  <label class="block text-sm">
    <span class="mb-1 flex justify-between gap-3">
      <span class="font-medium">{label}</span>
      <span class="tabular-nums">{shown}</span>
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
    class="min-h-11 rounded-full px-3 text-sm font-medium {pressed ? 'bg-primary text-primary-fg' : 'text-muted'}"
  >
    {label}
  </button>
{/snippet}

{#snippet row(k: string, v: string, hint?: string)}
  <div class="flex items-baseline justify-between gap-3">
    <dt class="text-muted">
      {k}
      {#if hint}<span class="mt-0.5 block text-xs">{hint}</span>{/if}
    </dt>
    <dd class="shrink-0 tabular-nums">{v}</dd>
  </div>
{/snippet}

<div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
  <div class="order-2 space-y-4 lg:order-1">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl leading-tight sm:text-4xl">{meta.from} → {meta.to}</h1>
        <p class="text-sm text-muted">
          {mode === "pp"
            ? "Pulang-pergi. Tiket dan opex kedua kaki dijumlahkan. Capex tetap sekali."
            : `${meta.blurb} Hanya tiket dan opex arah ini.`}
        </p>
        <p class="mt-1 text-xs text-muted" role="status">
          {source}
        </p>
        {#if syncFailed}<button type="button" class="mt-2 min-h-11 text-sm text-primary underline" onclick={() => retrySync()}>Coba simpan ke akun lagi</button>{/if}
        {#if conflict}<button type="button" class="mt-2 min-h-11 text-sm text-accent underline" onclick={() => window.location.reload()}>Muat ulang trip dari akun</button>{/if}
      </div>
      <div class="flex flex-col items-stretch gap-2 sm:items-end">
        <div class="flex flex-wrap rounded-full border border-border bg-surface p-1" role="group" aria-label="Arah rute">
          {@render seg(dir === "cgk-ist", "Jakarta → Turki", () => setDir("cgk-ist"))}
          {@render seg(dir === "ist-cgk", "Turki → Jakarta", () => setDir("ist-cgk"))}
        </div>
        <div class="flex flex-wrap rounded-full border border-border bg-surface p-1" role="group" aria-label="Jenis trip">
          {@render seg(mode === "one", "Pergi saja", () => setMode("one"))}
          {@render seg(mode === "pp", "PP", () => setMode("pp"))}
        </div>
      </div>
    </div>

    <section class="rounded-3xl border border-border bg-surface p-4">
      <h2 class="text-2xl">Kuota bagasi</h2>
      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        {@render slider("Koper check-in", scenario.bags, 0, 3, 1, `${scenario.bags} koper`, (bags) => patch({ bags }))}
        {@render slider("Kg per koper", scenario.kgPerBag, 10, 40, 1, kg(scenario.kgPerBag), (kgPerBag) => patch({ kgPerBag }))}
        {@render slider("Kabin", scenario.cabin, 0, 12, 1, kg(scenario.cabin), (cabin) => patch({ cabin }))}
        {@render slider("Tara koper & pribadi", scenario.tare, 0, 12, 0.1, kg(scenario.tare), (tare) => patch({ tare }))}
        {@render slider("Denda kelebihan / kg", scenario.overPerKg, 0, 800000, 10000, idr(scenario.overPerKg), (overPerKg) => patch({ overPerKg }))}
        {@render slider("Uji muat 1 pcs", scenario.ujiKg, 0.1, 3, 0.1, kg(scenario.ujiKg), (ujiKg) => patch({ ujiKg }))}
      </div>
    </section>

    <section class="rounded-3xl border border-border bg-surface p-4">
      <div class="flex items-baseline justify-between gap-3">
        <h2 class="text-2xl">Muatan</h2>
        <p class="text-sm text-muted tabular-nums">
          {kg(n.terpakai)} terpakai · {idr(n.pendapatan)} jasa
        </p>
      </div>
      <ul class="mt-3 divide-y divide-line">
        {#each scenario.goods as g (g.id)}
          {@const r = rowById.get(g.id)}
          {@const tarif = g.pricing}
          <li class="py-3">
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium">{g.name}</p>
                <p class="text-xs text-muted tabular-nums">
                  {kg(g.kg)} × {g.qty} = {kg(lineWeightKg(g))}
                  · beli {meta.shop === "TRY" ? `₺${g.beli}` : idr(g.beli)}
                  {#if r && tarif}
                    · <span class="text-primary">{pickTarifLabel(tarif)} = {fmtTarif(r.service)}</span>
                  {:else}
                    · <span class="text-muted">tarif global {idr(r?.rate ?? scenario.hargaPerKg)}/kg</span>
                  {/if}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" aria-label="Kurangi" class="grid size-11 place-items-center rounded-full border border-border text-lg" onclick={() => setGood(g.id, { qty: Math.max(0, g.qty - 1) })}>−</button>
                <span class="w-6 text-center text-sm tabular-nums">{g.qty}</span>
                <button type="button" aria-label="Tambah" class="grid size-11 place-items-center rounded-full border border-border text-lg" onclick={() => setGood(g.id, { qty: g.qty + 1 })}>+</button>
                <button type="button" class="min-h-11 px-2 text-sm text-muted" onclick={() => removeGood(g.id)}>Hapus</button>
              </div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <div class="flex rounded-full border border-border bg-bg p-0.5" role="group" aria-label="Model tarif {g.name}">
                <button type="button" aria-pressed={!tarif} class="min-h-8 rounded-full px-2 {!tarif ? 'bg-primary text-primary-fg' : 'text-muted'}" onclick={() => clearPricing(g.id)}>Global</button>
                <button type="button" aria-pressed={tarif?.model === "per_kg"} class="min-h-8 rounded-full px-2 {tarif?.model === 'per_kg' ? 'bg-primary text-primary-fg' : 'text-muted'}" onclick={() => setPricing(g.id, { model: "per_kg" })}>Per kg</button>
                <button type="button" aria-pressed={tarif?.model === "per_item"} class="min-h-8 rounded-full px-2 {tarif?.model === 'per_item' ? 'bg-primary text-primary-fg' : 'text-muted'}" onclick={() => setPricing(g.id, { model: "per_item" })}>Per item</button>
              </div>
              {#if tarif}
                <label class="flex items-center gap-1 text-muted">
                  Tarif
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tarif.rate}
                    class="{control} w-24 py-1 text-xs tabular-nums"
                    aria-label="Tarif {g.name}"
                    oninput={(e) => setPricing(g.id, { rate: Math.max(0, Number(e.currentTarget.value)) })}
                  />
                </label>
                {#if tarif.model === "per_item"}
                  <label class="flex items-center gap-1 text-muted">
                    Satuan
                    <select
                      value={tarif.unit ?? "unit"}
                      class="{control} w-24 py-1 text-xs"
                      aria-label="Satuan {g.name}"
                      onchange={(e) => setPricing(g.id, { unit: e.currentTarget.value })}
                    >
                      {#each ITEM_UNITS as u (u)}<option value={u}>{u}</option>{/each}
                    </select>
                  </label>
                {/if}
                <label class="flex items-center gap-1 text-muted">
                  Mata uang
                  <select
                    value={tarif.currency ?? meta.shop}
                    class="{control} w-20 py-1 text-xs"
                    aria-label="Mata uang {g.name}"
                    onchange={(e) => setPricing(g.id, { currency: e.currentTarget.value })}
                  >
                    {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
                  </select>
                </label>
                {#if (tarif.rate ?? 0) <= 0}
                  <span class="text-accent">tarif belum ditetapkan</span>
                {/if}
              {/if}
            </div>
          </li>
        {/each}
      </ul>
      <form
        class="mt-2 grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]"
        onsubmit={(e) => { e.preventDefault(); addDraft(); }}
      >
        <input bind:value={draftName} placeholder="Barang baru" class={control} aria-label="Nama barang" />
        <input bind:value={draftKg} inputmode="decimal" class={control} aria-label="Kg per pcs" />
        <input bind:value={draftBeli} inputmode="numeric" placeholder={meta.shop === "TRY" ? "₺" : "Rp"} class={control} aria-label="Harga beli" />
        <button type="submit" class="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg">Tambah</button>
      </form>
      {#if draftNotice}<p class="mt-2 text-sm text-accent" role="status">{draftNotice}</p>{/if}
    </section>

    <section class="rounded-3xl border border-border bg-surface p-4">
      <h2 class="text-2xl">{mode === "pp" ? "Opex kaki ini" : "Opex trip ini"}</h2>
      <p class="mt-1 text-sm text-muted tabular-nums">
        {mode === "pp"
          ? `Tiket total ${idr(n.tiketTotal)} · kaki ini ${idr(n.tiket)} + lawan ${idr(n.tiketLawan)}`
          : `Tiket ${idr(n.tiket)}`}
      </p>
      <ul class="mt-3 space-y-2">
        {#each scenario.opex as line (line.id)}
          <li class="flex items-center justify-between gap-3">
            <span class="text-sm">{line.label}</span>
            <input
              type="number"
              value={line.amount}
              min="0"
              step="50000"
              aria-label={line.label}
              class="{control} w-36 tabular-nums"
              oninput={(e) => setOpex(line.id, Number(e.currentTarget.value))}
            />
          </li>
        {/each}
      </ul>
      {#if dir === "ist-cgk" || mode === "pp"}
        <label class="mt-4 block text-sm">
          <span class="mb-1 flex justify-between">
            <span class="font-medium">Kurs 1 TRY</span>
            <span class="tabular-nums">{idr(byDir["ist-cgk"].kursTry)}</span>
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

    <section class="rounded-3xl border border-border bg-surface p-4">
      <h2 class="text-2xl">Capex, dibagi per trip</h2>
      {#if mode === "pp"}<p class="mt-1 text-sm text-muted">Pulang-pergi tetap dihitung 1 trip.</p>{/if}
      <ul class="mt-3 space-y-3">
        {#each scenario.capex as line (line.id)}
          <li class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_6rem] sm:items-end">
            <p class="text-sm font-medium">
              {line.label}
              <span class="mt-0.5 block text-xs font-normal text-muted tabular-nums">
                {idr(Math.round(line.price / Math.max(1, line.trips)))} / trip
              </span>
            </p>
            <label class="block text-xs text-muted">
              Harga alat
              <input type="number" value={line.price} min="0" class="{control} mt-1" oninput={(e) => setCapex(line.id, { price: Number(e.currentTarget.value) })} />
            </label>
            <label class="block text-xs text-muted">
              Umur trip
              <input type="number" value={line.trips} min="1" class="{control} mt-1" oninput={(e) => setCapex(line.id, { trips: Math.max(1, Number(e.currentTarget.value)) })} />
            </label>
          </li>
        {/each}
      </ul>
      <button type="button" class="mt-4 text-sm text-muted" onclick={resetDir}>Reset arah ini</button>
    </section>
  </div>

  <aside class="order-1 lg:sticky lg:top-20 lg:order-2">
    <div class="rounded-3xl border border-border bg-surface p-4 shadow-ticket">
      <p class="text-xs font-medium text-primary">{mode === "pp" ? "PP" : "Pergi saja"} · {meta.code}</p>
      <p class="mt-2 font-display text-4xl leading-none tabular-nums {over ? 'text-accent' : 'text-fg'}">
        {over ? `−${kg(n.overKg)}` : kg(Math.max(0, n.sisa))}
      </p>
      <p class="mt-1 text-sm text-muted">{over ? "kelebihan bagasi" : "sisa kuota bersih"}</p>
      <div class="meter mt-3" aria-hidden="true">
        <span style="width: {Math.round(n.penuh * 100)}%; background: {over ? 'var(--color-accent)' : ''}"></span>
      </div>
      <p class="mt-1 text-xs text-muted tabular-nums">{kg(n.terpakai)} / {kg(n.bersih)} bersih · kotor {kg(n.kotor)}</p>

      <dl class="mt-4 space-y-2 text-sm">
        {@render row("Muat lagi", `${n.pcsUji} pcs`, `pcs ${kg(scenario.ujiKg)}`)}
        {@render row("Harga jual / kg", idr(scenario.hargaPerKg))}
        {@render row("Modal / kg", idr(n.modalPerKg), mode === "pp" ? "beban trip / kuota dua kaki" : "opex + capex / kuota")}
        {@render row("Saran jual / kg", idr(n.saranPerKg), `margin ${scenario.margin}%`)}
      </dl>

      <label class="mt-4 block text-sm">
        <span class="mb-1 flex justify-between font-medium">
          <span>Harga per kg</span>
          <span class="tabular-nums">{idr(scenario.hargaPerKg)}</span>
        </span>
        <input type="range" min="50000" max="2000000" step="10000" value={scenario.hargaPerKg} oninput={(e) => patch({ hargaPerKg: Number(e.currentTarget.value) })} class="w-full" />
      </label>
      <label class="mt-3 block text-sm">
        <span class="mb-1 flex justify-between">
          <span>Target margin</span>
          <span class="tabular-nums">{scenario.margin}%</span>
        </span>
        <input type="range" min="0" max="120" step="5" value={scenario.margin} oninput={(e) => patch({ margin: Number(e.currentTarget.value) })} class="w-full" />
      </label>
      <button type="button" class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-surface px-4 text-sm font-medium" onclick={() => patch({ hargaPerKg: n.saranPerKg })}>
        Pakai harga saran
      </button>

      <h3 class="mt-5 text-lg">Omzet & target</h3>
      <dl class="mt-2 space-y-2 text-sm">
        {@render row("Omzet jasa", `${fmtTarif(rev.service)}${rev.currencies.length === 1 ? ` ${rev.currencies[0]}` : ""}`, punyaTarif ? "dari tarif per baris" : "tarif global / kg")}
        {@render row("Berat baris", kg(rev.totalKg), "presisi per baris")}
        {#if progres.set}
          {@render row("Target", `${fmtTarif(scenario.target ?? 0)} ${scenario.hargaCurrency ?? "USD"}`, `${progres.persen}% tercapai`)}
          {@render row(progres.achieved ? "Lebih target" : "Butuh lagi", fmtTarif(progres.achieved ? progres.lebih : progres.butuh))}
        {:else}
          {@render row("Target", "belum diatur")}
        {/if}
      </dl>
      <div class="meter mt-3" aria-hidden="true">
        <span style="width: {Math.min(100, Math.max(0, Math.round(progres.persen)))}%"></span>
      </div>
      <label class="mt-3 block text-sm">
        <span class="mb-1 flex justify-between">
          <span>Target omzet jasa</span>
          <span class="tabular-nums">{fmtTarif(scenario.target ?? 0)} {scenario.hargaCurrency ?? "USD"}</span>
        </span>
        <input
          type="number"
          min="0"
          step="50"
          value={scenario.target ?? 0}
          class="{control} tabular-nums"
          aria-label="Target omzet jasa"
          oninput={(e) => patch({ target: Math.max(0, Number(e.currentTarget.value)) })}
        />
      </label>
      <label class="mt-2 block text-sm">
        <span class="mb-1 flex justify-between">
          <span>Mata uang target</span>
        </span>
        <select
          value={scenario.hargaCurrency ?? meta.shop}
          class="{control}"
          aria-label="Mata uang target"
          onchange={(e) => patch({ hargaCurrency: e.currentTarget.value })}
        >
          {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
        </select>
      </label>
      {#if asumsi}
        <p class="mt-2 text-xs text-accent" role="status">
          Proyeksi potensi & impas memakai tarif asumsi global; {tarifKosong > 0 ? `${tarifKosong} baris belum bertarif` : "baris bercampur mata uang tanpa kurs"}. Bukan laporan final.
        </p>
      {/if}

      <h3 class="mt-5 text-lg">Opex & capex</h3>
      <dl class="mt-2 space-y-2 text-sm">
        {@render row(tiketHere, idr(n.tiket))}
        {#if mode === "pp"}{@render row(tiketThere, idr(n.tiketLawan))}{/if}
        {@render row("Tiket total", idr(n.tiketTotal), mode === "pp" ? "pergi + pulang" : "pergi saja")}
        {@render row("Opex lain", idr(n.opexLain), mode === "pp" ? "dua kaki, tanpa tiket" : "tanpa tiket")}
        {@render row("Denda", idr(n.denda), mode === "pp" ? "dua kaki" : n.overKg > 0 ? kg(n.overKg) : "tidak lewat")}
        {@render row("Capex / trip", idr(n.capexTrip), mode === "pp" ? "sekali, bukan dua kali" : undefined)}
        {@render row("Beban terbang", idr(n.beban))}
        {@render row("Modal barang", idr(n.nilaiBeliIdr), mode === "pp" ? "dua kaki" : meta.shop === "TRY" ? "TRY × kurs" : "harga beli")}
      </dl>

      <div class="mt-4 rounded-2xl bg-bg p-3">
        <div class="flex items-end justify-between gap-3">
          <span class="text-sm">{mode === "pp" ? "Laba trip" : "Laba bawa"}</span>
          <span class="font-display text-3xl leading-none tabular-nums {n.laba < 0 ? 'text-accent' : 'text-primary'}">{idr(n.laba)}</span>
        </div>
        <p class="mt-2 text-xs text-muted">
          {idr(n.pendapatan)} jasa{mode === "pp" ? " dua kaki" : ""} − {idr(n.beban)} beban. Impas di {kg(n.breakEvenKg)}. Sisa kuota kaki ini {asumsi ? "berpotensi" : ""} {idr(n.potensi)}.
        </p>
      </div>
    </div>
  </aside>
</div>
