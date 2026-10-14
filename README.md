# titipin

Kalkulator bagasi jastip untuk **satu rute: Jakarta ↔ Turki**. Bukan marketplace multi-kota. Satu meja hitung yang langsung berubah, plus akun untuk klien, jastiper, dan admin.

Situs: [jastip-ochre.vercel.app](https://jastip-ochre.vercel.app)

## Yang sudah jalan

- Meja trip: kuota bagasi, muatan per kg, harga per kg, opex, capex, laba.
- Arah `Jakarta → Turki` dan `Turki → Jakarta`.
- Mode **pergi saja** atau **pulang-pergi**. PP menjumlahkan tiket dan opex kedua kaki. Capex dihitung sekali.
- Kalkulasi pengunjung tersimpan di perangkat. Skenario trip akun tersimpan di Convex (`trips`), dibatasi oleh sesi pengguna pada kode aplikasi.
- Login mandiri memakai email/password. Peran: klien, jastiper, admin. Admin hanya satu dan ditetapkan operator melalui ID akun, bukan dipilih pengunjung pertama.
- AI BYOK di `/pengaturan`: URL/model custom yang diizinkan operator. API key hanya berada di memori halaman dan diteruskan ke penyedia saat pengguna meminta.
- Titipan per akun, dan antrean untuk jastiper.
- Portal contoh di `/portal` supaya dashboard kelihatan tanpa akun sungguhan.

Rincian keputusan ada di [docs/konteks.md](docs/konteks.md). Riwayat ada di [docs/progress.md](docs/progress.md).

## Halaman

| Path | Untuk siapa | Isi |
| --- | --- | --- |
| `/` | Semua, rumah jastiper | Meja hitung |
| `/portal` | Semua | Dashboard contoh: Sari (klien), Raka (jastiper), Manef (admin) |
| `/masuk` | Belum masuk | Email/password; peran dipilih untuk akun baru |
| `/pengaturan` | Semua; panggilan AI untuk akun login | URL/model penyedia dan BYOK |
| `/titip` | Klien, jastiper, admin | Permintaan titipan |
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

## AI BYOK

- `AI_API_BASE_URL`: default `https://token.conextlab.ai/v1`.
- `AI_MODEL`: default `deepseakv4.1 flash`, sesuai input pengguna; ID API penyedia belum terverifikasi. Tombol **Ambil daftar model** mengambil `/models` memakai key pengguna.
- `AI_ALLOWED_HOSTS`: daftar host HTTPS yang diizinkan, dipisahkan koma; default host base URL. Contoh `token.conextlab.ai,provider.example`. Tambahkan host custom sebelum menggunakannya. Proxy/egress lingkungan harus mengizinkan host yang sama.
- Tidak ada shared `AI_API_KEY` atau key `VITE_*`. Key pengguna tidak disimpan ke database, localStorage, atau sessionStorage. Preferensi URL/model dapat disimpan secara eksplisit di perangkat.
- Endpoint harus kompatibel dengan OpenAI `/models` dan `/chat/completions`. Request AI membutuhkan sesi login, tidak mengikuti redirect, dan dibatasi 512 token keluaran serta 4.000 karakter pertanyaan.
- Konfigurasi berada di server SvelteKit/Vercel. Fungsi trip Convex saat ini tidak membutuhkan env AI.
- Untuk CLI/CI Convex, gunakan `CONVEX_DEPLOY_KEY` dari Settings deployment. `CONVEX_OVERRIDE_ACCESS_TOKEN` adalah override internal CLI, bukan nama variabel deploy key.

Pengujian BYOK dan auth mandiri:

```bash
node --experimental-strip-types --test src/lib/titip/ai.test.ts src/lib/auth/gate-identity.test.ts src/lib/auth/sign-in-gate.test.ts
```

`npm test` menjalankan tes aplikasi dan platform. `npm run test:trip-api` membuat akun sintetis pada server lokal dan memeriksa batas admin serta isolasi dua akun. Script ini menolak origin selain localhost.

CI memeriksa build, tipe, unit test, API akun lokal, dan render desktop/mobile pada dev serta hasil build. Akun produksi/BYOK sungguhan diuji terhadap backend yang dikonfigurasi operator.

## Desain

Kertas krem `#F3EDE3`, tinta `#1C1917`, jade `#0F6E56`, terracotta `#B8431C`. Huruf Fraunces dan Outfit. Nada waybill, bukan dashboard ungu.

## Repo

[official-manef/jastip](https://github.com/official-manef/jastip), cabang `main`. Push ke `main` membangun ulang situs Vercel.
