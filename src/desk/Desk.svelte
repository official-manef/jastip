<script lang="ts">
  import { onMount } from "svelte";
  import { authedFetch, loadMe, session } from "../lib/titip/session.svelte";
  import { parseTrip, TRIP_STORAGE_KEY, type TripState } from "../lib/titip/trip-state";
  import { computeTrip, DIR_META, scenarioFor, type CapexLine, type Dir, type Good, type Scenario, type TripMode } from "../lib/titip/calc";
  import { idr, kg } from "../lib/titip/model";

  const control =
    "min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none placeholder:text-muted";

  let dir = $state<Dir>("cgk-ist");
  let mode = $state<TripMode>("one");
  let byDir = $state<Record<Dir, Scenario>>({
    "cgk-ist": scenarioFor("cgk-ist"),
    "ist-cgk": scenarioFor("ist-cgk"),
  });
  let source = $state("Memuat kalkulasi…");
  let syncFailed = $state(false);
  let initialized = false;
  let revision = 0;
  let saving = false;
  let queued = false;
  let localSaved = false;
  const controller = new AbortController();

  function snapshot(): TripState {
    return { dir, mode, cgkIst: byDir["cgk-ist"], istCgk: byDir["ist-cgk"] };
  }

  function restore(trip: TripState) {
    dir = trip.dir;
    mode = trip.mode;
    byDir = { "cgk-ist": trip.cgkIst, "ist-cgk": trip.istCgk };
  }

  function persistLocal() {
    try {
      const key = session.user ? `${TRIP_STORAGE_KEY}:${session.user.id}` : TRIP_STORAGE_KEY;
      localStorage.setItem(key, JSON.stringify(snapshot()));
      localSaved = true;
    } catch { localSaved = false; }
  }

  async function syncAccount() {
    if (!session.user || !initialized || controller.signal.aborted) return;
    queued = true;
    if (saving) return;
    saving = true;
    try {
      while (queued && !controller.signal.aborted) {
        queued = false;
        const savingRevision = revision;
        source = "Menyimpan ke akun…";
        try {
          const response = await authedFetch("/api/trip", {
            method: "PUT", body: JSON.stringify(snapshot()),
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          });
          if (!response.ok) throw new Error("save");
          syncFailed = false;
          if (revision === savingRevision) source = "Tersimpan di akun pribadi.";
        } catch {
          if (controller.signal.aborted) return;
          syncFailed = true;
          source = localSaved ? "Tersimpan di perangkat; sinkronisasi akun gagal." : "Belum tersimpan. Coba sinkronisasi lagi.";
          // A later edit or explicit retry can try again without a retry loop.
          queued = false;
        }
      }
    } finally { saving = false; }
  }

  onMount(() => {
    void (async () => {
      await loadMe();
      if (controller.signal.aborted) return;
      try {
        const key = session.user ? `${TRIP_STORAGE_KEY}:${session.user.id}` : TRIP_STORAGE_KEY;
        const trip = parseTrip(JSON.parse(localStorage.getItem(key) || "null"));
        if (trip && revision === 0) restore(trip);
      } catch { /* Corrupt or unavailable device storage leaves the calculator usable. */ }
      persistLocal();
      source = localSaved ? "Tersimpan di perangkat ini." : "Penyimpanan perangkat tidak tersedia. Kalkulasi belum tersimpan.";
      if (session.user) {
        const loadingRevision = revision;
        try {
          const response = await authedFetch("/api/trip", {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          });
          if (!response.ok) throw new Error("load");
          const data = await response.json();
          const trip = parseTrip(data.trip);
          if (controller.signal.aborted) return;
          if (trip && loadingRevision === 0 && revision === 0) {
            restore(trip);
            persistLocal();
            source = "Tersimpan di akun pribadi.";
          }
        } catch {
          if (controller.signal.aborted) return;
          syncFailed = true;
          source = localSaved ? "Tersimpan di perangkat; akun belum dapat dimuat." : "Akun belum dapat dimuat. Kalkulasi belum tersimpan.";
        }
      }
      initialized = true;
      if (revision > 0) { persistLocal(); void syncAccount(); }
    })();
    return () => controller.abort();
  });

  let draftName = $state("");
  let draftKg = $state("0,5");
  let draftBeli = $state("");
  let draftNotice = $state("");

  const scenario = $derived(byDir[dir]);
  const meta = $derived(DIR_META[dir]);
  const other = $derived<Dir>(dir === "cgk-ist" ? "ist-cgk" : "cgk-ist");
  const n = $derived(computeTrip(mode, dir, byDir));
  const tiketHere = $derived(scenario.opex.find((line) => line.id === "tiket")?.label ?? "Tiket");
  const tiketThere = $derived(byDir[other].opex.find((line) => line.id === "tiket")?.label ?? "Tiket lawan");
  const over = $derived(n.sisa < 0);

  function commit() {
    revision += 1;
    if (!initialized) return;
    persistLocal();
    source = localSaved ? "Tersimpan di perangkat ini." : "Penyimpanan perangkat tidak tersedia. Kalkulasi belum tersimpan.";
    void syncAccount();
  }

  function patch(partial: Partial<Scenario>) {
    byDir = { ...byDir, [dir]: { ...byDir[dir], ...partial } };
    commit();
  }

  function patchDir(target: Dir, partial: Partial<Scenario>) {
    byDir = { ...byDir, [target]: { ...byDir[target], ...partial } };
    commit();
  }

  function setGood(id: string, partial: Partial<Good>) {
    if (partial.qty !== undefined) partial.qty = Math.min(10_000, Math.max(0, Math.round(partial.qty)));
    byDir = {
      ...byDir,
      [dir]: {
        ...byDir[dir],
        goods: byDir[dir].goods.map((g) => (g.id === id ? { ...g, ...partial } : g)),
      },
    };
    commit();
  }

  function addGood(good: Good) {
    byDir = { ...byDir, [dir]: { ...byDir[dir], goods: [...byDir[dir].goods, good] } };
    commit();
  }

  function removeGood(id: string) {
    byDir = {
      ...byDir,
      [dir]: { ...byDir[dir], goods: byDir[dir].goods.filter((g) => g.id !== id) },
    };
    commit();
  }

  function setOpex(id: string, amount: number) {
    if (!Number.isFinite(amount)) return;
    amount = Math.min(1_000_000_000_000, Math.max(0, amount));
    byDir = {
      ...byDir,
      [dir]: {
        ...byDir[dir],
        opex: byDir[dir].opex.map((line) => (line.id === id ? { ...line, amount } : line)),
      },
    };
    commit();
  }

  function applyCapex(lines: CapexLine[], id: string, partial: Partial<CapexLine>) {
    return lines.map((line) => (line.id === id ? { ...line, ...partial } : line));
  }

  function setCapex(id: string, partial: Partial<CapexLine>) {
    if (partial.price !== undefined) partial.price = Math.min(1_000_000_000_000, Math.max(0, partial.price));
    if (partial.trips !== undefined) partial.trips = Math.min(10_000, Math.max(1, Math.round(partial.trips)));
    if (mode === "pp") {
      byDir = {
        "cgk-ist": { ...byDir["cgk-ist"], capex: applyCapex(byDir["cgk-ist"].capex, id, partial) },
        "ist-cgk": { ...byDir["ist-cgk"], capex: applyCapex(byDir["ist-cgk"].capex, id, partial) },
      };
    } else {
      byDir = { ...byDir, [dir]: { ...byDir[dir], capex: applyCapex(byDir[dir].capex, id, partial) } };
    }
    commit();
  }

  function setMode(next: TripMode) {
    mode = next;
    if (next === "pp") {
      const capex = byDir[dir].capex;
      byDir = {
        "cgk-ist": { ...byDir["cgk-ist"], capex },
        "ist-cgk": { ...byDir["ist-cgk"], capex },
      };
    }
    commit();
  }

  function resetDir() {
    const next = scenarioFor(dir);
    const copy = { ...byDir, [dir]: next };
    if (mode === "pp") copy[other] = { ...copy[other], capex: next.capex };
    byDir = copy;
    commit();
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
        {#if syncFailed}<button type="button" class="mt-2 min-h-11 text-sm text-primary underline" onclick={() => void syncAccount()}>Coba simpan ke akun lagi</button>{/if}
      </div>
      <div class="flex flex-col items-stretch gap-2 sm:items-end">
        <div class="flex flex-wrap rounded-full border border-border bg-surface p-1" role="group" aria-label="Arah rute">
          {@render seg(dir === "cgk-ist", "Jakarta → Turki", () => { dir = "cgk-ist"; commit(); })}
          {@render seg(dir === "ist-cgk", "Turki → Jakarta", () => { dir = "ist-cgk"; commit(); })}
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
        <p class="text-sm text-muted tabular-nums">{kg(n.terpakai)} terpakai</p>
      </div>
      <ul class="mt-3 divide-y divide-line">
        {#each scenario.goods as g (g.id)}
          <li class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
            <div class="min-w-0">
              <p class="truncate font-medium">{g.name}</p>
              <p class="text-xs text-muted tabular-nums">
                {kg(g.kg)} × {g.qty} = {kg(g.kg * g.qty)}
                · beli {meta.shop === "TRY" ? `₺${g.beli}` : idr(g.beli)}
              </p>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" aria-label="Kurangi" class="grid size-11 place-items-center rounded-full border border-border text-lg" onclick={() => setGood(g.id, { qty: Math.max(0, g.qty - 1) })}>−</button>
              <span class="w-6 text-center text-sm tabular-nums">{g.qty}</span>
              <button type="button" aria-label="Tambah" class="grid size-11 place-items-center rounded-full border border-border text-lg" onclick={() => setGood(g.id, { qty: g.qty + 1 })}>+</button>
              <button type="button" class="min-h-11 px-2 text-sm text-muted" onclick={() => removeGood(g.id)}>Hapus</button>
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
          {idr(n.pendapatan)} jasa{mode === "pp" ? " dua kaki" : ""} − {idr(n.beban)} beban. Impas di {kg(n.breakEvenKg)}. Sisa kuota kaki ini masih senilai {idr(n.potensi)}.
        </p>
      </div>
    </div>
  </aside>
</div>
