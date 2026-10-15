# Progress

Cabang `main`. Tanggal di bawah adalah hari kerja di repo, bukan janji rilis.

## 15 Oktober 2026 (lanjutan 5): landing mengajak daftar

- Beranda `/` sekarang mengajak tiga langkah: **Gratis** (meja hitung tanpa akun) → **Akun**
  (daftar gratis: trip di cloud, portal, titipan, asisten BYOK) → **Langganan** Rp99rb/bln
  (segara: trip & riwayat tak terbatas, proyeksi target omzet, ekspor CSV, asisten tanpa BYOK).
- Seksi baru `#paket` (tiga kartu; kartu Akun disorot `panel-deep`) + dua CTA "Daftar gratis"
  di hero dan penutup. Fitur "segera" ditandai jujur; harga contoh, belum ada gating/pembayaran.
- Salinan basi diperbarui: judul/meta/patch PWA "Jakarta ↔ Turki" → "jastip multi-negara"
  (`+layout.svelte`, `+page.svelte`, `public/manifest.webmanifest`).
- Verifikasi: `svelte-check` 0 error; 61 tes lulus; build sukses; smoke dev + produksi bersih
  desktop+mobile; kartu paket diperiksa secara visual di 1280×800 dan 390×844.

## 15 Oktober 2026 (lanjutan 4): asisten jadi BYOK murni

- Key server dihapus. Sebelumnya `/api/ai` membaca `AI_API_KEY`/`AI_API_BASE_URL`/`AI_MODEL`/
  `AI_ALLOWED_HOSTS` dari env dan mengirim key operator; `/pengaturan` menampilkan "Key server aktif".
  Sekarang **tidak ada key server**: pengguna mengisi URL penyedia, ID model, dan API key sendiri.
- `src/lib/titip/ai.ts`: buang `DEFAULT_AI_BASE_URL`/`DEFAULT_AI_MODEL`; `providerUrl` tak lagi
  pakai allowlist host (key milik pengguna), ganti dengan penolakan host privat/loopback (SSRF):
  `localhost`, `*.local`, `*.internal`, `127.`, `10.`, `192.168.`, `172.16–31.`, `169.254.`, `0.`,
  `::1`, dan host tanpa titik. `callProvider(input, apiKey, fetch)`.
- `src/routes/api/ai/+server.ts`: buang `GET` (dulu membocorkan `serverKey:"env"`), buang `config()`,
  tolak request tanpa `baseUrl`/`model`/`apiKey`.
- `ai-settings.svelte.ts`: hapus `serverKey`, tak lagi fetch `/api/ai`; URL/model kosong sampai diisi.
- UI: `/pengaturan` dan `/asisten` menyebut mode BYOK, bukan "key server aktif".
- Env Vercel: `AI_API_KEY`, `AI_MODEL` dihapus dari produksi. `.env.example` + CI dibersihkan.
- Verifikasi: `svelte-check` 0 error; 61 tes lulus (7 tes AI ditulis ulang); build sukses; smoke dev
  + produksi bersih desktop+mobile. `/api/ai` GET kini 404/405, POST tanpa key → `tanpa-key`.

## 15 Oktober 2026 (lanjutan 3): trip berkaki bebas + katalog 10 negara

- Model trip jadi **daftar kaki** (`trip.kaki`), bukan lagi `dir`/`mode` tetap. Kaki bebas berurutan;
  transit = kaki bertanda khusus yang tetap boleh diisi barang. Sumber: `src/lib/titip/kaki.ts`,
  `src/lib/titip/trip-state.ts` (skema v2 + zod, migrasi v1 otomatis).
- Katalog **10 negara tujuan populer** pasar Indonesia + Turki: `src/lib/titip/destinasi.ts`
  (Jepang, Korea, Singapura, Hong Kong, Thailand, Amerika, Prancis, Malaysia, Jerman, Australia).
  Tiap destinasi punya mata uang, kurs contoh, kategori khas, dan alasan.
- Total lintas kaki: `tripLintas` di `src/lib/titip/pricing.ts` (jasa, muatan, kapasitas, over, kaki
  paling ketat). Capex dipakai bersama semua kaki, dihitung sekali.
- Target omzet tetap indikator progres (keputusan pemilik, bukan pengubah harga otomatis).
- Meja (`src/desk/Desk.svelte`) dapat pemilih kaki (tombol berurutan) + panel kaki aktif (negara,
  jenis, lama) + daftar 10 negara. Asisten dapat tool baru: `pilih_kaki`, `tambah_kaki`,
  `sisip_transit`, `hapus_kaki`, `set_kaki`, `set_nama_trip`; `reset_arah` → `reset_kaki`.
- Verifikasi: `svelte-check` 0 error; `tsc -p src/convex` 0 error; 61 tes lulus; gate tasteskill
  `/` = 0 FAIL 0 WARN, `/meja` = 0 FAIL (1 WARN card-rows); uji browser: sisip transit, ganti
  destinasi, dan total lintas kaki bekerja.
- Bandingkan dengan template starter: [bandingkan-template.md](bandingkan-template.md).

## 15 Oktober 2026: akun pindah ke Convex (buang Postgres/Neon/PGlite)

- Auth + data akun kini di **Convex** via komponen resmi `@convex-dev/better-auth`
  (Better Auth tetap dipakai, `database` = Convex) + binding SvelteKit
  `@mmailaender/convex-better-auth-svelte`. Lihat [PR #11](https://github.com/official-manef/jastip/pull/11).
- Backend Convex: `convex.config`, `auth.config`, `auth`, `http`; tabel `profiles`,
  `titipan`, `tripScenarios`. Fungsi `accounts`/`titipan`/`tripScenarios` menegakkan
  peran, admin tunggal, validasi, dan isolasi per akun.
- SvelteKit mem-proxy `/api/auth/*` ke Convex HTTP actions; route app memakai
  `ConvexHttpClient` di server dengan token dari cookie Better Auth (otomatis).
- Hapus `pg`, `@electric-sql/pglite`, `kysely`, `migrations/*.sql`, migrator, dan
  `src/lib/db.ts`; `databaseReady()` selalu true sehingga produksi tidak lagi 503.
- Env: `PUBLIC_CONVEX_URL` (Vercel) + `SITE_URL`/`BETTER_AUTH_SECRET` (Convex).
- Verifikasi: typecheck 0 error (986 file); 77 unit test lulus; e2e sign-up/login/
  peran/titipan/trip/konflik/admin/AI lewat Convex; smoke render dev + build produksi
  bersih desktop+mobile; `npm run build` sukses.

## 15 Oktober 2026 (lanjutan): dua shell, PWA, landing terpusat

- Beranda `/` jadi landing publik sungguhan: tanpa sidebar, konten terpusat (x dan y), instrumen
  meja hidup di layar pertama. Meja hitung pindah ke `/meja` (masih tanpa login).
- Dua shell dalam satu `+layout.svelte`: halaman app (`/meja /portal /titip /asisten /pengaturan
  /admin`) memakai rail sidebar; `/` dan `/masuk` memakai shell publik terpusat. Tiap halaman app
  tak lagi memasang `max-w-*` sendiri (layout yang mengatur), jadi tak ada lagi konten mepet kiri.
- Konten app melebar ke `max-w-[68rem]` dan di-`mx-auto`; assistant `h-[calc(100dvh-12rem)]`.
- PWA diperbaiki: `start_url` `/meja`, `background_color`/`theme_color` `#eeecea`, ikon maskable
  192/512 baru (aman 80%), `screenshots` manifest (wide + narrow), `display_override`,
  shortcut Meja/Titipan/Asisten. Generator `scripts/brand-assets.mjs`.
- Navigasi: wordmark app menuju `/meja`; label aktif tampil di bar mobile; drawer tinggi penuh.
- Verifikasi: `svelte-check` 0 error; 57 tes lulus; gate tasteskill 0 FAIL 0 WARN di ketujuh halaman
  (allow rule khusus landing untuk layar app); build produksi lulus; smoke dev vs produksi identik.
- Catatan: pendaftaran akun di produksi masih 503 karena `DATABASE_URL` belum diset di Vercel
  (readiness `accountsReady:false`). Jalur DB dialihkan ke Convex oleh sesi lain.

## 15 Oktober 2026: arah visual baru (antislop) + motion

- Arah visual lama (krem `#F3EDE3` + terracotta + Fraunces/Outfit) diganti total memakai skill
  **design-taste-frontend** (tasteskill v2). Direction yang diundi: **the quiet instrument**
  (seed 2117912992) — kolom sempit, angka tabular besar, ruang kosong yang disengaja.
- Palet baru "Three stones": ground `#EEECEA`, surface `#E4E1DD`, field `#CDC3B6`, ink `#333231`,
  muted `#4A463F`, accent `#5C6B54`, rugi `#7D3A2B`. Satu huruf: **Clash Grotesk** (Fontshare).
- Aturan rumah skill diterapkan di seluruh aplikasi: buang garis tipis, kotak 1px, bayangan pada
  elemen diam, label kecil di atas judul, `animate-pulse`, `backdrop-blur`. Satu radius, satu bentuk
  tombol, body ≥16px, kontras muted ≥7:1.
- Motion: signature *slow crossfade* foto rute (3 gambar, pause saat tab disembunyikan), entrance
  `[data-reveal]` per bagian, feedback tekan, satu video rute loop senyap. Semua transform/opacity
  dengan fallback `prefers-reduced-motion`.
- Foto: 4 foto + 1 klip Wikimedia Commons (CC BY-SA) di `public/img`, kredit di footer + figcaption.
  Klip: "A ferry in the Bosphorus" (Kurmanbek, CC BY-SA 4.0).
- Navigasi dirapikan: rail desktop (>=lg), bar atas + drawer mobile. Dock bawah lama dibuang.
- Verifikasi: `svelte-check` 0 error; 57 tes lulus; gate tasteskill di `/` = **0 FAIL, 0 WARN**;
  halaman app (`/masuk /asisten /pengaturan /admin /titip /portal`) bersih selain rule khusus
  landing (few-pictures/focal-point/still-page — skill ini memang bukan untuk layar app);
  build produksi lulus; smoke dev vs produksi identik, 0 console error, tanpa overflow desktop+mobile.

## 14 Oktober 2026 (lanjutan 2): asisten AI + function calling

- Model & key AI boleh diset di env server: `AI_API_KEY` (server-only, tanpa prefix
  `VITE_`), `AI_API_BASE_URL`, `AI_MODEL`, `AI_ALLOWED_HOSTS`. Bila `AI_API_KEY` ada,
  pengguna langsung bisa chat; BYOK di `/pengaturan` tetap ada dan menimpa key server.
- Default model diperbaiki dari `"deepseakv4.1 flash"` (typo, ID tak valid) menjadi
  `ollama/deepseek-v4.1-flash:cloud` — ID persis penyedia conextlab (tools=true).
- Halaman baru `/asisten`: chat dengan **function calling**. Tool dijalankan di klien
  (`src/lib/titip/tools.ts`) sehingga perubahan langsung tampil di meja hitung.
- 15 tool: `ringkasan_trip, set_trip, set_opex, set_capex, tambah_barang, ubah_barang,
  hapus_barang, reset_arah, daftar_titipan, buat_titipan, ubah_status_titipan,
  daftar_orang, set_peran, usul_penutup_target, periksa_risiko`. Tool hanya membungkus
  aksi UI yang sudah ada; aturan peran, admin tunggal, validasi, dan CSRF tetap di server.
- State trip diangkat ke `src/lib/titip/trip-store.svelte.ts` supaya Desk dan asisten
  memakai satu sumber; simpan-muat (perangkat + akun) tetap seperti sebelumnya.
- `/api/ai` mengisi `baseUrl`/`model` dari env bila client tidak mengirim, dan `GET`
  hanya melaporkan apakah key server ada (tak pernah membocorkan key).
- Verifikasi: unit test AI 7/7; total tes aplikasi lulus; `svelte-check` 0 error; render
  smoke `/`, `/asisten`, `/pengaturan`, `/titip`, `/portal` bersih desktop+mobile; uji API
  dua akun PASS; E2E `/api/ai` mengembalikan `toolCalls:[set_trip]` memakai key env.
- Catatan: `deepseek-v4.1-flash` = `vision:false`, jadi lampiran gambar/camera belum didukung.

## 14 Oktober 2026 (lanjutan): PWA shell, Convex, pembersihan

- [PR #7](https://github.com/official-manef/jastip/pull/7): buang seluruh chrome Grok App Builder (plugin/middleware, `public/__grok`, brand-check, preview-bridge, app-data, gate auth). Ganti dengan PWA sendiri: `manifest.webmanifest`, service worker (offline shell), ikon 180/192/512 + maskable, `files.assets=public`.
- Navigasi satu sumber `src/lib/titip/nav.ts`: sidebar sticky desktop (>=lg), dock bawah + drawer dragable di mobile (dibuka tombol Menu paling kanan).
- [PR #8](https://github.com/official-manef/jastip/pull/8): `model.ts` 498→20 baris, sisakan formatter `idr`/`kg`/`group`.
- [PR #9](https://github.com/official-manef/jastip/pull/9): `.env.example` + script `convex:deploy`/`convex:dev`.
- Convex deployment `impressive-wildcat-570` (https://impressive-wildcat-570.convex.cloud) sudah di-deploy: fungsi `trip:get/ensure/save`, tabel `trips`.
- Modul murni baru: `risk.ts` (aturan risiko bea, wajib `source`+`checkedAt`, tanpa angka hukum bikinan) dan `suggest.ts` (rekomendasi proyeksi, dibatasi kapasitas). 23 tes baru; total 56 lulus, typecheck 0 error.
- **Keputusan: Neon/Postgres dihapus dari rencana.** Sumber data = Convex. Referensi Neon dibersihkan dari `.env.example`, README, dan `docs/konteks.md`.
- Konfigurasi Vercel (token, team id) disimpan di `.manef/config.json` (gitignored); template di `.manef/config.example.json`.

Hambatan: `PUBLIC_CONVEX_URL` belum dipasang di Vercel; koneksi Convex via Composio masih 401 `MissingAccessToken` (deploy dilakukan lewat deploy key lokal).

## 14 Oktober 2026: persistensi dan akses akun

Rilis perbaikan sudah digabung melalui [PR #3](https://github.com/official-manef/jastip/pull/3), commit `0f533edac3a3087d6c57f85dedff80915f4faee3`. Deployment produksi Vercel `dpl_2mkQDMfNZx26Qd2ErGeHQMVjVtN6` berstatus READY/PROMOTED.

[CI #38585204905](https://github.com/official-manef/jastip/actions/runs/38585204905) lulus. Screenshot desktop 1280×800 dan mobile 390×844 dari dev serta hasil build sudah diperiksa: tidak ada overflow, console error, page error, atau perbedaan baseline. Bukti tersedia pada artifact `jastip-render-evidence` di run tersebut.

Verifikasi produksi: perubahan mode PP dan jumlah kopi 4 menjadi 5 bertahan setelah refresh; status menampilkan lokasi penyimpanan perangkat. Skenario contoh kemudian dikembalikan ke default. Halaman `/masuk` menampilkan database belum tersedia, tombol login nonaktif, dan tidak menampilkan pilihan admin kepada pengunjung umum.

Draft [PR #1](https://github.com/official-manef/jastip/pull/1) tentang tarif campuran/multi-trip masih belum diimplementasikan. Dokumennya mencatat keputusan Fikran yang belum tersedia: mata uang jasa, kapan omzet diakui, definisi kapasitas 65 kg, pembayaran/refund, serta cakupan target USD 1.200 pada pergi atau PP. Rilis ini tidak menetapkan nilai atau aturan tersebut secara sepihak. Status proyek keseluruhan tetap belum selesai karena database produksi dan rancangan bisnis tersebut.

- Pengunjung menyimpan kalkulasi di perangkat; status lokasi simpan ditampilkan dengan jelas.
- Trip akun memakai Postgres melalui `/api/trip`, satu skenario per sesi pengguna. UI tidak lagi memanggil dokumen Convex bersama yang dapat ditulis tanpa autentikasi.
- Penulisan akun berjalan berurutan; respons pemuatan yang terlambat tidak menimpa perubahan input pengguna. Gagal sinkronisasi menyisakan salinan lokal dan tombol mencoba kembali.
- Admin hanya dapat diambil oleh ID akun yang ditetapkan operator. Peran klien/jastiper tetap terkunci setelah dipilih.
- Produksi tanpa `DATABASE_URL` mengembalikan 503 untuk operasi akun, dan menampilkan keterangan bahwa login belum aktif. PGLite tidak digunakan sebagai penyimpanan akun produksi.
- Login akun lama tidak lagi meminta pilihan peran lebih dahulu. Isian barang menolak harga negatif dan berat tidak valid dengan pesan terlihat.
- Build dan pemeriksaan tipe lulus lokal. Unit test: 252 lulus, empat pemeriksaan dokumentasi skill Grok dilewati karena dokumennya tidak termasuk repo standalone. Uji API dua akun lulus untuk auth, batas admin, CSRF, validasi, isolasi trip dan titipan.
- CI ditambahkan untuk tes, build, dan render desktop/mobile. Verifikasi browser lokal terhambat unduhan Chromium yang kosong; hasil render CI dan produksi harus diverifikasi sebelum dinyatakan siap.

Hambatan produksi (riwayat 14 Okt): Neon belum terhubung pada manef-composio dan `DATABASE_URL` belum tersedia di Vercel. Keputusan lanjutan: Neon dihapus dari rencana; sumber data memakai Convex.

Catatan 10 Oktober di bawah adalah riwayat, bukan status produksi terkini.

## 10 Oktober 2026

### Meja

Satu layar, bukan marketplace. Sidebar kuota, kg, harga, opex, capex. Rute dikunci Jakarta ↔ Turki. Pergi saja atau PP. PP menjumlahkan tiket dan biaya kaki lain. Capex sekali.

Data uji sempat di browser, lalu pindah ke Convex. Dokumen trip `live` benar-benar tersimpan dan bertahan setelah muat ulang, selama backend Convex hidup.

### Tumpukan

Aplikasi ini SvelteKit, bukan pulau Svelte di dalam React. Fungsi Convex ada di `src/convex/`. Build dan deploy memakai Bun 1.4.3 dan adapter Vercel.

Situs publik: [jastip-ochre.vercel.app](https://jastip-ochre.vercel.app). Proyek Vercel `jastip` di tim `manef`, terhubung ke [official-manef/jastip](https://github.com/official-manef/jastip). Push `main` membangun ulang.

### Akun

Masuk Google dan X. Tiga peran: klien, jastiper, admin (pengembang).

- Skema akun disalin ke `migrations/0001_auth.sql`.
- Peran dan titipan di `migrations/0002_roles.sql`.
- API: `/api/saya`, `/api/peran`, `/api/titipan`, `/api/admin`.
- Admin hanya satu. Indeks unik menolak admin kedua. Admin terakhir tidak bisa diturunkan.

Env yang sudah dipasang di Vercel: `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GROK_AUTH_ISSUER`, `VITE_AUTH_ENABLED`.

Belum terpasang: `DATABASE_URL`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET`, `PUBLIC_CONVEX_URL`. Neon ada di akun tim, tetapi belum dihubungkan ke proyek ini. Karena itu akun sungguhan di situs publik belum bisa disimpan, dan meja di situs publik belum menulis ke Convex cloud.

### Portal contoh

`/portal` memuat dashboard tanpa login.

- Sari Wulandari, klien, Jakarta.
- Raka Wijaya, jastiper, Jakarta.
- Manef, admin.
- Deniz Kaya muncul sebagai klien lain di antrean, bukan sebagai pintu masuk.

Tambah barang, ubah status, dan ubah peran di portal hanya hidup di halaman itu.

### Tampilan

Palet tetap: krem `#F3EDE3`, tinta `#1C1917`, jade `#0F6E56`, terracotta `#B8431C`. Waybill, angka tabular, tanpa gradasi dan tanpa ikon emoji.

## Belum

- Memasang `PUBLIC_CONVEX_URL` di Vercel supaya skenario trip menulis ke Convex.
- Menyambungkan UI trip ke fungsi Convex (`trip:get/save`).
- Rute selain Jakarta ↔ Turki.

Catatan: Neon/Postgres dihapus dari rencana; sumber data memakai Convex.
