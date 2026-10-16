# Konteks

Titipin adalah MVP jastip pribadi multi-negara. Orang yang menitip (klien) mengirim barang. Orang yang terbang (jastiper) menyusun rute, membawa bagasi, dan menghitung apakah trip itu untung. Admin adalah pengembang, satu orang.

## Model trip: tahap

Satu **trip** = daftar **tahap** (penerbangan) berurutan. Tiap tahap punya destinasi dari katalog 25
negara (+ Turki), jenis `utama`|`transit`, lama (hari/jam), dan skenario lengkap sendiri: kuota bagasi,
barang, biaya jalan, biaya alat. Tahap juga boleh memuat negara tambahan (`custom`) bila tak ada di katalog.

- **Transit** = tahap singgah pendek; kuota kecil, biaya jalan ringan, tapi tetap bisa diisi barang.
- **Biaya alat** dipakai bersama seluruh tahap (koper, timbangan); dibagi umur trip, dihitung sekali.
- **Total trip** menjumlahkan jasa, muatan, dan kapasitas semua tahap (`tripLintas`).
- Koridor lama (Jakarta ↔ Turki) cuma kasus khusus dua tahap; data v1 dimigrasi otomatis.

## Katalog tujuan

25 negara dikelompokkan per kawasan, plus Turki (koridor lama). Sumber:
`src/lib/titip/destinasi.ts`. Kategori dan kurs adalah contoh — jastiper yang mengubah di kalkulator.

**Kurs dinamis.** Kurs (Rp per 1 unit) diambil `/api/kurs` dari `open.er-api.com`, cache 6 jam,
membawa `updatedAt` ("Kurs per tanggal"). Provider gagal → kurs seed, ditandai "Kurs contoh".
Modul: `kurs.ts`, `kurs-store.svelte.ts`; `viewOf` memakai kurs live.

**Hindari isian bebas:** pilihan negara memakai satu dropdown (`PilihNegara.svelte`) berisi
katalog per kawasan. Kalau negara belum ada, ada opsi **"Negara lain…"** di dasar daftar: pengguna
mengisi nama, kota, mata uang (dari daftar, bukan bebas), dan kurs sekali saja. Negara tambahan
disimpan di dalam tahap (`Kaki.custom`), bukan di katalog global.

| Kawasan | Negara |
| --- | --- |
| Asia Tenggara | Singapura, Malaysia, Thailand, Vietnam, Filipina |
| Asia Timur | Jepang, Korea Selatan, Tiongkok, Taiwan, Hong Kong |
| Asia Selatan | India |
| Timur Tengah | Turki, Uni Emirat Arab, Arab Saudi |
| Afrika | Mesir |
| Eropa | Prancis, Jerman, Belanda, Inggris, Italia, Swiss |
| Amerika | Amerika Serikat, Kanada |
| Oseania | Australia, Selandia Baru |

Mata uang per negara ikut katalog (`KATALOG_CURRENCIES`). Tarif jasa tetap dalam rupiah; mata uang
belanja hanya untuk harga beli barang.

## Peran

| Peran | Bisa | Tidak bisa |
| --- | --- | --- |
| Klien | Membuat titipan miliknya | Mengubah status, melihat titipan orang lain |
| Jastiper | Melihat semua titipan, mengubah status `baru` / `dibawa` / `selesai` | Membuat titipan sebagai klien |
| Admin | Keduanya, plus mengubah peran orang | Menurunkan admin terakhir, atau mengangkat admin kedua |

Peran klien/jastiper terkunci setelah dipilih. Akun tidak bisa menaikkan dirinya sendiri. Operator dapat menetapkan satu ID akun sebagai admin; admin kedua ditolak, baik lewat klaim maupun lewat panel.

**Peran admin disembunyikan dari antarmuka publik.** Landing, portal contoh, dan halaman
masuk hanya menampilkan **klien** dan **jastiper** — keduanya saling menemukan (klien mengirim
titipan, jastiper membawa). Admin tetap ada di backend untuk operator, tapi tak pernah
ditawarkan sebagai pilihan bagi pengunjung umum: pilihan admin hanya muncul bila akun sudah
ditetapkan operator lewat `TITIPIN_ADMIN_USER_ID` (`session.canClaimAdmin`).

Rumah setelah masuk: klien `/titip`, jastiper `/meja`, admin `/admin`.

Dua shell layout: beranda `/` (publik, terpusat) dan `/meja` (app, sidebar). Kalkulator hitung tak
dikunci login.

Bahasa visual (palet, tipe, aturan rumah, gerak) ada di [DESIGN.md](../DESIGN.md).

## Hitung trip

Sumber angkanya `src/lib/titip/calc.ts` (per tahap) + `src/lib/titip/pricing.ts` (`tripLintas`, total
lintas tahap). Kalkulator memakainya langsung.

Per tahap, `compute` memakai kuota `kotor = bags*kgPerBag + cabin`, `bersih = kotor - tare`, lalu
membandingkan dengan total berat muatan. Biaya jalan (`opex`), denda kelebihan, dan biaya alat (harga alat dibagi
umur trip) membentuk beban tahap.

Total trip (`tripLintas`):

- **Jasa** = jumlah jasa semua tahap. Tarif per baris sudah memuat mata uangnya sendiri.
- **Muatan** = jumlah berat semua tahap. **Kapasitas** = jumlah kuota bersih semua tahap.
- **Over** = kapasitas − muatan; ditandai kalau negatif, dan tahap paling ketat disorot.

Tahap contoh Jakarta awal: sisa bagasi 17,7 kg dan laba −Rp5.896.750 (mesin lama, tetap jadi titik cek).
Slider di kalkulator mengubahnya.

## Data

Data akun disimpan terpusat di Convex; kalkulasi pengunjung memiliki salinan perangkat.

**Semua data akun ada di Convex** (deployment `impressive-wildcat-570`):

- Tabel auth (users/sessions/accounts) di komponen resmi `@convex-dev/better-auth`.
- `profiles` (peran per akun), `titipan` (milik satu akun), `tripScenarios` (trip per akun, slug `utama` = trip aktif kalkulator), `subscriptions` (langganan, status dari webhook DOKU).
- `trips` menyimpan skenario contoh lama (kode historis).

Route SvelteKit (`/api/saya,peran,admin,titipan,trip,trips`) memanggil fungsi Convex lewat `ConvexHttpClient` di server; token sesi diambil otomatis dari cookie. Logika server ada di `src/convex/`. Pengunjung tanpa akun memakai localStorage perangkat.

Sumber data resmi proyek ini adalah Convex. Postgres/Neon/PGlite sudah dihapus dari kode.

Portal `/portal` tidak menulis ke Convex. Sari (klien), Deniz (klien), dan Raka (jastiper)
hanya ada di memori halaman; keduanya saling bertemu tanpa perantara.

## Masuk

Email/password mandiri melalui Better Auth (database di Convex). Login akun lama tidak membutuhkan pilihan peran ulang. Belum ada reset password atau verifikasi email.

Saat **daftar**, pilihan peran (klien / jastiper) baru muncul **setelah password + konfirmasi password
cocok** — bukan sebelum isi form (permintaan pemilik). Tombol "Buat akun" nonaktif sampai password cocok
dan peran dipilih.

Klien dan jastiper dapat memilih peran sekali. Admin harus ditetapkan operator dengan `TITIPIN_ADMIN_USER_ID`; identitas email yang belum diverifikasi tidak dapat digunakan untuk mengambil admin. Admin tetap hanya satu.

## Dashboard per peran

`/dashboard` menampilkan ringkasan sesuai peran dari data Convex asli (bukan contoh):

- **Klien**: jumlah titipan, berat, yang masih jalan, aksi ke `/titip`.
- **Jastiper**: titipan masuk, antrean, kapasitas trip (dari kalkulator), aksi ke `/meja`.
- **Admin**: jumlah orang, jastiper, titipan, aksi ke `/admin`.
- Semua peran melihat status **langganan**.

`homeFor(role)` kini menuju `/dashboard` untuk semua peran setelah masuk.

## Langganan (scaffold DOKU)

Struktur siap, pembayaran nyata belum aktif:

- Tabel `subscriptions`: `plan`, `status` (pending/aktif/batal/kadaluarsa), `invoiceId` (unik, kunci idempoten webhook), `harga`, `mulai`, `selesai`, `metode`.
- Fungsi `subscriptions.ts`: `mine` (baca status pemilik), `buatInvoice` (buat `pending`; harga dari server `HARGA.pro`), `tandaiBayar` (dipakai webhook; cek `DOKU_WEBHOOK_SECRET`).
- Route `GET/POST /api/langganan`, `POST /api/doku/webhook`.
- Mengaktifkan: isi `DOKU_CLIENT_ID`/`DOKU_SECRET_KEY`/`DOKU_API_BASE_URL` + `DOKU_WEBHOOK_SECRET` (Vercel + Convex), lalu ganti webhook ke signature resmi DOKU.

## Yang sengaja ditunda

- Integrasi bea cukai / aturan hukum per negara (katalog hanya kategori & kurs contoh).
- OAuth broker tidak diperlukan oleh login email/password mandiri.
- Reset password dan verifikasi email.
- Target omzet sebagai pengubah harga otomatis (sekarang hanya indikator progres).
- Pembayaran DOKU nyata (sekarang scaffold: invoice + webhook, tanpa panggilan checkout).
- Verifikasi signature webhook DOKU (sekarang shared secret; butuh spec merchant).
