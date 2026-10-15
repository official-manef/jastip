# titipin

Kalkulator bagasi jastip untuk **satu rute: Jakarta ↔ Turki**. Bukan marketplace multi-kota. Satu meja hitung yang langsung berubah, plus akun untuk klien, jastiper, dan admin.

Situs: [jastip-ochre.vercel.app](https://jastip-ochre.vercel.app)

## Yang sudah jalan

- Meja trip: kuota bagasi, muatan per kg, harga per kg, opex, capex, laba.
- Arah `Jakarta → Turki` dan `Turki → Jakarta`.
- Mode **pergi saja** atau **pulang-pergi**. PP menjumlahkan tiket dan opex kedua kaki. Capex dihitung sekali.
- Kalkulasi pengunjung tersimpan di perangkat. Skenario trip akun tersimpan di Convex (`trips`), dibatasi oleh sesi pengguna pada kode aplikasi.
- Login mandiri memakai email/password. Peran: klien, jastiper, admin. Admin hanya satu dan ditetapkan operator melalui ID akun, bukan dipilih pengunjung pertama.
- Asisten AI di `/asisten` dengan **function calling**: bisa langsung mengubah meja hitung, titipan, dan peran. Model & key dari env server; BYOK opsional di `/pengaturan`.
- Titipan per akun, dan antrean untuk jastiper.
- Portal contoh di `/portal` supaya dashboard kelihatan tanpa akun sungguhan.

Rincian keputusan ada di [docs/konteks.md](docs/konteks.md). Riwayat ada di [docs/progress.md](docs/progress.md). Bahasa visual ada di [DESIGN.md](DESIGN.md).

## Halaman

| Path | Untuk siapa | Isi |
| --- | --- | --- |
| `/` | Semua, rumah jastiper | Meja hitung |
| `/portal` | Semua | Dashboard contoh: Sari (klien), Raka (jastiper), Manef (admin), Deniz (klien lain) |
| `/masuk` | Belum masuk | Email/password; peran dipilih untuk akun baru |
| `/pengaturan` | Semua; panggilan AI untuk akun login | URL/model penyedia dan BYOK (opsional bila key server ada) |
| `/titip` | Klien, jastiper, admin | Permintaan titipan |
| `/asisten` | Klien, jastiper, admin | Chat AI dengan function calling |
| `/admin` | Admin | Daftar orang dan peran |

Meja tidak dikunci login.

## Tumpukan

SvelteKit, Svelte 5, Bun, Tailwind, Better Auth, Convex, Vercel.

Meja aktif memakai perangkat (localStorage) untuk pengunjung. Convex menyimpan skenario trip (`trips`), deployment `impressive-wildcat-570`. PGlite dipakai untuk pengembangan lokal saat tidak ada backend.

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

## Env di Vercel

Ditetapkan operator di project `manef/jastip`:

| Nama | Fungsi |
| --- | --- |
| `BETTER_AUTH_URL` | Origin publik situs |
| `BETTER_AUTH_SECRET` | Menandatangani sesi |
| `VITE_AUTH_ENABLED` | `true` |
| `PUBLIC_CONVEX_URL` | URL backend Convex, `https://impressive-wildcat-570.convex.cloud` |

`PUBLIC_CONVEX_URL` dipakai untuk menyambung skenario trip ke Convex. Trip juga tersedia pada `trip_scenarios` lokal; `user_id` selalu berasal dari sesi server. Operator menetapkan `TITIPIN_ADMIN_USER_ID` ke ID akun pemilik setelah akun tersebut dibuat. Pada permintaan berikutnya akun itu dapat menjadi satu-satunya admin; indeks unik tetap menolak admin kedua. Jangan memakai email yang belum diverifikasi sebagai bukti kepemilikan admin.

Token Vercel dan Team ID disimpan di `.manef/config.json` (gitignored), tidak pernah di commit.

Login memakai email/password mandiri (tidak ada OAuth broker). Tidak ada konfigurasi email reset/verifikasi; fitur tersebut belum disediakan.

## AI

Setelan default ada di **env server** (mode "env saja"): kalau `AI_API_KEY` diisi, pengguna bisa langsung chat tanpa mengisi key. Key pengguna (BYOK) tetap didukung lewat `/pengaturan` dan menimpa key server bila diisi.

- `AI_API_KEY`: key server (server-only, tanpa prefix `VITE_`). Kosong = wajib BYOK.
- `AI_API_BASE_URL`: default `https://token.conextlab.ai/v1`.
- `AI_MODEL`: default `ollama/deepseek-v4.1-flash:cloud` (tools aktif, tanpa vision). Tombol **Ambil daftar model** mengambil `/models`.
- `AI_ALLOWED_HOSTS`: daftar host HTTPS yang diizinkan, dipisahkan koma; default host base URL.
- Key pengguna tidak disimpan ke database, localStorage, atau sessionStorage. Preferensi URL/model dapat disimpan eksplisit di perangkat.
- Endpoint harus kompatibel OpenAI `/models` dan `/chat/completions`. Request AI butuh sesi login, tidak mengikuti redirect, dan dibatasi output 2.048 token.

**Function calling** (`src/lib/titip/tools.ts`) membungkus aksi UI yang sudah ada, dijalankan di klien lewat store trip dan `/api/*`. Aturan peran, admin tunggal, validasi, dan batas tetap ditegakkan server. Tool: `ringkasan_trip`, `set_trip`, `set_opex`, `set_capex`, `tambah_barang`, `ubah_barang`, `hapus_barang`, `reset_arah`, `daftar_titipan`, `buat_titipan`, `ubah_status_titipan`, `daftar_orang`, `set_peran`, `usul_penutup_target`, `periksa_risiko`.

Catatan: model ini `vision=false`, jadi lampiran gambar/camera belum didukung.

Pengujian AI dan auth mandiri:

```bash
node --experimental-strip-types --test src/lib/titip/ai.test.ts src/lib/auth/gate-identity.test.ts src/lib/auth/sign-in-gate.test.ts
```

`npm test` menjalankan tes aplikasi dan platform. `npm run test:trip-api` membuat akun sintetis pada server lokal dan memeriksa batas admin serta isolasi dua akun. Script ini menolak origin selain localhost.

CI memeriksa build, tipe, unit test, API akun lokal, dan render desktop/mobile pada dev serta hasil build. Akun produksi/BYOK sungguhan diuji terhadap backend yang dikonfigurasi operator.

## Desain

Art direction: **the quiet instrument** (tasteskill v2, seed 2117912992). Palet "Three stones":
ground `#EEECEA`, surface `#E4E1DD`, field `#CDC3B6`, ink `#333231`, muted `#4A463F`, accent jade
`#5C6B54`, rugi `#7D3A2B`. Satu huruf: **Clash Grotesk** (Fontshare). Permukaan dipisah oleh tone,
bukan garis atau bayangan. Rincian di [DESIGN.md](DESIGN.md).

Foto rute di meja berasal dari Wikimedia Commons (CC BY-SA), bukan hasil produk Titipin; kredit ada di
footer dan figcaption.

## Repo

[official-manef/jastip](https://github.com/official-manef/jastip), cabang `main`. Push ke `main` membangun ulang situs Vercel.
