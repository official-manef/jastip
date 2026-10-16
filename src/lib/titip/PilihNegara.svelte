<script lang="ts">
  /**
   * Pemilih negara ala booking: satu dropdown, dikelompokkan per kawasan, plus
   * satu opsi "Negara lain…" di dasar daftar untuk negara yang belum ada.
   *
   * Tujuan: hindari isian bebas sebisa mungkin. Katalog luas menutup hampir semua
   * pilihan; custom hanya jalan terakhir, dan hanya muncul saat dipilih.
   */
  import {
    CUSTOM_KODE,
    KATALOG_CURRENCIES,
    destinasiPerKawasan,
    viewOf,
    type CustomDest,
    type Currency,
  } from "./destinasi";
  import { idr } from "./model";
  import { kursLabel } from "./kurs-store.svelte";

  type Props = {
    /** Kode destinasi terpilih (katalog, `custom:<slug>`, atau "jakarta"). */
    nilai: string;
    /** Data custom bila `nilai` bukan katalog. */
    custom?: CustomDest;
    /** Tambahkan opsi titik asal (Indonesia/Jakarta) di atas. */
    denganAsal?: boolean;
    onpilih: (kode: string) => void;
    oncustom: (custom: CustomDest) => void;
  };

  let { nilai, custom, denganAsal = true, onpilih, oncustom }: Props = $props();

  const grup = destinasiPerKawasan();
  const view = $derived(viewOf(nilai, custom));

  let bukaCustom = $state(false);
  let cNegara = $state("");
  let cKota = $state("");
  let cCurrency = $state<Currency>("USD");
  let cKurs = $state("");
  let cNotice = $state("");

  function onSelect(event: Event) {
    const kode = (event.currentTarget as HTMLSelectElement).value;
    if (kode === CUSTOM_KODE) {
      bukaCustom = true;
      cNegara = custom?.negara ?? "";
      cKota = custom?.kota ?? "";
      cCurrency = custom?.currency ?? "USD";
      cKurs = custom ? String(custom.kurs) : "";
      cNotice = "";
      return;
    }
    bukaCustom = false;
    onpilih(kode);
  }

  function simpanCustom() {
    const negara = cNegara.trim();
    const kota = cKota.trim() || negara;
    const kurs = Number(cKurs.replace(/\./g, "").replace(",", "."));
    if (negara.length < 2 || negara.length > 60) {
      cNotice = "Isi nama negara 2–60 karakter.";
      return;
    }
    if (!Number.isFinite(kurs) || kurs <= 0 || kurs > 1_000_000) {
      cNotice = "Isi kurs (Rupiah per 1 unit mata uang) lebih dari 0.";
      return;
    }
    cNotice = "";
    oncustom({ negara, kota, currency: cCurrency, kurs });
    bukaCustom = false;
  }
</script>

<select
  class="field"
  value={bukaCustom ? CUSTOM_KODE : nilai}
  onchange={onSelect}
  aria-label="Negara tujuan"
>
  {#if denganAsal}
    <option value="jakarta">Indonesia (Jakarta)</option>
  {/if}
  {#each grup as g (g.kawasan)}
    <optgroup label={g.kawasan}>
      {#each g.items as d (d.code)}
        <option value={d.code}>{d.negara} · {d.kota}</option>
      {/each}
    </optgroup>
  {/each}
  <option value={CUSTOM_KODE}>Negara lain…</option>
</select>

{#if view}
  <p class="mt-2 text-small text-muted">
    {#if view.custom}
      <span class="text-fg">Negara tambahan.</span>
      Mata uang {view.currency}, kurs {idr(view.kurs)}.
    {:else if view.kategori.length}
      {view.kategori.join(", ")}. Mata uang {view.currency}, kurs {idr(view.kurs)}.
    {:else}
      Mata uang {view.currency}, kurs {idr(view.kurs)}.
    {/if}
    <span class="text-muted">· {kursLabel()}</span>
  </p>
{/if}

{#if bukaCustom}
  <div class="panel mt-3 grid gap-3 p-4">
    <p class="text-body">Negara belum ada di daftar? Isi sekali di sini.</p>
    <label class="block">
      <span class="mb-2 block text-small text-muted">Nama negara</span>
      <input class="field" bind:value={cNegara} maxlength="60" placeholder="Mis. Brunei Darussalam" />
    </label>
    <div class="grid gap-3 sm:grid-cols-3">
      <label class="block">
        <span class="mb-2 block text-small text-muted">Kota belanja</span>
        <input class="field" bind:value={cKota} maxlength="60" placeholder="Opsional" />
      </label>
      <label class="block">
        <span class="mb-2 block text-small text-muted">Mata uang</span>
        <select class="field" bind:value={cCurrency}>
          {#each KATALOG_CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
        </select>
      </label>
      <label class="block">
        <span class="mb-2 block text-small text-muted">Kurs (Rp per 1 unit)</span>
        <input class="field num" bind:value={cKurs} inputmode="numeric" placeholder="Mis. 15800" />
      </label>
    </div>
    {#if cNotice}<p class="text-body text-accent" role="status">{cNotice}</p>{/if}
    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn" onclick={simpanCustom}>Pakai negara ini</button>
      <button type="button" class="btn-quiet" onclick={() => (bukaCustom = false)}>Batal</button>
    </div>
  </div>
{/if}
