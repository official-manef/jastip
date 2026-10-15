<script lang="ts">
  /**
   * Beranda publik (arah "the quiet instrument"): satu pernyataan, satu aksi,
   * dan satu instrumen hidup. Tanpa sidebar; kolom terpusat di tengah layar.
   */
  import { onMount } from "svelte";
  import { desk, initDesk, patch } from "../lib/titip/trip-store.svelte";
  import { computeTrip, DIR_META } from "../lib/titip/calc";
  import { idr, kg } from "../lib/titip/model";

  onMount(() => { initDesk(); });

  const meta = $derived(DIR_META[desk.dir]);
  const n = $derived(computeTrip(desk.mode, desk.dir, desk.byDir));
  const over = $derived(n.sisa < 0);
</script>

<svelte:head><title>Titipin. Kalkulator bagasi Jakarta ↔ Turki</title></svelte:head>

<section class="text-center">
  <h1 class="mx-auto max-w-[26rem] text-balance text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.02]" data-rise style="--i: 0">
    Bagasi, tarif, dan laba satu trip
  </h1>
  <p class="mx-auto mt-5 max-w-[38ch] text-body text-muted" data-rise style="--i: 1">
    Untuk jastiper Jakarta ↔ Turki. Isi koper, harga per kg, dan biaya terbang; sisanya dihitung langsung.
  </p>
  <div class="mt-7 flex flex-wrap items-center justify-center gap-3" data-rise style="--i: 2">
    <a class="btn" href="/meja">Buka meja hitung</a>
    <a class="link text-body" href="/masuk">Daftar akun</a>
  </div>
</section>

<!-- Instrumen hidup: satu-satunya hal besar di layar, angka asli dari meja. -->
<section class="panel-deep mx-auto mt-10 w-full max-w-[34rem] rounded p-6" data-ui data-reveal aria-label="Instrumen meja hitung">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="text-body">{meta.code} · {desk.mode === "pp" ? "pulang-pergi" : "pergi saja"}</p>
    <p class="num text-small text-muted">{kg(n.terpakai)} terpakai</p>
  </div>

  <p class="readout mt-4 {over ? 'text-accent' : 'text-fg'}">
    {over ? `−${kg(n.overKg)}` : kg(Math.max(0, n.sisa))}
  </p>
  <p class="mt-2 text-body">{over ? "kelebihan bagasi" : "sisa kuota bersih"}</p>

  <div class="meter mt-5" aria-hidden="true">
    <span style="width: {Math.round(n.penuh * 100)}%; background: {over ? 'var(--color-accent)' : ''}"></span>
  </div>

  <label class="mt-6 block text-left">
    <span class="mb-2 flex items-baseline justify-between gap-3">
      <span>Harga jual / kg</span>
      <span class="num text-body">{idr(desk.byDir[desk.dir].hargaPerKg)}</span>
    </span>
    <input
      type="range"
      min="50000"
      max="2000000"
      step="10000"
      value={desk.byDir[desk.dir].hargaPerKg}
      oninput={(e) => patch({ hargaPerKg: Number(e.currentTarget.value) })}
      class="w-full"
    />
  </label>

  <dl class="mt-6 grid gap-3 text-left sm:grid-cols-2">
    <div class="flex items-baseline justify-between gap-3">
      <dt class="text-body">{desk.mode === "pp" ? "Laba trip" : "Laba bawa"}</dt>
      <dd class="num text-body {n.laba < 0 ? 'text-accent' : 'text-fg'}">{idr(n.laba)}</dd>
    </div>
    <div class="flex items-baseline justify-between gap-3">
      <dt class="text-body">Saran jual / kg</dt>
      <dd class="num text-body">{idr(n.saranPerKg)}</dd>
    </div>
  </dl>
</section>

<section class="mt-14" data-reveal aria-labelledby="rute">
  <h2 id="rute" class="text-center" data-reveal>Satu koridor, dua arah</h2>
  <p class="mx-auto mt-3 max-w-[46ch] text-center text-body text-muted" data-reveal>
    Jakarta (CGK) dan Istanbul (IST). Pergi saja atau pulang-pergi. Foto di bawah ini rute sungguhan,
    bukan hasil produk Titipin.
  </p>

  <div class="crossfade relative mx-auto mt-6 aspect-[16/9] w-full overflow-hidden rounded bg-surface" aria-hidden="true">
    <img class="absolute inset-0 size-full object-cover" src="/img/terminal3soekarnohatt.jpg" alt="" width="1920" height="1503" />
    <img class="absolute inset-0 size-full object-cover" src="/img/istanbul-bosphorus-ferry.jpg" alt="" width="1920" height="1080" loading="lazy" />
    <img class="absolute inset-0 size-full object-cover" src="/img/soetta-skytrain-9.jpg" alt="" width="1920" height="1280" loading="lazy" />
  </div>

  <div class="mt-6 grid gap-4 sm:grid-cols-2">
    <figure data-reveal>
      <img class="w-full rounded object-cover" src="/img/soetta-skytrain-9.jpg" alt="Skytrain di Bandara Soekarno-Hatta, Jakarta" width="1920" height="1280" loading="lazy" decoding="async" />
      <figcaption class="mt-2 text-small text-muted">
        Skytrain Soekarno-Hatta, ujung Jakarta. "Soetta Skytrain 9", Gunawan Kartapranata, CC BY-SA 4.0.
      </figcaption>
    </figure>
    <figure data-reveal>
      <video class="w-full rounded" autoplay muted loop playsinline preload="metadata" poster="/img/a-ferry-in-the-bosphorus-20251015-poster.jpg" width="854" height="480" aria-label="Feri berlayar di Selat Bosphorus">
        <source src="/img/a-ferry-in-the-bosphorus-20251015.webm" type="video/webm" />
      </video>
      <figcaption class="mt-2 text-small text-muted">
        Feri berlayar, sisi Istanbul. "A ferry in the Bosphorus", Kurmanbek, CC BY-SA 4.0.
      </figcaption>
    </figure>
  </div>
</section>

<section class="mt-14" data-reveal aria-labelledby="untuk">
  <h2 id="untuk" class="text-center" data-reveal>Untuk siapa</h2>
  <dl class="mx-auto mt-6 grid max-w-[46rem] gap-6 text-center sm:grid-cols-3">
    <div data-reveal>
      <dt class="text-body">Klien</dt>
      <dd class="mt-1 text-small text-muted">Catat barang yang mau dibawa. Jastiper yang mengubah status.</dd>
    </div>
    <div data-reveal>
      <dt class="text-body">Jastiper</dt>
      <dd class="mt-1 text-small text-muted">Lihat semua titipan, hitung kuota dan laba trip.</dd>
    </div>
    <div data-reveal>
      <dt class="text-body">Admin</dt>
      <dd class="mt-1 text-small text-muted">Satu orang, ditetapkan operator. Atur peran akun.</dd>
    </div>
  </dl>
  <div class="mt-8 text-center">
    <a class="btn" href="/meja">Mulai hitung</a>
  </div>
</section>
