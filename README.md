# titipin

Kalkulator bagasi jastip untuk **satu rute: Jakarta ↔ Turki**. Bukan marketplace multi-kota. Satu meja hitung yang langsung berubah, plus akun untuk klien, jastiper, dan admin.

Situs: [jastip-ochre.vercel.app](https://jastip-ochre.vercel.app)

## Yang sudah jalan

- Meja trip: kuota bagasi, muatan per kg, harga per kg, opex, capex, laba.
- Arah `Jakarta → Turki` dan `Turki → Jakarta`.
- Mode **pergi saja** atau **pulang-pergi**. PP menjumlahkan tiket dan opex kedua kaki. Capex dihitung sekali.
- Beberapa trip terpisah dengan nama, tanggal dan target omzet jasa. Data tersimpan di perangkat serta dapat diekspor dan diimpor sebagai JSON.
- Tarif IDR per kg/per item dapat diatur per barang. Harga beli tetap terpisah dari jasa.
- Penyimpanan akun memakai Postgres dengan pembatasan pemilik dan pemeriksaan konflik versi. Aktif setelah database produksi terhubung.
- Login mandiri memakai email/password. Peran: klien, jastiper, admin. Admin hanya satu dan ditentukan operator lewat ID akun, mengikuti rilis PR #3.
- AI BYOK di `/pengaturan`: URL/model custom yang diizinkan operator. API key hanya berada di memori halaman dan diteruskan ke penyedia saat pengguna meminta.
- Titipan per akun, dan antrean untuk jastiper.
- Portal contoh di `/portal` supaya dashboard kelihatan tanpa akun sungguhan.

Rincian keputusan ada di [docs/konteks.md](docs/konteks.md). Riwayat ada di [docs/progress.md](docs/progress.md).

## Halaman

| Path | Untuk siapa | Isi |
| --- | --- | --- |
| `/` | Semua, rumah jastiper | Meja hitung |
| `/portal` | Semua | Dashboard contoh: Sari (klien), Raka (jastiper), Manef (admin) |
| `/masuk` | Belum masuk | Pilih peran, lalu email/password; status database terlihat |
| `/titip` | Klien, jastiper, admin | Permintaan titipan |
| `/admin` | Admin | Daftar orang dan peran |

Meja tidak dikunci login.

## Tumpukan

SvelteKit, Svelte 5, Bun, Convex, Tailwind, Better Auth, Vercel.

Akun, titipan dan buku trip memakai Postgres. PGLite hanya untuk pengembangan; tanpa database persisten login produksi dinonaktifkan. Meja lokal tetap berjalan tanpa akun. Kode Convex lama dipertahankan untuk migrasi, tetapi UI tidak memakai dokumen bersama `live`.

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
| `TITIPIN_ADMIN_USER_ID` | ID akun pemilik ditentukan operator; admin tidak terbuka untuk pendaftar umum |

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

## Desain

Kertas krem `#F3EDE3`, tinta `#1C1917`, jade `#0F6E56`, terracotta `#B8431C`. Huruf Fraunces dan Outfit. Nada waybill, bukan dashboard ungu.

## Repo

[official-manef/jastip](https://github.com/official-manef/jastip), cabang `main`. Push ke `main` membangun ulang situs Vercel.
