<script lang="ts">
  import { onMount } from "svelte";
  import { computeTrip, DIR_META, feeFor, scenarioFor, type CapexLine, type Dir, type Good, type Scenario, type TripMode } from "../lib/titip/calc";
  import { idr, kg } from "../lib/titip/model";
  import { DRAFTS_KEY, newTrip, parseTripBook, targetProgress, type TripBook, type TripDraft } from "../lib/titip/trip-drafts";
  import { authedFetch, session } from "../lib/titip/session.svelte";

  const control =
    "min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none placeholder:text-muted";

  let dir = $state<Dir>("cgk-ist");
  let mode = $state<TripMode>("one");
  let byDir = $state<Record<Dir, Scenario>>({
    "cgk-ist": scenarioFor("cgk-ist"),
    "ist-cgk": scenarioFor("ist-cgk"),
  });
  let ready = $state(false);
  let source = $state("Memuat trip perangkat…");
  let trips = $state<TripDraft[]>([newTrip("trip-awal", "Trip pertama")]);
  let activeId = $state("trip-awal");
  let tripName = $state("Trip pertama");
  let tripDate = $state("");
  let targetOmzet = $state(0);
  let notice = $state("");
  let cloudBusy = $state(false);
  let cloudRevision = $state(0);
  let cloudOwner = $state<string | null>(null);
  let importInput: HTMLInputElement;

  onMount(() => {
    try {
      const stored = localStorage.getItem(DRAFTS_KEY);
      if (stored) {
        const book = parseTripBook(stored);
        trips = book.trips;
        activate(book.activeId);
      }
      source = "Trip tersimpan di perangkat ini.";
    } catch {
      source = "Penyimpanan perangkat belum dapat dibaca. Ekspor trip untuk membuat cadangan.";
    }
    ready = true;
  });

  $effect(() => {
    const owner = session.user?.id ?? null;
    if (owner !== cloudOwner) { cloudOwner = owner; cloudRevision = 0; }
  });

  let draftName = $state("");
  let draftKg = $state("0,5");
  let draftBeli = $state("");
  let draftFeeMode = $state<"kg" | "item">("kg");
  let draftFeeRate = $state("");

  const scenario = $derived(byDir[dir]);
  const meta = $derived(DIR_META[dir]);
  const other = $derived<Dir>(dir === "cgk-ist" ? "ist-cgk" : "cgk-ist");
  const n = $derived(computeTrip(mode, dir, byDir));
  const tiketHere = $derived(scenario.opex.find((line) => line.id === "tiket")?.label ?? "Tiket");
  const tiketThere = $derived(byDir[other].opex.find((line) => line.id === "tiket")?.label ?? "Tiket lawan");
  const over = $derived(n.sisa < 0);
  const progress = $derived(targetProgress(targetOmzet, n.pendapatan));

  function commit() {
    if (!ready) return;
    trips = trips.map((trip) => trip.id === activeId ? { id: activeId, name: tripName.trim() || "Trip tanpa nama", date: tripDate, targetOmzet, dir, mode, byDir } : trip);
    try {
      const book = parseTripBook(JSON.stringify({ version: 1, activeId, trips }));
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(book));
      source = "Trip tersimpan di perangkat ini.";
    } catch {
      source = "Trip belum tersimpan. Periksa angka atau ekspor cadangan.";
    }
  }

  function activate(id: string) {
    const trip = trips.find((trip) => trip.id === id);
    if (!trip) return;
    activeId = id; tripName = trip.name; tripDate = trip.date; targetOmzet = trip.targetOmzet;
    dir = trip.dir; mode = trip.mode; byDir = structuredClone($state.snapshot(trip.byDir));
  }

  function createTrip() {
    if (trips.length >= 50) { notice = "Maksimal 50 trip. Ekspor cadangan sebelum menghapus trip lama."; return; }
    const trip = newTrip(crypto.randomUUID());
    trips = [...trips, trip]; activate(trip.id); commit();
  }

  function duplicateTrip() {
    if (trips.length >= 50) { notice = "Maksimal 50 trip."; return; }
    commit();
    const current = trips.find((trip) => trip.id === activeId)!;
    const trip = { ...structuredClone($state.snapshot(current)), id: crypto.randomUUID(), name: `${tripName.slice(0, 110)} (salinan)` };
    trips = [...trips, trip]; activate(trip.id); commit();
  }

  function deleteTrip() {
    if (trips.length === 1 || !confirm(`Hapus ${tripName}? Ekspor dulu jika masih diperlukan.`)) return;
    trips = trips.filter((trip) => trip.id !== activeId); activate(trips[0].id); commit();
  }

  function exportTrips() {
    commit();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, activeId, trips }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "titipin-trips.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function mergeBook(book: TripBook) {
    if (trips.length + book.trips.length > 50) throw new Error("Maksimal 50 trip setelah impor.");
    const incoming = book.trips.map((trip) => ({ ...trip, id: crypto.randomUUID() }));
    const selected = incoming[book.trips.findIndex((trip) => trip.id === book.activeId)];
    trips = [...trips, ...incoming]; activate(selected.id); commit();
  }

  async function importTrips(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    notice = "";
    try {
      if (file.size > 2_000_000) throw new Error("Cadangan terlalu besar.");
      mergeBook(parseTripBook(await file.text()));
      notice = "Trip cadangan ditambahkan. Trip lama tetap tersedia.";
    } catch { notice = "Cadangan tidak valid atau melebihi batas 50 trip. Trip lama tetap tersedia."; }
    finally { input.value = ""; }
  }

  async function cloud(action: "load" | "save") {
    if (cloudBusy) return;
    if (action === "load" && !confirm("Muat trip akun dan ganti daftar di perangkat? Ekspor trip perangkat dulu jika diperlukan.")) return;
    cloudBusy = true; notice = "";
    try {
      commit();
      const response = await authedFetch("/api/trips", action === "save" ? { method: "PUT", body: JSON.stringify({ revision: cloudRevision, book: { version: 1, activeId, trips } }) } : {});
      if (response.status === 409) throw new Error("Trip akun telah berubah. Ekspor trip perangkat, lalu muat trip akun sebelum menyimpan lagi.");
      if (!response.ok) throw new Error(response.status === 503 ? "Penyimpanan akun belum tersedia. Trip tetap dapat disimpan dan diekspor dari perangkat." : "Tidak dapat menyimpan trip akun. Masuk sebagai jastiper atau admin lalu coba lagi.");
      const data = await response.json();
      if (action === "load") {
        if (!data.book) { cloudRevision = 0; notice = "Akun belum memiliki trip tersimpan."; return; }
        const book = parseTripBook(JSON.stringify(data.book));
        trips = book.trips; activate(book.activeId); commit();
      }
      cloudRevision = data.revision;
      notice = action === "save" ? "Trip tersimpan ke akun." : "Trip akun dimuat ke perangkat.";
    } catch (error) { notice = error instanceof Error ? error.message : "Penyimpanan akun gagal."; }
    finally { cloudBusy = false; }
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
    if (!confirm("Reset muatan dan biaya arah ini ke angka contoh?")) return;
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
    const feeRate = draftFeeRate.trim() ? Number(draftFeeRate.replace(/\./g, "").replace(",", ".")) : undefined;
    if (name.length < 2 || !Number.isFinite(kgEach) || !(kgEach > 0) || !Number.isFinite(beli) || beli < 0 || feeRate !== undefined && (!Number.isFinite(feeRate) || feeRate < 0) || draftFeeMode === "item" && feeRate === undefined) {
      notice = "Isi nama, berat positif, dan harga yang valid. Tarif per item wajib diisi."; return;
    }
    if (scenario.goods.length >= 100) { notice = "Maksimal 100 jenis barang per arah."; return; }
    notice = "";
    addGood({ id: crypto.randomUUID(), name, kg: kgEach, qty: 1, beli, feeMode: draftFeeMode, ...(feeRate !== undefined ? { feeRate } : {}) });
    draftName = "";
    draftBeli = "";
    draftFeeRate = "";
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

<section class="mb-5 rounded-2xl border border-border bg-surface p-4" aria-label="Trip tersimpan">
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_10rem_12rem]">
    <label class="grid gap-1 text-sm">Pilih trip
      <select class={control} value={activeId} disabled={!ready} onchange={(e) => { commit(); activate(e.currentTarget.value); commit(); }}>
        {#each trips as trip (trip.id)}<option value={trip.id}>{trip.name}</option>{/each}
      </select>
    </label>
    <label class="grid gap-1 text-sm">Nama trip
      <input class={control} value={tripName} maxlength="120" oninput={(e) => { tripName = e.currentTarget.value; commit(); }} />
    </label>
    <label class="grid gap-1 text-sm">Tanggal
      <input type="date" class={control} value={tripDate} onchange={(e) => { tripDate = e.currentTarget.value; commit(); }} />
    </label>
    <label class="grid gap-1 text-sm">Target jasa (Rp)
      <input type="number" class={control} value={targetOmzet} min="0" max="1000000000000" step="10000" oninput={(e) => { targetOmzet = Math.max(0, Number(e.currentTarget.value) || 0); commit(); }} />
    </label>
  </div>
  <div class="mt-3 flex flex-wrap gap-2">
    <button type="button" class="min-h-11 rounded-lg bg-primary px-3 text-sm text-primary-fg" disabled={!ready} onclick={createTrip}>Trip baru</button>
    <button type="button" class="min-h-11 rounded-lg border border-border px-3 text-sm" disabled={!ready} onclick={duplicateTrip}>Salin trip</button>
    <button type="button" class="min-h-11 rounded-lg border border-border px-3 text-sm" disabled={!ready || trips.length === 1} onclick={deleteTrip}>Hapus trip</button>
    <button type="button" class="min-h-11 rounded-lg border border-border px-3 text-sm" disabled={!ready} onclick={exportTrips}>Ekspor cadangan</button>
    <button type="button" class="min-h-11 rounded-lg border border-border px-3 text-sm" disabled={!ready} onclick={() => importInput.click()}>Impor cadangan</button>
    <input bind:this={importInput} type="file" accept=".json,application/json" class="hidden" aria-label="File cadangan trip" onchange={importTrips} />
    {#if session.role === "jastiper" || session.role === "admin"}
      <button type="button" class="min-h-11 rounded-lg border border-border px-3 text-sm" disabled={cloudBusy} onclick={() => cloud("load")}>Muat trip akun</button>
      <button type="button" class="min-h-11 rounded-lg border border-border px-3 text-sm" disabled={cloudBusy} onclick={() => cloud("save")}>{cloudBusy ? "Memproses…" : "Simpan ke akun"}</button>
    {/if}
  </div>
  <p class="mt-2 text-xs text-muted">Target menghitung pendapatan jasa, bukan harga barang atau pembayaran yang diterima. Angka awal adalah contoh dan dapat diubah.</p>
  {#if notice}<p class="mt-2 text-sm text-primary" role="status">{notice}</p>{/if}
</section>
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
        <p class="mt-1 text-xs text-muted">
          {source}
        </p>
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
          <li class="grid grid-cols-1 items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div class="min-w-0">
              <p class="truncate font-medium">{g.name}</p>
              <p class="text-xs text-muted tabular-nums">
                {kg(g.kg)} × {g.qty} = {kg(g.kg * g.qty)}
                · beli {meta.shop === "TRY" ? `₺${g.beli}` : idr(g.beli)}
              </p>
              <p class="text-xs text-muted">Jasa {idr(Math.round(feeFor(g, scenario.hargaPerKg)))}</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <label class="grid gap-1 text-xs">Tarif {g.name}
                  <select class="{control} text-sm" value={g.feeMode ?? "kg"} onchange={(e) => setGood(g.id, { feeMode: e.currentTarget.value as "kg" | "item", feeRate: g.feeRate ?? scenario.hargaPerKg })}>
                    <option value="kg">Per kg</option><option value="item">Per item</option>
                  </select>
                </label>
                <label class="grid gap-1 text-xs">Rp / {g.feeMode === "item" ? "item" : "kg"}
                  <input type="number" min="0" max="1000000000000" class="{control} w-36 text-sm" aria-label={`Harga jasa ${g.name}`} value={g.feeRate ?? ""} placeholder={String(scenario.hargaPerKg)} oninput={(e) => setGood(g.id, { feeRate: e.currentTarget.value === "" && g.feeMode !== "item" ? undefined : Math.max(0, Number(e.currentTarget.value) || 0) })} />
                </label>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" aria-label={`Kurangi ${g.name}`} class="grid size-11 place-items-center rounded-full border border-border text-lg" onclick={() => setGood(g.id, { qty: Math.max(0, g.qty - 1) })}>−</button>
              <span class="w-6 text-center text-sm tabular-nums">{g.qty}</span>
              <button type="button" aria-label={`Tambah ${g.name}`} class="grid size-11 place-items-center rounded-full border border-border text-lg" onclick={() => setGood(g.id, { qty: Math.min(100000, g.qty + 1) })}>+</button>
              <button type="button" class="min-h-11 px-2 text-sm text-muted" onclick={() => removeGood(g.id)}>Hapus</button>
            </div>
          </li>
        {/each}
        {#if scenario.goods.length === 0}<li class="py-4 text-sm text-muted">Belum ada muatan. Tambahkan barang di bawah.</li>{/if}
      </ul>
      <form
        class="mt-2 grid gap-2 sm:grid-cols-2"
        onsubmit={(e) => { e.preventDefault(); addDraft(); }}
      >
        <label class="grid gap-1 text-xs">Nama barang<input bind:value={draftName} required minlength="2" maxlength="120" placeholder="Barang baru" class={control} /></label>
        <label class="grid gap-1 text-xs">Kg per pcs<input bind:value={draftKg} required inputmode="decimal" class={control} /></label>
        <label class="grid gap-1 text-xs">Harga beli ({meta.shop})<input bind:value={draftBeli} inputmode="decimal" placeholder={meta.shop === "TRY" ? "₺" : "Rp"} class={control} /></label>
        <label class="grid gap-1 text-xs">Jenis tarif<select bind:value={draftFeeMode} class={control}><option value="kg">Per kg</option><option value="item">Per item</option></select></label>
        <label class="grid gap-1 text-xs">Tarif jasa (Rp / {draftFeeMode === "item" ? "item" : "kg"})<input bind:value={draftFeeRate} required={draftFeeMode === "item"} inputmode="decimal" placeholder={draftFeeMode === "kg" ? `Default ${scenario.hargaPerKg}` : "Isi tarif per item"} class={control} /></label>
        <button type="submit" class="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg">Tambah</button>
      </form>
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
              oninput={(e) => setOpex(line.id, Math.max(0, Number(e.currentTarget.value) || 0))}
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
              <input type="number" value={line.price} min="0" class="{control} mt-1" oninput={(e) => setCapex(line.id, { price: Math.max(0, Number(e.currentTarget.value) || 0) })} />
            </label>
            <label class="block text-xs text-muted">
              Umur trip
              <input type="number" value={line.trips} min="1" step="1" class="{control} mt-1" oninput={(e) => setCapex(line.id, { trips: Math.max(1, Math.floor(Number(e.currentTarget.value) || 1)) })} />
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
        <div class="flex flex-wrap items-end justify-between gap-3">
          <span class="text-sm">{mode === "pp" ? "Laba trip" : "Laba bawa"}</span>
          <span class="font-display text-3xl leading-none tabular-nums {n.laba < 0 ? 'text-accent' : 'text-primary'}">{idr(n.laba)}</span>
        </div>
        <p class="mt-2 text-xs text-muted">
          {idr(n.pendapatan)} jasa{mode === "pp" ? " dua kaki" : ""} − {idr(n.beban)} beban. Estimasi impas {kg(n.breakEvenKg)} berdasarkan tarif rata-rata muatan. Sisa kuota kaki ini senilai {idr(n.potensi)} jika diisi dengan tarif default per kg.
        </p>
      </div>
      <div class="mt-4 border-t border-border pt-3">
        <h3 class="text-lg">Target omzet jasa</h3>
        {#if targetOmzet > 0}
          <p class="mt-1 text-sm tabular-nums">{idr(n.pendapatan)} / {idr(targetOmzet)} · {progress.percent}%</p>
          <progress class="mt-2 h-2 w-full accent-primary" max="100" value={progress.percent} aria-label="Pencapaian target omzet"></progress>
          <p class="mt-1 text-xs text-muted">{progress.remaining > 0 ? `Kurang ${idr(progress.remaining)} untuk target trip ini.` : "Target jasa tercapai."}</p>
        {:else}
          <p class="mt-1 text-sm text-muted">Isi target jasa pada detail trip untuk melihat pencapaian.</p>
        {/if}
      </div>
    </div>
  </aside>
</div>
