# titipin

Kalkulator bagasi jastip untuk **satu rute: Jakarta ↔ Turki**. Bukan marketplace multi-kota. Satu meja hitung yang langsung berubah, plus akun untuk klien, jastiper, dan admin.

Situs: [jastip-ochre.vercel.app](https://jastip-ochre.vercel.app)

## Yang sudah jalan

- Meja trip: kuota bagasi, muatan per kg, harga per kg, opex, capex, laba.
- Arah `Jakarta → Turki` dan `Turki → Jakarta`.
- Mode **pergi saja** atau **pulang-pergi**. PP menjumlahkan tiket dan opex kedua kaki. Capex dihitung sekali.
- Trip tersimpan di Convex selama URL cloud-nya terpasang. Tanpa itu, meja tetap bisa dihitung di browser.
- Masuk Google dan X. Peran: klien, jastiper, admin. Admin hanya satu, orang pertama yang mengambilnya.
- Titipan per akun, dan antrean untuk jastiper.
- Portal contoh di `/portal` supaya dashboard kelihatan tanpa akun sungguhan.

Rincian keputusan ada di [docs/konteks.md](docs/konteks.md). Riwayat ada di [docs/progress.md](docs/progress.md).

## Halaman

| Path | Untuk siapa | Isi |
| --- | --- | --- |
| `/` | Semua, rumah jastiper | Meja hitung |
| `/portal` | Semua | Dashboard contoh: Sari (klien), Raka (jastiper), Manef (admin) |
| `/masuk` | Belum masuk | Pilih peran, lalu Google atau X |
| `/titip` | Klien, jastiper, admin | Permintaan titipan |
| `/admin` | Admin | Daftar orang dan peran |

Meja tidak dikunci login.

## Tumpukan

SvelteKit, Svelte 5, Bun, Convex, Tailwind, Better Auth, Vercel.

Akun dan titipan memakai Postgres (Neon kalau `DATABASE_URL` ada, kalau tidak PGLite di proses yang sama). Trip memakai Convex, terpisah dari akun.

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
| `GROK_AUTH_ISSUER` | Broker masuk (`https://auth.grok.me`) |
| `VITE_AUTH_ENABLED` | `true` |

Belum ada, dan masuk sungguhan di situs publik belum tersimpan tanpanya:

| Nama | Kenapa belum |
| --- | --- |
| `DATABASE_URL` | Neon belum terhubung ke proyek Vercel ini |
| `GROK_AUTH_CLIENT_ID` | Kredensial broker per-aplikasi belum diterbitkan |
| `GROK_AUTH_CLIENT_SECRET` | Sama |
| `PUBLIC_CONVEX_URL` | Belum ada deployment Convex cloud |

## Desain

Kertas krem `#F3EDE3`, tinta `#1C1917`, jade `#0F6E56`, terracotta `#B8431C`. Huruf Fraunces dan Outfit. Nada waybill, bukan dashboard ungu.

## Repo

[official-manef/jastip](https://github.com/official-manef/jastip), cabang `main`. Push ke `main` membangun ulang situs Vercel.
