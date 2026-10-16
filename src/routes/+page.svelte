<script lang="ts">
  /**
   * Beranda publik (arah "the quiet instrument"): satu pernyataan, satu aksi,
   * dan satu instrumen hidup. Tanpa sidebar; kolom terpusat di tengah layar.
   */
  import { onMount } from "svelte";
  import { desk, initDesk, kakiAktif, patch } from "../lib/titip/trip-store.svelte";
  import { computeRevenue, tripLintas } from "../lib/titip/pricing";
  import { destinasiByCode } from "../lib/titip/destinasi";
  import { kakiCode } from "../lib/titip/kaki";
  import { idr, kg } from "../lib/titip/model";

  onMount(() => { initDesk(); });

  const kaki = $derived(desk.kaki);
  const idx = $derived(Math.min(desk.aktif, Math.max(0, kaki.length - 1)));
  const now = $derived(kakiAktif());
  const meta = $derived(destinasiByCode(now.destinasi));
  const rev = $derived(computeRevenue(now.scenario.goods, now.scenario.hargaPerKg, meta?.currency ?? "IDR"));
  const lintas = $derived(tripLintas(kaki.map((k) => ({ id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario }))));
  const bersih = $derived(Math.max(0, now.scenario.bags * now.scenario.kgPerBag + now.scenario.cabin - now.scenario.tare));
  const sisa = $derived(Math.round((bersih - rev.totalKg) * 10) / 10);
  const over = $derived(sisa < 0);

  /**
   * Tiga langkah pakai: tanpa akun → akun gratis → langganan. Ini ajakan
   * (copy), bukan gating: belum ada pembayaran, fitur "segera" ditandai jujur.
   * Setiap paket dipanggil dengan hasilnya, bukan sekadar daftar fitur.
   */
  const paket = [
    {
      nama: "Coba",
      harga: "Rp0",
      satuan: "",
      ket: "Tanpa daftar",
      janji: "Hitung trip pertamamu sekarang.",
      fitur: [
        "Kalkulator bagasi multi-tahap",
        "10 negara tujuan + transit",
        "Laba, muatan, dan sisa kuota langsung",
        "Tersimpan di perangkat ini",
      ],
      cta: { label: "Buka kalkulator", href: "/meja" },
      utama: false,
    },
    {
      nama: "Akun",
      harga: "Rp0",
      satuan: "",
      ket: "Gratis selamanya",
      janji: "Bawa hitunganmu ke mana-mana.",
      fitur: [
        "Semua di paket Coba",
        "Trip tersimpan di cloud — ganti HP, tetap ada",
        "Portal & titipan per akun",
        "Asisten AI yang mengubah trip dari chat",
      ],
      cta: { label: "Daftar gratis", href: "/masuk" },
      utama: true,
    },
    {
      nama: "Langganan",
      harga: "Rp99rb",
      satuan: "/bulan",
      ket: "Segera",
      janji: "Untuk jastiper yang jalan terus.",
      fitur: [
        "Semua di paket Akun",
        "Trip & riwayat tanpa batas",
        "Proyeksi target omzet tiap trip",
        "Ekspor laporan CSV (segera)",
        "Asisten AI tanpa key sendiri (segera)",
      ],
      cta: { label: "Amankan harga awal", href: "/masuk" },
      utama: false,
    },
  ];
</script>

<svelte:head><title>Titipin. Kalkulator bagasi jastip multi-negara</title></svelte:head>

<section class="text-center">
  <h1 class="mx-auto max-w-[26rem] text-balance text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.02]" data-rise style="--i: 0">
    Bagasi, tarif, dan laba satu trip
  </h1>
  <p class="mx-auto mt-5 max-w-[38ch] text-body text-muted" data-rise style="--i: 1">
    Untuk jastiper multi-negara. Susun rute bertahap, isi muatan tiap tahap, dan biaya terbang; sisanya dihitung langsung.
  </p>
  <div class="mt-7 flex flex-wrap items-center justify-center gap-3" data-rise style="--i: 2">
    <a class="btn" href="/masuk">Daftar gratis</a>
    <a class="link text-body" href="/meja">Coba kalkulator</a>
  </div>
  <p class="mx-auto mt-3 max-w-[38ch] text-small text-muted" data-rise style="--i: 3">
    Akun menyimpan trip di cloud, lintas perangkat. Kalkulator tetap bisa dipakai tanpa akun.
  </p>
</section>

<!-- Instrumen hidup: satu-satunya hal besar di layar, angka asli dari kalkulator. -->
<section class="panel-deep mx-auto mt-10 w-full max-w-[34rem] rounded p-6" data-ui data-reveal aria-label="Instrumen kalkulator bagasi">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="text-body">{kakiCode(now)} · {kaki.length} tahap</p>
    <p class="num text-small text-muted">{kg(lintas.totalKg)} muatan</p>
  </div>

  <p class="readout mt-4 {over ? 'text-accent' : 'text-fg'}">
    {over ? `−${kg(-sisa)}` : kg(sisa)}
  </p>
  <p class="mt-2 text-body">{over ? "kelebihan bagasi tahap ini" : "sisa kuota tahap ini"}</p>

  <div class="meter mt-5" aria-hidden="true">
    <span style="width: {Math.round(Math.min(1, bersih > 0 ? rev.totalKg / bersih : 1) * 100)}%; background: {over ? 'var(--color-accent)' : ''}"></span>
  </div>

  <label class="mt-6 block text-left">
    <span class="mb-2 flex items-baseline justify-between gap-3">
      <span>Harga jual / kg</span>
      <span class="num text-body">{idr(now.scenario.hargaPerKg)}</span>
    </span>
    <input
      type="range"
      min="50000"
      max="2000000"
      step="10000"
      value={now.scenario.hargaPerKg}
      oninput={(e) => patch({ hargaPerKg: Number(e.currentTarget.value) })}
      class="w-full"
    />
  </label>

  <dl class="mt-6 grid gap-3 text-left sm:grid-cols-2">
    <div class="flex items-baseline justify-between gap-3">
      <dt class="text-body">Laba trip</dt>
      <dd class="num text-body {lintas.service - rev.service < 0 ? 'text-accent' : 'text-fg'}">{idr(Math.round(lintas.service - rev.service))}</dd>
    </div>
    <div class="flex items-baseline justify-between gap-3">
      <dt class="text-body">Kapasitas trip</dt>
      <dd class="num text-body">{kg(lintas.capacityKg)}</dd>
    </div>
  </dl>
</section>

<section class="mt-14" data-reveal aria-labelledby="rute">
  <h2 id="rute" class="text-center" data-reveal>Sepuluh negara, satu rute</h2>
  <p class="mx-auto mt-3 max-w-[46ch] text-center text-body text-muted" data-reveal>
    Jepang, Korea, Singapura, Hong Kong, Thailand, Amerika, Prancis, Malaysia, Jerman, Australia.
    Transit di negara lain tetap bisa diisi barang. Foto di bawah contoh rute, bukan hasil produk Titipin.
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

<section class="mt-14" data-reveal aria-labelledby="paket">
  <h2 id="paket" class="text-center" data-reveal>Mulai gratis, naik bila perlu</h2>
  <p class="mx-auto mt-3 max-w-[46ch] text-center text-body text-muted" data-reveal>
    Kalkulator bisa langsung dicoba tanpa akun. Daftar untuk membawa trip ke perangkat mana pun.
    Langganan untuk jastiper yang jalan terus.
  </p>

  <ul class="mx-auto mt-8 grid max-w-[54rem] gap-4 sm:grid-cols-3">
    {#each paket as p (p.nama)}
      <li class="flex flex-col rounded p-5 {p.utama ? 'panel-deep' : 'panel'}" data-reveal>
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-lead">{p.nama}</h3>
          {#if p.ket}<span class="text-small text-muted">{p.ket}</span>{/if}
        </div>
        <p class="num mt-4 text-head">
          {p.harga}{#if p.satuan}<span class="text-body text-muted">{p.satuan}</span>{/if}
        </p>
        <p class="mt-3 text-body">{p.janji}</p>
        <ul class="mt-4 flex-1 space-y-2 text-small text-muted">
          {#each p.fitur as f (f)}
            <li>{f}</li>
          {/each}
        </ul>
        <a class="mt-6 {p.utama ? 'btn' : 'btn-quiet'} text-center" href={p.cta.href}>{p.cta.label}</a>
      </li>
    {/each}
  </ul>
  <p class="mx-auto mt-4 max-w-[46ch] text-center text-small text-muted" data-reveal>
    Langganan belum aktif — harga awal bisa berubah. Fitur bertanda "segera" menyusul.
  </p>
</section>

<section class="mt-14" data-reveal aria-labelledby="untuk">
  <h2 id="untuk" class="text-center" data-reveal>Dua sisi, satu rute</h2>
  <p class="mx-auto mt-3 max-w-[46ch] text-center text-body text-muted" data-reveal>
    Klien menitip barang, jastiper membawanya. Di sini keduanya saling bertemu — tanpa perantara.
  </p>
  <dl class="mx-auto mt-6 grid max-w-[46rem] gap-6 text-center sm:grid-cols-2">
    <div data-reveal>
      <dt class="text-body">Klien</dt>
      <dd class="mt-1 text-small text-muted">Catat barang yang mau dibawa, lihat siapa yang jalan, ikuti statusnya sampai tiba.</dd>
    </div>
    <div data-reveal>
      <dt class="text-body">Jastiper</dt>
      <dd class="mt-1 text-small text-muted">Umumkan rute, lihat permintaan masuk, hitung kuota dan laba trip.</dd>
    </div>
  </dl>
  <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
    <a class="btn" href="/masuk">Daftar gratis</a>
    <a class="link text-body" href="/meja">Buka kalkulator</a>
  </div>
</section>
