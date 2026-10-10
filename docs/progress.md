# Progress

Cabang `main`. Tanggal di bawah adalah hari kerja di repo, bukan janji rilis.

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

- Menghubungkan Neon supaya migrasi jalan saat build Vercel.
- Menerbitkan kredensial broker untuk origin `jastip-ochre.vercel.app`.
- Deployment Convex cloud dan `PUBLIC_CONVEX_URL`.
- Rute selain Jakarta ↔ Turki.
