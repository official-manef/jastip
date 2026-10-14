# Progress

## 14 Oktober 2026, penyelesaian kalkulator dan pengamanan akun

- Tarif campuran per kg/per item, target omzet jasa per trip, dan buku trip terpisah dengan nama/tanggal.
- Simpan lokal, salin/hapus trip, ekspor JSON dan impor yang menambahkan salinan tanpa menghapus data lama.
- `/api/trips` dan migrasi `0003_trip_books.sql`: isolasi pemilik dari sesi server, akses jastiper/admin, validasi buku trip, dan konflik revisi HTTP 409.
- Login produksi tidak memakai PGLite sementara. Tanpa `DATABASE_URL`, layanan akun menampilkan status belum tersedia.
- Klaim admin produksi memerlukan `JASTIP_ADMIN_EMAIL` dari operator. Tidak memilih email pemilik secara otomatis.
- Endpoint Convex bersama `live` tidak lagi dipakai UI. Kode dan data lama dipertahankan.
- Font Outfit/Fraunces disertakan dalam build. Kontrol muatan reflow pada layar kecil.
- Pipeline GitHub menjalankan unit test, typecheck, build dan smoke API.

Validasi lokal: 256 tes lulus, 4 pemeriksaan dokumen template Grok dilewati karena dokumen tidak dikirim bersama repo. Typecheck lulus. Build Vercel lulus. Browser menguji reload, tarif per item, PP, salinan trip, ekspor/impor, pendaftaran dan simpan akun; tidak ada error JavaScript aplikasi. Lebar 320/390/768/1024 tidak overflow. Smoke API memverifikasi pemilik, pengguna lain, peran klien, konflik revisi, origin dan input tidak valid.

Batas verifikasi: database uji menggunakan PGLite lokal. Koneksi akun produksi Neon belum tersedia (`DATABASE_URL` tidak terpasang). Operasi proxy Vercel untuk menghubungkan resource ditolak oleh batas tool enable/disable toolkit. Skrip branding eksternal Grok tidak dapat diakses dari jaringan pengujian. Belum menyatakan login atau persistensi akun produksi selesai.

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
