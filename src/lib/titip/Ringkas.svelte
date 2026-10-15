<script lang="ts">
  /**
   * Fragmen interface hidup (SKILL.md step 6: "software shows its own interface").
   * Angka asli dari meja hitung, dipakai sebagai jangkar layar pertama di halaman
   * selain meja. Ditandai `data-ui` supaya house-rules mengenalinya sebagai
   * potongan interface, bukan kotak dekoratif.
   */
  import { desk, kakiAktif } from "./trip-store.svelte";
  import { computeRevenue, tripLintas } from "./pricing";
  import { destinasiByCode } from "./destinasi";
  import { kakiCode, kakiLabel } from "./kaki";
  import { idr, kg } from "./model";

  let { compact = false }: { compact?: boolean } = $props();

  const kaki = $derived(desk.kaki);
  const idx = $derived(Math.min(desk.aktif, Math.max(0, kaki.length - 1)));
  const now = $derived(kakiAktif());
  const prev = $derived(idx > 0 ? kaki[idx - 1] : undefined);
  const meta = $derived(destinasiByCode(now.destinasi));
  const rev = $derived(computeRevenue(now.scenario.goods, now.scenario.hargaPerKg, meta?.currency ?? "IDR"));
  const lintas = $derived(tripLintas(kaki.map((k) => ({ id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario }))));
  const bersih = $derived(Math.max(0, now.scenario.bags * now.scenario.kgPerBag + now.scenario.cabin - now.scenario.tare));
  const sisa = $derived(Math.round((bersih - rev.totalKg) * 10) / 10);
  const over = $derived(sisa < 0);

  const bebanTrip = $derived(kaki.reduce((sum, k) => {
    const opex = k.scenario.opex.reduce((s, l) => s + l.amount, 0);
    const capex = k.scenario.capex.reduce((s, l) => s + l.price / Math.max(1, l.trips), 0);
    return sum + Math.round(opex + capex);
  }, 0));
</script>

<div class="panel-deep rounded p-4" data-ui aria-label="Ringkasan meja hitung">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="text-body">{kakiCode(now, prev)} · {kaki.length} kaki</p>
    <p class="num text-small">{kg(lintas.totalKg)} muatan</p>
  </div>
  <p class="readout mt-3 {over ? 'text-accent' : 'text-fg'}">
    {over ? `−${kg(-sisa)}` : kg(sisa)}
  </p>
  <p class="mt-2 text-body">{over ? "kelebihan bagasi kaki ini" : "sisa kuota kaki ini"}</p>
  {#if !compact}
    <dl class="mt-4 grid gap-2 text-body sm:grid-cols-2">
      <div class="flex items-baseline justify-between gap-3">
        <dt>Laba trip</dt>
        <dd class="num {lintas.service - bebanTrip < 0 ? 'text-accent' : 'text-fg'}">{idr(Math.round(lintas.service - bebanTrip))}</dd>
      </div>
      <div class="flex items-baseline justify-between gap-3">
        <dt>Kaki aktif</dt>
        <dd class="num">{kakiLabel(now, prev)}</dd>
      </div>
    </dl>
  {/if}
</div>
