# titipin

Kalkulator bagasi jastip untuk **satu rute: Jakarta ↔ Turki**. Bukan marketplace multi-kota. Satu meja hitung yang langsung berubah, plus akun untuk klien, jastiper, dan admin.

Situs: [jastip-ochre.vercel.app](https://jastip-ochre.vercel.app)

## Yang sudah jalan

- Meja trip: kuota bagasi, muatan per kg, harga per kg, opex, capex, laba.
- Arah `Jakarta → Turki` dan `Turki → Jakarta`.
- Mode **pergi saja** atau **pulang-pergi**. PP menjumlahkan tiket dan opex kedua kaki. Capex dihitung sekali.
- Kalkulasi pengunjung tersimpan di perangkat. Trip akun memakai Postgres, dibatasi oleh sesi pengguna, dan dapat dibuka lintas perangkat setelah database produksi aktif.
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

SvelteKit, Svelte 5, Bun, Postgres, Tailwind, Better Auth, Vercel.

Akun, titipan, dan trip pribadi memakai Postgres. PGLite hanya untuk pengembangan lokal; produksi menolak operasi akun tanpa database permanen. Fungsi Convex lama tetap tersimpan di repo tetapi tidak dipanggil UI dan tidak diterbitkan oleh perubahan ini.

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

Sudah dipasang di production, preview, dan development:

| Nama | Fungsi |
| --- | --- |
| `BETTER_AUTH_URL` | Origin publik situs |
| `BETTER_AUTH_SECRET` | Menandatangani sesi |
| `VITE_AUTH_ENABLED` | `true` |

Belum ada, dan masuk sungguhan di situs publik belum tersimpan tanpanya:

| Nama | Kenapa belum |
| --- | --- |
| `DATABASE_URL` | Neon belum terhubung ke proyek Vercel ini |

`PUBLIC_CONVEX_URL` tidak diperlukan oleh meja aktif. Trip tersimpan pada `trip_scenarios` melalui `/api/trip`; `user_id` selalu berasal dari sesi server. Migrasi `0003_trips.sql` berjalan bersama migrasi akun saat build yang memiliki `DATABASE_URL`.

Operator menetapkan `TITIPIN_ADMIN_USER_ID` ke ID akun pemilik setelah akun tersebut dibuat. Pada permintaan berikutnya akun itu dapat menjadi satu-satunya admin; indeks unik tetap menolak admin kedua. Jangan memakai email yang belum diverifikasi sebagai bukti kepemilikan admin.

Login mandiri tidak memakai `GROK_AUTH_ISSUER`, `GROK_AUTH_CLIENT_ID`, atau `GROK_AUTH_CLIENT_SECRET`. Nilai existing di Vercel belum dihapus oleh perubahan lokal ini. Tidak ada konfigurasi email reset/verifikasi; fitur tersebut belum disediakan.

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

`npm test` menjalankan tes aplikasi dan platform; empat tes dokumen skill Grok dilewati hanya bila dokumen tersebut tidak tersedia di repo standalone. `npm run test:trip-api` membuat akun sintetis pada server lokal dan memeriksa batas admin serta isolasi dua akun. Script ini menolak origin selain localhost.

CI memeriksa build, tipe, unit test, API akun lokal, dan render desktop/mobile pada dev serta hasil build. Akun produksi/BYOK sungguhan baru dapat diuji setelah Neon diotorisasi dan `DATABASE_URL` dipasang.

## Desain

Kertas krem `#F3EDE3`, tinta `#1C1917`, jade `#0F6E56`, terracotta `#B8431C`. Huruf Fraunces dan Outfit. Nada waybill, bukan dashboard ungu.

## Repo

[official-manef/jastip](https://github.com/official-manef/jastip), cabang `main`. Push ke `main` membangun ulang situs Vercel.
