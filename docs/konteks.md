# Konteks

Titipin adalah MVP jastip pribadi untuk satu koridor. Orang yang menitip (klien) mengirim barang. Orang yang terbang (jastiper) membawa bagasi dan menghitung apakah trip itu untung. Admin adalah pengembang, satu orang.

Bukan katalog banyak kota. Kalau rute bertambah, itu keputusan terpisah. Sekarang hanya Jakarta (CGK) dan Istanbul (IST).

## Peran

| Peran | Bisa | Tidak bisa |
| --- | --- | --- |
| Klien | Membuat titipan miliknya | Mengubah status, melihat titipan orang lain |
| Jastiper | Melihat semua titipan, mengubah status `baru` / `dibawa` / `selesai` | Membuat titipan sebagai klien |
| Admin | Keduanya, plus mengubah peran orang | Menurunkan admin terakhir, atau mengangkat admin kedua |

Peran klien/jastiper terkunci setelah dipilih. Akun tidak bisa menaikkan dirinya sendiri. Operator dapat menetapkan satu ID akun sebagai admin; admin kedua ditolak, baik lewat klaim maupun lewat panel.

Rumah setelah masuk: klien `/titip`, jastiper `/meja`, admin `/admin`.

Dua shell layout: beranda `/` (publik, terpusat) dan `/meja` (app, sidebar). Meja hitung tak
dikunci login.

Bahasa visual (palet, tipe, aturan rumah, gerak) ada di [DESIGN.md](../DESIGN.md).

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

Data akun disimpan terpusat; kalkulasi pengunjung memiliki salinan perangkat.

**Trip aktif** disimpan di Convex (`trips`, deployment `impressive-wildcat-570`), satu dokumen per ID akun yang berasal dari sesi server. Pengunjung tanpa akun memakai localStorage perangkat. Fungsi Convex lama dipertahankan sebagai kode historis.

Sumber data resmi proyek ini adalah Convex. Postgres/Neon tidak dipakai.

Portal `/portal` tidak menulis ke keduanya. Sari, Raka, Deniz, dan Manef hanya ada di memori halaman.

## Masuk

Email/password mandiri melalui Better Auth. Login akun lama tidak membutuhkan pilihan peran ulang. Belum ada reset password atau verifikasi email.

Klien dan jastiper dapat memilih peran sekali. Admin harus ditetapkan operator dengan `TITIPIN_ADMIN_USER_ID`; identitas email yang belum diverifikasi tidak dapat digunakan untuk mengambil admin. Admin tetap hanya satu.

## Yang sengaja ditunda

- Banyak rute.
- Pemasangan UI trip ke Convex (`PUBLIC_CONVEX_URL` di Vercel).
- OAuth broker tidak diperlukan oleh login email/password mandiri.
