<script lang="ts">
  /**
   * Fragmen interface hidup (SKILL.md step 6: "software shows its own interface").
   * Angka asli dari meja hitung, dipakai sebagai jangkar layar pertama di halaman
   * selain meja. Ditandai `data-ui` supaya house-rules housekeeping mengenalinya
   * sebagai potongan interface, bukan kotak dekoratif.
   */
  import { desk } from "./trip-store.svelte";
  import { computeTrip, DIR_META } from "./calc";
  import { idr, kg } from "./model";

  let { compact = false }: { compact?: boolean } = $props();

  const meta = $derived(DIR_META[desk.dir]);
  const n = $derived(computeTrip(desk.mode, desk.dir, desk.byDir));
  const over = $derived(n.sisa < 0);
</script>

<div class="panel-deep rounded p-4" data-ui aria-label="Ringkasan meja hitung">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="text-body">{meta.code} · {desk.mode === "pp" ? "pulang-pergi" : "pergi saja"}</p>
    <p class="num text-small">{kg(n.terpakai)} terpakai</p>
  </div>
  <p class="readout mt-3 {over ? 'text-accent' : 'text-fg'}">
    {over ? `−${kg(n.overKg)}` : kg(Math.max(0, n.sisa))}
  </p>
  <p class="mt-2 text-body">{over ? "kelebihan bagasi" : "sisa kuota bersih"}</p>
  {#if !compact}
    <dl class="mt-4 grid gap-2 text-body sm:grid-cols-2">
      <div class="flex items-baseline justify-between gap-3">
        <dt>Laba {desk.mode === "pp" ? "trip" : "bawa"}</dt>
        <dd class="num {n.laba < 0 ? 'text-accent' : 'text-fg'}">{idr(n.laba)}</dd>
      </div>
      <div class="flex items-baseline justify-between gap-3">
        <dt>Saran jual / kg</dt>
        <dd class="num">{idr(n.saranPerKg)}</dd>
      </div>
    </dl>
  {/if}
</div>
