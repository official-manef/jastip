<script lang="ts">
  /**
   * Fragmen interface hidup (SKILL.md step 6: "software shows its own interface").
   * Angka asli dari kalkulator, dipakai sebagai jangkar layar pertama di halaman
   * selain kalkulator. Ditandai `data-ui` supaya house-rules mengenalinya sebagai
   * potongan interface, bukan kotak dekoratif.
   */
  import { desk, kakiAktif } from "./trip-store.svelte";
  import { computeRevenue, tripFinances, tripLintas } from "./pricing";
  import { kakiCode, kakiLabel } from "./kaki";
  import { idr, kg } from "./model";

  let { compact = false }: { compact?: boolean } = $props();

  const kaki = $derived(desk.kaki);
  const idx = $derived(Math.min(desk.aktif, Math.max(0, kaki.length - 1)));
  const now = $derived(kakiAktif());
  const prev = $derived(idx > 0 ? kaki[idx - 1] : undefined);
  const rev = $derived(computeRevenue(now.scenario.goods, now.scenario.hargaPerKg, now.scenario.hargaCurrency ?? "IDR"));
  const lintas = $derived(tripLintas(kaki.map((k) => ({ id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario }))));
  const bersih = $derived(Math.max(0, now.scenario.bags * now.scenario.kgPerBag + now.scenario.cabin - now.scenario.tare));
  const sisa = $derived(Math.round((bersih - rev.totalKg) * 10) / 10);
  const over = $derived(sisa < 0);

  const finances = $derived(tripFinances(kaki));
</script>

<div class="panel-deep rounded p-4" data-ui aria-label="Ringkasan kalkulator">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="text-body">{kakiCode(now, prev)} · {kaki.length} tahap</p>
    <p class="num text-small">{kg(lintas.totalKg)} muatan</p>
  </div>
  <p class="readout mt-3 {over ? 'text-accent' : 'text-fg'}">
    {over ? `−${kg(-sisa)}` : kg(sisa)}
  </p>
  <p class="mt-2 text-body">{over ? "kelebihan bagasi tahap ini" : "sisa kuota tahap ini"}</p>
  {#if !compact}
    <dl class="mt-4 grid gap-2 text-body sm:grid-cols-2">
      <div class="flex items-baseline justify-between gap-3">
        <dt>Laba trip</dt>
        <dd class="num {finances.laba !== null && finances.laba < 0 ? 'text-accent' : 'text-fg'}">{finances.laba === null ? "Perlu kurs ke IDR" : idr(finances.laba)}</dd>
      </div>
      <div class="flex items-baseline justify-between gap-3">
        <dt>Tahap aktif</dt>
        <dd class="num">{kakiLabel(now, prev)}</dd>
      </div>
    </dl>
  {/if}
</div>
