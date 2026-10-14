# Konteks

Titipin adalah MVP jastip pribadi untuk satu koridor. Orang yang menitip (klien) mengirim barang. Orang yang terbang (jastiper) membawa bagasi dan menghitung apakah trip itu untung. Admin adalah pengembang, satu orang.

Bukan katalog banyak kota. Kalau rute bertambah, itu keputusan terpisah. Sekarang hanya Jakarta (CGK) dan Istanbul (IST).

## Peran

| Peran | Bisa | Tidak bisa |
| --- | --- | --- |
| Klien | Membuat titipan miliknya | Mengubah status, melihat titipan orang lain |
| Jastiper | Melihat semua titipan, mengubah status `baru` / `dibawa` / `selesai` | Membuat titipan sebagai klien |
| Admin | Keduanya, plus mengubah peran orang | Menurunkan admin terakhir, atau mengangkat admin kedua |

Peran terkunci setelah dipilih. Akun tidak bisa menaikkan dirinya sendiri. Admin kedua ditolak, baik lewat klaim maupun lewat panel.

Rumah setelah masuk: klien `/titip`, jastiper `/`, admin `/admin`.

## Hitung trip

Sumber angkanya `src/lib/titip/calc.ts`. Meja memakainya langsung. Convex menyimpan skenario yang sama.

Dua arah:

- `cgk-ist` — beli di Jakarta, turun di Istanbul. Harga barang dalam rupiah.
- `ist-cgk` — beli di Turki, turun di Jakarta. Harga barang dalam lira, dikonversi ke rupiah.

Mode:

- `one` — satu kaki. Tiket dan opex hanya arah yang sedang dibuka.
- `pp` — dua kaki. Tiket, opex lain, denda, dan pendapatan kargo dijumlahkan. Capex (alat dibagi umur trip) tetap sekali.

Benih tiket:

- CGK–IST Rp6.800.000
- IST–CGK Rp7.200.000
- PP Rp14.000.000

Pada benih pergi saja, sisa bagasi 17,7 kg dan laba −Rp5.896.750. Angka itu titik cek, bukan harga pasar yang dikunci selamanya. Slider di meja mengubahnya.

## Data

Dua tempat simpan, sengaja terpisah.

**Convex** menyimpan satu dokumen trip, kunci `live`: arah yang sedang dibuka, mode pergi/PP, dan skenario kedua kaki. Query tidak boleh menyisipkan baris. Tulisan lewat mutasi `ensure` dan `save`.

**Postgres** menyimpan akun Better Auth, tabel `profiles` (peran), dan tabel `titipan`. `user_id` bertipe teks. Setiap permintaan titipan dibatasi oleh sesi, bukan oleh id yang dikirim browser.

Portal `/portal` tidak menulis ke keduanya. Sari, Raka, Deniz, dan Manef hanya ada di memori halaman.

## Masuk

Login mandiri email/password. Kode broker lama bukan jalur login aplikasi ini.

Produksi memerlukan `DATABASE_URL` yang persisten. Jika belum ada, pendaftaran dan masuk ditutup dengan status layanan yang jelas. Admin produksi hanya dapat diklaim oleh email yang cocok dengan `JASTIP_ADMIN_EMAIL`; pembatasan satu admin tetap berlaku. Email pemilik ditentukan operator.

Di pratinjau yang sudah membawa identitas Grok, halaman Masuk langsung meminta peran. Tidak ada tombol masuk kedua, dan tidak ada tombol keluar, karena sesi itu terbentuk lagi dengan sendirinya.

## Yang sengaja ditunda

- Banyak rute.
- Convex cloud, sampai `PUBLIC_CONVEX_URL` yang bukan localhost ada.
- Database produksi, sampai Neon benar-benar menempel ke proyek Vercel dan `DATABASE_URL` terisi saat build.
- Kredensial broker per-aplikasi. Tanpa itu, tombol Google/X di situs publik belum menyelesaikan masuk.

## Rancangan penyimpanan baru, 14 Oktober 2026

Meja tidak lagi menghubungi endpoint Convex bersama `live`. Fungsi Convex lama dipertahankan untuk migrasi, tetapi tidak dipakai UI dan tidak dipublikasikan ulang pada pekerjaan ini. Data produksi lama tidak dihapus.

Trip memiliki ID, nama, tanggal, target jasa, mode dan kedua arah. Perangkat menyimpan hingga 50 trip di `titipin-trip-drafts-v1`. Ekspor JSON membuat cadangan; impor menambahkan trip dengan ID baru tanpa menimpa trip lama. Kerusakan penyimpanan ditampilkan, bukan dianggap berhasil.

Jastiper dan admin dapat memuat/menyimpan buku trip ke akun melalui `/api/trips`. Tabel `trip_books` menggunakan user ID dari sesi server. Data pengguna lain tidak dapat diminta melalui parameter ID. Versi optimistis menolak tulisan yang tertinggal. Klien tidak memiliki akses API buku trip.

Setiap barang memakai tarif IDR per kg atau per item. Tarif kosong mengikuti default per kg. Harga pembelian tidak ditambahkan ke omzet jasa. Target adalah proyeksi jasa, bukan status pembayaran. Impas hanya estimasi berdasarkan tarif rata-rata komposisi muatan. PP menjumlahkan jasa dan biaya kedua arah; capex CGK–IST dihitung satu kali agar total tidak berubah saat memilih arah.
