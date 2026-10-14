# Progress

Cabang `main`. Tanggal di bawah adalah hari kerja di repo, bukan janji rilis.

## 14 Oktober 2026: persistensi dan akses akun

- Pengunjung menyimpan kalkulasi di perangkat; status lokasi simpan ditampilkan dengan jelas.
- Trip akun memakai Postgres melalui `/api/trip`, satu skenario per sesi pengguna. UI tidak lagi memanggil dokumen Convex bersama yang dapat ditulis tanpa autentikasi.
- Penulisan akun berjalan berurutan; respons pemuatan yang terlambat tidak menimpa perubahan input pengguna. Gagal sinkronisasi menyisakan salinan lokal dan tombol mencoba kembali.
- Admin hanya dapat diambil oleh ID akun yang ditetapkan operator. Peran klien/jastiper tetap terkunci setelah dipilih.
- Produksi tanpa `DATABASE_URL` mengembalikan 503 untuk operasi akun, dan menampilkan keterangan bahwa login belum aktif. PGLite tidak digunakan sebagai penyimpanan akun produksi.
- Login akun lama tidak lagi meminta pilihan peran lebih dahulu. Isian barang menolak harga negatif dan berat tidak valid dengan pesan terlihat.
- Build dan pemeriksaan tipe lulus lokal. Unit test: 252 lulus, empat pemeriksaan dokumentasi skill Grok dilewati karena dokumennya tidak termasuk repo standalone. Uji API dua akun lulus untuk auth, batas admin, CSRF, validasi, isolasi trip dan titipan.
- CI ditambahkan untuk tes, build, dan render desktop/mobile. Verifikasi browser lokal terhambat unduhan Chromium yang kosong; hasil render CI dan produksi harus diverifikasi sebelum dinyatakan siap.

Hambatan produksi: Neon belum terhubung pada manef-composio dan `DATABASE_URL` belum tersedia di Vercel. Pendaftaran, titipan asli, dan BYOK dengan sesi produksi belum dapat dinyatakan selesai sampai koneksi tersebut aktif.

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

- Menghubungkan Neon supaya migrasi jalan saat build Vercel.
- Menerbitkan kredensial broker untuk origin `jastip-ochre.vercel.app`.
- Deployment Convex cloud dan `PUBLIC_CONVEX_URL`.
- Rute selain Jakarta ↔ Turki.
