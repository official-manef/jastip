# titipin

Kalkulator bagasi jastip **multi-negara**: trip disusun sebagai daftar kaki (penerbangan) berurutan, tiap kaki punya negara, mata uang belanja, dan muatannya sendiri. Plus akun untuk klien, jastiper, dan admin.

Situs: [jastip-ochre.vercel.app](https://jastip-ochre.vercel.app)

## Yang sudah jalan

- **Trip berkaki bebas**: 1, 2, 3, atau lebih kaki; tiap kaki pilih negara dari katalog. Transit = kaki bertanda khusus yang tetap boleh diisi barang.
- Katalog 10 negara tujuan populer untuk pasar Indonesia + Turki (koridor lama): Jepang, Korea, Singapura, Hong Kong, Thailand, Amerika, Prancis, Malaysia, Jerman, Australia.
- Meja per kaki: kuota bagasi, muatan per kg, harga per kg, opex, capex; total lintas kaki (jasa, muatan, kapasitas, laba) dihitung sekaligus.
- Capex (koper, timbangan) dipakai bersama semua kaki, dibagi umur trip, dihitung sekali.
- Target omzet sebagai indikator progres (batang + "butuh lagi"), bukan pengubah harga otomatis.
- Kalkulasi pengunjung tersimpan di perangkat. Skenario trip akun tersimpan di Convex (`tripScenarios`), dibatasi oleh sesi pengguna.
- Login mandiri memakai email/password. Peran: klien, jastiper, admin. Admin hanya satu dan ditetapkan operator melalui ID akun.
- Asisten AI di `/asisten` dengan **function calling**: bisa menyusun kaki, ganti destinasi, isi muatan, dan ubah peran.
- Titipan per akun, dan antrean untuk jastiper.
- Portal contoh di `/portal` supaya dashboard kelihatan tanpa akun sungguhan.
- Beranda mengajak tiga langkah: **Gratis** (meja hitung tanpa akun) → **Akun** (daftar gratis) → **Langganan** (`/` seksi `#paket`). Harga contoh; belum ada gating atau pembayaran.
- PWA: `manifest.webmanifest` (start_url `/meja`, ikon maskable, screenshot manifest), service worker offline shell + toast "versi baru". Dua shell layout: beranda/masuk tanpa sidebar dan terpusat; halaman app memakai rail sidebar.

Rincian keputusan ada di [docs/konteks.md](docs/konteks.md). Riwayat ada di [docs/progress.md](docs/progress.md). Bahasa visual ada di [DESIGN.md](DESIGN.md). Perbandingan dengan template starter ada di [docs/bandingkan-template.md](docs/bandingkan-template.md).

## Model trip

Satu trip = daftar **kaki** (penerbangan) berurutan. Tiap kaki menyimpan: destinasi (kode katalog),
jenis (`utama` atau `transit`), lama (hari untuk utama, jam untuk transit), dan skenario lengkap
(kuota bagasi, barang, opex, capex). Total trip menjumlahkan jasa, muatan, dan kapasitas semua kaki.

- **Transit** = kaki bertanda `transit`: kuota bagasi kecil, opex ringan, tetap boleh diisi barang.
- **Capex** (koper, timbangan) dipakai bersama seluruh kaki; dibagi umur trip, dihitung sekali.
- **Target omzet** = indikator progres di kaki aktif (batang + "butuh lagi"), bukan pengubah harga otomatis.
- Trip lama (v1: satu koridor `dir`/`mode`) dimigrasi otomatis ke daftar kaki saat dibaca.

Sumber: `src/lib/titip/destinasi.ts` (katalog), `src/lib/titip/kaki.ts` (tipe + migrasi),
`src/lib/titip/pricing.ts` (`tripLintas`), `src/lib/titip/trip-state.ts` (skema v2 + zod).

## Halaman

| Path | Untuk siapa | Isi | Shell |
| --- | --- | --- | --- |
| `/` | Semua | Beranda publik: instrumen hidup, rute, paket (Gratis/Akun/Langganan), peran | Publik (tanpa sidebar, konten terpusat) |
| `/meja` | Semua | Meja hitung multi-kaki | App (sidebar) |
| `/portal` | Semua | Dashboard contoh: Sari (klien), Raka (jastiper), Manef (admin), Deniz (klien lain) | App |
| `/masuk` | Belum masuk | Email/password; peran dipilih untuk akun baru | Publik |
| `/pengaturan` | Semua; panggilan AI untuk akun login | URL/model penyedia dan API key (BYOK) | App |
| `/titip` | Klien, jastiper, admin | Permintaan titipan | App |
| `/asisten` | Klien, jastiper, admin | Chat AI dengan function calling | App |
| `/admin` | Admin | Daftar orang dan peran | App |

Dua shell di satu layout: halaman app memakai rail sidebar + area kerja penuh; beranda dan masuk
tidak memakai sidebar dan menaruh kontennya di tengah layar. Meja tidak dikunci login.

## Tumpukan

SvelteKit, Svelte 5, Bun, Tailwind, Better Auth, Convex, Vercel.

Meja aktif memakai perangkat (localStorage) untuk pengunjung. Convex menyimpan data akun (profiles, titipan, tripScenarios), deployment `impressive-wildcat-570`.

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

## Env di Vercel

Ditetapkan operator di project `manef/jastip`:

| Nama | Fungsi |
| --- | --- |
| `PUBLIC_CONVEX_URL` | URL backend Convex, mis. `https://impressive-wildcat-570.convex.cloud` |
| `TITIPIN_ADMIN_USER_ID` | ID akun admin tunggal (opsional) |

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

Foto rute di meja berasal dari Wikimedia Commons (CC BY-SA), bukan hasil produk Titipin; kredit ada di
footer dan figcaption.

## Repo

[official-manef/jastip](https://github.com/official-manef/jastip), cabang `main`. Push ke `main` membangun ulang situs Vercel.
