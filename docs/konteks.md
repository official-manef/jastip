# Konteks

Titipin adalah MVP jastip pribadi multi-negara. Orang yang menitip (klien) mengirim barang. Orang yang terbang (jastiper) menyusun rute, membawa bagasi, dan menghitung apakah trip itu untung. Admin adalah pengembang, satu orang.

## Model trip: kaki

Satu **trip** = daftar **kaki** (penerbangan) berurutan. Tiap kaki punya destinasi dari katalog 10 negara
(+ Turki), jenis `utama`|`transit`, lama (hari/jam), dan skenario lengkap sendiri: kuota bagasi, barang,
opex, capex.

- **Transit** = kaki singgah pendek; kuota kecil, opex ringan, tapi tetap bisa diisi barang.
- **Capex** dipakai bersama seluruh kaki (koper, timbangan); dibagi umur trip, dihitung sekali.
- **Total trip** menjumlahkan jasa, muatan, dan kapasitas semua kaki (`tripLintas`).
- Koridor lama (Jakarta ↔ Turki) cuma kasus khusus dua kaki; data v1 dimigrasi otomatis.

## Katalog tujuan

Sepuluh negara paling populer untuk pasar Indonesia, plus Turki (koridor lama). Sumber:
`src/lib/titip/destinasi.ts`. Kategori dan kurs adalah contoh — jastiper yang mengubah di meja.

| Negara | Kategori khas |
| --- | --- |
| Jepang | Skincare, makeup, kamera, elektronik, figure |
| Korea Selatan | K-beauty, fashion, album/fotokard K-pop, makanan |
| Singapura | Kosmetik, obat, brand regional, barang premium |
| Hong Kong | Skincare, tas branded, aksesori, lifestyle |
| Thailand | Kosmetik lokal, fashion murah, snack, herbal |
| Amerika Serikat | Sepatu, streetwear, gadget, supplement |
| Prancis | Parfum, kosmetik, fashion, luxury |
| Malaysia | Produk halal, fashion, kebutuhan harian |
| Jerman | Skincare/farmasi, alat rumah tangga, otomotif |
| Australia | Vitamin, kesehatan, skincare, susu |

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

Sumber angkanya `src/lib/titip/calc.ts` (per kaki) + `src/lib/titip/pricing.ts` (`tripLintas`, total
lintas kaki). Meja memakainya langsung.

Per kaki, `compute` memakai kuota `kotor = bags*kgPerBag + cabin`, `bersih = kotor - tare`, lalu
membandingkan dengan total berat muatan. Opex (`opex`), denda kelebihan, dan capex (harga alat dibagi
umur trip) membentuk beban kaki.

Total trip (`tripLintas`):

- **Jasa** = jumlah jasa semua kaki. Tarif per baris sudah memuat mata uangnya sendiri.
- **Muatan** = jumlah berat semua kaki. **Kapasitas** = jumlah kuota bersih semua kaki.
- **Over** = kapasitas − muatan; ditandai kalau negatif, dan kaki paling ketat disorot.

Kaki contoh Jakarta awal: sisa bagasi 17,7 kg dan laba −Rp5.896.750 (mesin lama, tetap jadi titik cek).
Slider di meja mengubahnya.

## Data

Data akun disimpan terpusat di Convex; kalkulasi pengunjung memiliki salinan perangkat.

**Semua data akun ada di Convex** (deployment `impressive-wildcat-570`):

- Tabel auth (users/sessions/accounts) di komponen resmi `@convex-dev/better-auth`.
- `profiles` (peran per akun), `titipan` (milik satu akun), `tripScenarios` (trip per akun, slug `utama` = trip aktif meja).
- `trips` menyimpan skenario contoh lama (kode historis).

Route SvelteKit (`/api/saya,peran,admin,titipan,trip,trips`) memanggil fungsi Convex lewat `ConvexHttpClient` di server; token sesi diambil otomatis dari cookie. Logika server ada di `src/convex/`. Pengunjung tanpa akun memakai localStorage perangkat.

Sumber data resmi proyek ini adalah Convex. Postgres/Neon/PGlite sudah dihapus dari kode.

Portal `/portal` tidak menulis ke Convex. Sari, Raka, Deniz, dan Manef hanya ada di memori halaman.

## Masuk

Email/password mandiri melalui Better Auth (database di Convex). Login akun lama tidak membutuhkan pilihan peran ulang. Belum ada reset password atau verifikasi email.

Klien dan jastiper dapat memilih peran sekali. Admin harus ditetapkan operator dengan `TITIPIN_ADMIN_USER_ID`; identitas email yang belum diverifikasi tidak dapat digunakan untuk mengambil admin. Admin tetap hanya satu.

## Yang sengaja ditunda

- Integrasi bea cukai / aturan hukum per negara (katalog hanya kategori & kurs contoh).
- OAuth broker tidak diperlukan oleh login email/password mandiri.
- Reset password dan verifikasi email.
- Target omzet sebagai pengubah harga otomatis (sekarang hanya indikator progres).
