# titipin

Kalkulator bagasi jastip **multi-negara**: trip disusun sebagai daftar tahap (penerbangan) berurutan, tiap tahap punya negara, mata uang belanja, dan muatannya sendiri. Plus akun untuk klien, jastiper, dan admin.

Situs: [jastip-ochre.vercel.app](https://jastip-ochre.vercel.app)

## Yang sudah jalan

- **Trip bertahap bebas**: 1, 2, 3, atau lebih tahap; tiap tahap pilih negara dari katalog. Transit = tahap bertanda khusus yang tetap boleh diisi barang.
- **Katalog 25 negara** per kawasan (Asia Tenggara, Asia Timur, Asia Selatan, Timur Tengah, Afrika, Eropa, Amerika, Oseania) + Turki. Negara yang belum ada bisa ditambahkan lewat opsi **"Negara lain…"** di dropdown (nama, kota, mata uang, kurs) — hindari isian bebas.
- **Meja jadi wizard ala booking pesawat**: stepper Rute → Muatan → Biaya → Ringkasan, plus ringkasan lengket (sticky) berisi sisa kuota, muatan, jasa/beban/laba trip.
- Kalkulator per tahap: kuota bagasi, muatan per kg, harga per kg, biaya jalan, biaya alat; total lintas tahap (jasa, muatan, kapasitas, laba) dihitung sekaligus.
- Biaya alat (koper, timbangan) dipakai bersama semua tahap, dibagi umur trip, dihitung sekali.
- Target omzet sebagai indikator progres (batang + "butuh lagi"), bukan pengubah harga otomatis.
- Kalkulasi pengunjung tersimpan di perangkat. Skenario trip akun tersimpan di Convex (`tripScenarios`), dibatasi oleh sesi pengguna.
- Login mandiri memakai email/password. Peran yang ditawarkan ke pengunjung: **klien** dan **jastiper** (saling menemukan). Admin hanya untuk operator (`TITIPIN_ADMIN_USER_ID`), tak ditampilkan di antarmuka publik.
- Asisten AI di `/asisten` dengan **function calling**: bisa menyusun tahap, ganti destinasi, isi muatan, dan ubah peran.
- Titipan per akun, dan antrean untuk jastiper.
- Portal contoh di `/portal` supaya dashboard kelihatan tanpa akun sungguhan. Hanya menampilkan klien dan jastiper (keduanya saling menemukan); admin tak ditampilkan.
- Beranda mengajak tiga langkah: **Coba** (kalkulator tanpa akun) → **Akun** (daftar gratis) → **Langganan** (`/` seksi `#paket`). Harga contoh; belum ada gating atau pembayaran.
- PWA: `manifest.webmanifest` (start_url `/meja`, ikon maskable, screenshot manifest), service worker offline shell + toast "versi baru". Dua shell layout: beranda/masuk tanpa sidebar dan terpusat; halaman app memakai rail sidebar.

Rincian keputusan ada di [docs/konteks.md](docs/konteks.md). Riwayat ada di [docs/progress.md](docs/progress.md). Bahasa visual ada di [DESIGN.md](DESIGN.md). Perbandingan dengan template starter ada di [docs/bandingkan-template.md](docs/bandingkan-template.md).

## Model trip

Satu trip = daftar **tahap** (penerbangan) berurutan. Tiap tahap menyimpan: destinasi (kode katalog),
jenis (`utama` atau `transit`), lama (hari untuk utama, jam untuk transit), dan skenario lengkap
(kuota bagasi, barang, biaya jalan, biaya alat). Total trip menjumlahkan jasa, muatan, dan kapasitas semua tahap.

- **Transit** = tahap bertanda `transit`: kuota bagasi kecil, biaya jalan ringan, tetap boleh diisi barang.
- **Biaya alat** (koper, timbangan) dipakai bersama seluruh tahap; dibagi umur trip, dihitung sekali.
- **Target omzet** = indikator progres di tahap aktif (batang + "butuh lagi"), bukan pengubah harga otomatis.
- Trip lama (v1: satu koridor `dir`/`mode`) dimigrasi otomatis ke daftar tahap saat dibaca.

- **Kurs dinamis**: `/api/kurs` mengambil kurs dari `open.er-api.com` (gratis, tanpa key), cache 6 jam, dan menampilkan **tanggal update** ("Kurs per 16 Okt 2026"). Bila provider gagal, UI jatuh ke kurs seed katalog dan menandainya "Kurs contoh".
- **Dashboard per peran** di `/dashboard`: klien (titipan + status + langganan), jastiper (titipan masuk + kapasitas trip), admin (orang + peran + titipan). Data asli dari Convex, bukan contoh.
- **Langganan (scaffold DOKU)**: tabel `subscriptions` + `/api/langganan` (buat invoice `pending`) + webhook `/api/doku/webhook`. Pembayaran nyata belum aktif — butuh kredensial DOKU.

Sumber: `src/lib/titip/destinasi.ts` (katalog), `src/lib/titip/kaki.ts` (tipe + migrasi),
`src/lib/titip/kurs.ts` + `kurs-store.svelte.ts` (kurs dinamis), `src/lib/titip/pricing.ts`
(`tripLintas`), `src/lib/titip/trip-state.ts` (skema v2 + zod).

## Halaman

| Path | Untuk siapa | Isi | Shell |
| --- | --- | --- | --- |
| `/` | Semua | Beranda publik: instrumen hidup, rute, paket, peran | Publik (tanpa sidebar, konten terpusat) |
| `/dashboard` | Klien, jastiper, admin | Dashboard sesuai peran (data asli) | App |
| `/meja` | Semua | Kalkulator bagasi multi-tahap | App (sidebar) |
| `/portal` | Semua | Dashboard contoh: Sari & Deniz (klien), Raka (jastiper) — klien dan jastiper saling menemukan | App |
| `/masuk` | Belum masuk | Email/password; peran dipilih untuk akun baru | Publik |
| `/pengaturan` | Semua; panggilan AI untuk akun login | URL/model penyedia dan API key (BYOK) | App |
| `/titip` | Klien, jastiper, admin | Permintaan titipan | App |
| `/asisten` | Klien, jastiper, admin | Chat AI dengan function calling | App |
| `/admin` | Admin | Daftar orang dan peran | App |

Dua shell di satu layout: halaman app memakai rail sidebar + area kerja penuh; beranda dan masuk
tidak memakai sidebar dan menaruh kontennya di tengah layar. Kalkulator tidak dikunci login.

## Tumpukan

SvelteKit, Svelte 5, Bun, Tailwind, Better Auth, Convex, Vercel.

Kalkulator aktif memakai perangkat (localStorage) untuk pengunjung. Convex menyimpan data akun (profiles, titipan, tripScenarios), deployment `impressive-wildcat-570`.

## Menjalankan

```bash
bun install --frozen-lockfile
npm run dev
```

Perintah lain:

```bash
npm run typecheck
npm run build
```

Jangan buat file `.env`. Rahasia tidak masuk repo.

## Arsitektur data

Auth akun dan data aplikasi semuanya di **Convex** (komponen resmi `@convex-dev/better-auth`). Better Auth tetap dipakai (email/password), tetapi `database`-nya adalah Convex — tidak ada Postgres/Neon.

- Tabel auth (users/sessions/accounts) hidup di komponen `betterAuth`; tabel app: `profiles`, `titipan`, `tripScenarios`, `trips`.
- SvelteKit mem-proxy `/api/auth/*` ke Convex HTTP actions (`*.convex.site`).
- Route app (`/api/saya,peran,admin,titipan,trip,trips`) memakai `ConvexHttpClient` di server; token dari cookie Better Auth dibaca otomatis via `withServerConvexToken` di `hooks.server.ts`. Isi logika ada di `src/convex/*` (`accounts.ts`, `titipan.ts`, `tripScenarios.ts`).
- Auth client di browser (`src/lib/auth/client.ts`) memakai plugin `convexClient()` untuk menukar sesi jadi JWT Convex.

## Kurs dinamis

Kurs (rupiah per 1 unit mata uang) diambil dari `open.er-api.com` lewat `/api/kurs`
(gratis, tanpa key), cache in-memory 6 jam. Setiap respons membawa `updatedAt`, dan UI
menampilkan **"Kurs per tanggal"**. Bila provider gagal, dipakai kurs seed katalog dan
ditandai **"Kurs contoh"** — kalkulator tetap jalan.

- Modul murni: `src/lib/titip/kurs.ts` (normalisasi + tanggal). Store klien:
  `kurs-store.svelte.ts` (menulis ke `setKursLive`, dibaca `viewOf`).
- Angka kurs **tidak** ikut tersimpan di state trip; hanya dipakai untuk tampilan/pemilih.

## Langganan (scaffold DOKU)

Struktur siap, pembayaran nyata belum aktif (butuh kredensial merchant DOKU):

- Tabel Convex `subscriptions` (`status`: pending/aktif/batal/kadaluarsa) + `subscriptions.ts`
  (`mine`, `buatInvoice`, `tandaiBayar`). Harga paket ditentukan server, bukan klien.
- Route: `GET/POST /api/langganan` (status + buat invoice `pending`),
  `POST /api/doku/webhook` (ubah status; butuh `DOKU_WEBHOOK_SECRET`).
- Dashboard `/dashboard` menampilkan status langganan + tombol "Langganan Pro".

Cara mengaktifkan nanti: isi `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_API_BASE_URL`
(server-only) + `DOKU_WEBHOOK_SECRET` di Vercel **dan** Convex
(`npx convex env set DOKU_WEBHOOK_SECRET ...`), lalu ganti route webhook agar memakai
signature resmi DOKU. Jangan pernah menaruh kredensial di chat.

## Env di Vercel

Ditetapkan operator di project `manef/jastip`:

| Nama | Fungsi |
| --- | --- |
| `PUBLIC_CONVEX_URL` | URL backend Convex, mis. `https://impressive-wildcat-570.convex.cloud` |
| `TITIPIN_ADMIN_USER_ID` | ID akun admin tunggal (opsional) |
| `DOKU_WEBHOOK_SECRET` | Rahasia webhook DOKU (langganan; set di Vercel **dan** Convex) |
| `DOKU_CLIENT_ID` / `DOKU_SECRET_KEY` / `DOKU_API_BASE_URL` | Checkout DOKU (server-only; diisi saat langganan diaktifkan) |

Asisten AI mode **BYOK**: tidak ada key server, pengguna mengisi key penyedia sendiri di `/pengaturan`. Tidak ada env AI di Vercel.

Di **Convex** (bukan Vercel): `npx convex env set SITE_URL https://situs-anda` dan `BETTER_AUTH_SECRET`. `TITIPIN_ADMIN_USER_ID` dibaca fungsi Convex, jadi set juga di sana bila dipakai.

Operator menetapkan `TITIPIN_ADMIN_USER_ID` ke ID akun pemilik setelah akun dibuat; admin tetap satu dan admin terakhir tidak bisa diturunkan. Jangan memakai email yang belum diverifikasi sebagai bukti kepemilikan admin.

Token Vercel dan Team ID disimpan di `.manef/config.json` (gitignored), tidak pernah di commit.

Login memakai email/password mandiri (tidak ada OAuth broker). Belum ada reset password/verifikasi email.

## AI

Asisten AI memakai **BYOK murni**: tidak ada key server. Pengguna mengisi URL penyedia, ID model, dan API key sendiri di `/pengaturan`; key tidak disimpan ke database, localStorage, atau sessionStorage.

- Endpoint harus HTTPS publik (localhost/jaringan privat ditolak), kompatibel OpenAI `/models` dan `/chat/completions`.
- Request AI butuh sesi login, tidak mengikuti redirect, dan dibatasi output 2.048 token.
- Preferensi URL/model dapat disimpan eksplisit di perangkat.

**Function calling** (`src/lib/titip/tools.ts`) membungkus aksi UI yang sudah ada, dijalankan di klien lewat store trip dan `/api/*`. Aturan peran, admin tunggal, validasi, dan batas tetap ditegakkan server. Tool: `ringkasan_trip`, `set_trip`, `set_nama_trip`, `set_opex`, `set_capex`, `tambah_barang`, `ubah_barang`, `hapus_barang`, `pilih_kaki`, `tambah_kaki`, `sisip_transit`, `hapus_kaki`, `set_kaki`, `reset_kaki`, `daftar_titipan`, `buat_titipan`, `ubah_status_titipan`, `daftar_orang`, `set_peran`, `usul_penutup_target`, `periksa_risiko`.

Catatan: dukungan lampiran gambar/camera tergantung model yang dipilih pengguna.

Pengujian AI dan auth:

```bash
npm test
npm run test:trip-api
```

`npm test` menjalankan tes aplikasi. `npm run test:trip-api` membuat akun sintetis pada server lokal (lewat Convex) dan memeriksa batas admin serta isolasi dua akun. Script ini menolak origin selain localhost.

CI memeriksa build, tipe, unit test, API akun lokal, dan render desktop/mobile pada dev serta hasil build. Akun produksi diuji terhadap backend Convex yang dikonfigurasi operator.

## Desain

Art direction: **the quiet instrument** (tasteskill v2, seed 2117912992). Palet "Three stones":
ground `#EEECEA`, surface `#E4E1DD`, field `#CDC3B6`, ink `#333231`, muted `#4A463F`, accent jade
`#5C6B54`, rugi `#7D3A2B`. Satu huruf: **Clash Grotesk** (Fontshare). Permukaan dipisah oleh tone,
bukan garis atau bayangan. Rincian di [DESIGN.md](DESIGN.md).

Foto rute di kalkulator berasal dari Wikimedia Commons (CC BY-SA), bukan hasil produk Titipin; kredit ada di
footer dan figcaption.

## Repo

[official-manef/jastip](https://github.com/official-manef/jastip), cabang `main`. Push ke `main` membangun ulang situs Vercel.
