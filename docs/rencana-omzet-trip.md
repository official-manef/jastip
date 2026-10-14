# Rancangan omzet campuran dan manajemen trip

Tanggal audit: 14 Oktober 2026. Status: usulan untuk dibahas bersama Fikran; belum mengubah perilaku aplikasi.

Catatan lanjutan (14 Okt): Postgres/Neon dihapus dari rencana — sumber data memakai Convex. Angka kapasitas & target tetap konfigurasi, bukan konstanta.

Baseline: `main` pada [4f6991d](https://github.com/official-manef/jastip/commit/4f6991dbcd6889a36eb507abd7e6f4ed83b7193a). Commit terakhir berjudul “Tulis README, konteks produk, dan catatan progress.” Dokumentasi terakhir bertanggal 10 Oktober 2026.

## 1. Hasil pemeriksaan dan bagian yang digunakan kembali

| Bagian | Kondisi saat ini | Perubahan yang direncanakan |
| --- | --- | --- |
| `src/lib/titip/calc.ts` | `Good.kg` adalah berat per unit; `qty` jumlah; pendapatan memakai berat total yang sudah dibulatkan 0,1 kg × tarif global | Pertahankan mesin murni, kapasitas, opex, capex; jumlahkan biaya jasa per baris dengan berat presisi |
| `src/desk/Desk.svelte` | Svelte 5 memakai `$derived(computeTrip(...))`, CRUD barang, autosave 120 ms | Gunakan kembali layout dan reaktivitas; tambah tarif/baris, target, pilihan trip, dan status penyimpanan |
| `src/convex/validators.ts` | Validator barang dan skenario belum memiliki tarif atau target | Perlu diperbarui bersama types, schema, dan mutation; perubahan type saja tidak cukup |
| `src/convex/schema.ts`, `trip.ts` | Satu dokumen `key: "live"`; query/mutation belum memeriksa identitas | Trip terpisah dan kepemilikan; jangan memasukkan data pelanggan ke API publik ini |
| `src/lib/titip/titipan.ts` | `kg` adalah berat total; status `baru / dibawa / selesai`; belum ada trip, jumlah, atau tarif | Tambahkan relasi trip/kaki, kuantitas, berat/unit, dan data tarif terpisah |
| `migrations/0002_roles.sql` | Akun dan titipan di Postgres; berat `numeric` | Tambahkan migrasi baru, pertahankan migrasi lama |
| `src/routes/api/titipan/+server.ts` | GET daftar; POST nama/arah/berat/catatan; PATCH status | Gunakan kembali sesi dan validasi; tambah pengelolaan tarif/relasi serta perubahan dan penghapusan yang diotorisasi |
| `src/lib/titip/accounts.server.ts` | Identitas dari sesi; klien hanya melihat miliknya; daftar dibatasi 100 baris | Ringkasan harus dihitung dari semua titipan trip yang berhak dibaca, bukan 100 baris tampilan |
| `src/lib/titip/model.ts` | Masih memuat model marketplace, seed banyak kota, dan tarif persen/minimum | Gunakan formatter yang relevan; jangan jadikan model marketplace sebagai kontrak trip produksi |
| `src/routes/portal/+page.svelte` | Data demo di memori; ringkasan contoh tidak dihitung dari antrean demo | Tetap demo; nanti gunakan fungsi kalkulasi bersama agar contoh konsisten |

Pertahankan SvelteKit, Svelte 5, Bun, Tailwind, Better Auth, Postgres/Neon untuk akun dan titipan, serta Convex untuk skenario trip. Pertahankan palet krem/jade/terracotta, Fraunces/Outfit, rute Jakarta ↔ Turki, mode pergi/PP, dan capex sekali pada PP.

## 2. Bukti deployment dan batas pemeriksaan

- Status GitHub untuk commit baseline: konteks Vercel `success`, [deployment](https://vercel.com/manef/jastip/J1iFovMAUsjtS1C9V2xJ2PrfimTy).
- Pemeriksaan UI [website publik](https://jastip-ochre.vercel.app/) menampilkan kalkulator: terpakai 9,1 kg, kapasitas bersih 26,8 kg, sisa 17,7 kg, jasa Rp2.548.000, laba jasa −Rp5.896.750.
- UI masih menunjukkan “Menyambungkan…” saat diperiksa, tanpa indikator “Tersimpan di Convex”. Ini belum membuktikan persistensi berhasil ataupun memastikan penyebabnya.
- Belum ada pemeriksaan akun Vercel/Neon atau nilai konfigurasi produksi. Keterangan env yang belum lengkap di README adalah laporan 10 Oktober, bukan bukti status env sekarang.
- Belum melakukan login, menulis titipan produksi, atau menjalankan migrasi/deployment.

Gate produksi berikutnya: periksa keberadaan konfigurasi tanpa menampilkan rahasia; verifikasi login/sesi, database tahan muat ulang, dan simpan/baca trip terpisah pada lingkungan uji sebelum rilis.

## 3. Keputusan bisnis yang wajib dikonfirmasi

| Keputusan | Pertanyaan untuk Fikran | Dampak |
| --- | --- | --- |
| Definisi target | Apakah USD 1.200 murni jasa atau termasuk nilai produk? | Label dan cakupan target; nilai produk tetap dipisahkan dari omzet jasa |
| Mata uang | Semua tarif jasa USD atau dapat IDR/TRY/lainnya? | Mata uang trip, kurs, pembulatan, perbandingan dengan biaya IDR |
| Pengakuan omzet | Saat diterima/dikonfirmasi, dibayar, atau selesai? | Aturan inklusi; status saat ini tidak memiliki “dikonfirmasi” maupun “dibayar” |
| Kapasitas | 65 kg bersih titipan atau termasuk koper dan barang pribadi? | Kapasitas efektif dan tara; jangan menetapkan 65 sebagai bersih secara otomatis |
| Produk dan pembayaran | Bagaimana link produk, persetujuan harga, pembayaran/DP, pembatalan/refund berjalan? | Field dan alur pelanggan; jangan membuat integrasi pembayaran sebelum jelas |
| Cakupan PP | Target USD 1.200 untuk satu kaki atau gabungan PP? | Target di level trip atau kaki; kapasitas tiap kaki tetap dihitung sendiri |

Selama belum terjawab, 65 kg dan USD 1.200 adalah contoh kebutuhan, bukan default produksi. Aturan status belum dipilih. Status pembayaran harus dipisahkan dari perjalanan barang jika dibutuhkan.

## 4. Kontrak data yang diusulkan

Semua nama field berikut adalah usulan, bukan migrasi yang sudah diterapkan.

| Entitas | Field utama | Catatan |
| --- | --- | --- |
| Trip | `tripId`, nama, `ownerId`, mode, tanggal, target dan currency, versi | ID stabil per trip; jangan gunakan arah sebagai ID |
| Kaki trip | `legId`, `tripId`, arah, pengaturan bagasi/tara dan biaya | Pada PP ada dua kaki; sisa satu kaki tidak menambah kapasitas kaki lain |
| Baris barang | ID, asal manual/titipan, `titipanId?`, `tripId`, `legId`, nama, kategori, qty, berat/unit | Pelanggan berasal dari identitas sesi dan profil, bukan user ID bebas dari browser |
| Tarif jasa | `pricingModel: per_kg / per_item`, tarif, currency, satuan item, status penetapan tarif | Satuan “slop” dan “unit” disimpan sebagai label; qty mengikuti satuan tagih tersebut |
| Nilai produk | harga beli/unit, currency pembelian | Terpisah dari tarif jasa dan dari pembayaran pelanggan |
| Status | status perjalanan, status penerimaan, status pembayaran bila diperlukan | Mapping dan aturan inklusi ditetapkan setelah konfirmasi bisnis |
| Hasil turunan | total berat, biaya jasa, omzet trip, sisa/kelebihan kapasitas, pencapaian target | Hitung dari input; jangan percaya total kiriman browser |

Tarif belum ditetapkan berbeda dari tarif nol yang sengaja diberikan. Tampilkan peringatan data belum lengkap; jangan menganggap baris tersebut menghasilkan USD 0 sebagai laporan final.

Usulan teknis presisi: berat disimpan dalam gram atau fixed decimal sesuai presisi timbangan; uang memakai satuan minor sesuai currency. Jangan memakai `round1(totalKg)` sebagai dasar tagihan. Pembulatan per baris dan konversi kurs perlu ditetapkan secara eksplisit dan diuji. Kurs TRY untuk harga produk yang sudah ada bukan kurs USD untuk jasa.

## 5. Mesin kalkulasi dan dashboard

Untuk baris yang memenuhi aturan kapasitas/omzet yang telah dikonfirmasi:

- Berat baris = qty × berat/unit.
- Jasa per kg = berat baris dalam kg × tarif/kg.
- Jasa per item = qty × tarif/item.
- Omzet jasa = jumlah biaya jasa baris yang memenuhi aturan pengakuan.
- Sisa kapasitas = kapasitas efektif kaki − total berat yang diperhitungkan.
- Selisih target = target − omzet jasa. Tampilkan kebutuhan tambahan `max(0, selisih)` dan kelebihan target secara terpisah.
- Pencapaian = omzet jasa / target × 100%; target kosong tidak menghasilkan NaN/Infinity. Angka boleh >100%, progress bar dibatasi secara visual.
- Laba jasa = omzet jasa − opex − capex/trip setelah mata uang disamakan. Nilai pembelian produk tetap ditampilkan terpisah. Uang diterima dan piutang tidak otomatis sama dengan omzet.

Aturan barang yang memakai bagasi harus terpisah dari aturan pengakuan omzet. Barang diterima tetapi belum dibayar dapat memakai kapasitas tanpa masuk omzet, tergantung jawaban Fikran.

Dashboard memakai layout meja yang ada: kapasitas maksimum/efektif, terpakai, sisa dan kelebihan; target, omzet, persen dan kebutuhan tambahan; rincian berat dan kontribusi jasa setiap baris. Pada PP, jasa/biaya dapat dijumlahkan sesuai cakupan target, tetapi kapasitas tetap per kaki.

`potensi` dan `breakEvenKg` saat ini memakai tarif global. Pada tarif campuran keduanya hanya proyeksi dengan tarif asumsi, bukan nilai aktual semua barang. Beri label asumsi atau sembunyikan sampai asumsi dipilih; harga saran tidak boleh diam-diam menimpa tarif khusus barang.

## 6. Integrasi dua penyimpanan tanpa hitung ganda

Usulan awal yang mempertahankan arsitektur:

1. Convex tetap menyimpan metadata dan skenario manual trip. Postgres menjadi sumber kebenaran titipan pelanggan.
2. Buat ID trip stabil yang dapat direferensikan Postgres; lintas database tidak memiliki foreign key native. Backend harus memverifikasi trip/kaki, pemilik, dan status trip sebelum memasang relasi.
3. Server membaca kedua sumber setelah memverifikasi sesi; hasil normalisasi menjadi input kalkulator yang sama. Jangan membuat dashboard pelanggan dari query Convex tanpa autentikasi.
4. Baris pelanggan tidak disalin sebagai barang manual baru. Gunakan identitas sumber dan ID titipan agar satu titipan dihitung satu kali.
5. Ringkasan SQL memakai seluruh baris yang memenuhi kebijakan per trip, bukan daftar GET dengan `limit 100`. Paginasi hanya untuk rincian.
6. Penambahan, perubahan berat/tarif/status, pemindahan trip, dan penghapusan memperbarui ringkasan. Perpindahan harus mengurangi trip lama dan menambah trip baru.
7. Respons mutation memperbarui state lokal dan mengambil ringkasan otoritatif. Untuk perubahan sesi lain, pilih subscription/proyeksi berversi atau refresh terjadwal; jangan mengklaim sinkronisasi seketika lintas database tanpa mekanisme.
8. Jika membutuhkan agregat pelanggan di Convex untuk subscription, gunakan outbox SQL transaksional dan upsert idempotent berbasis ID + versi; gagal/retry tidak boleh menggandakan pendapatan. Ini tahap lanjutan, bukan dual-write tanpa pemulihan.

Saat ini `Desk.svelte` hanya mengambil data query pertama (`if (!synced)`) dan save mengganti seluruh dokumen. Multi-trip perlu revision/conflict handling serta respons save terbaru agar perubahan pengguna lain tidak tertimpa. Indikator “tersimpan” hanya muncul setelah save sukses; kegagalan tetap mempertahankan perubahan lokal untuk retry.

Demo anonim tetap memakai data lokal dan tidak boleh menulis trip pengguna. Identitas Better Auth perlu bridge server yang tepercaya atau token Convex terverifikasi; `ownerId` dari browser saja tidak memadai.

## 7. Migrasi dan implementasi bertahap

| Tahap | Pekerjaan | Syarat selesai |
| --- | --- | --- |
| 0 — keputusan | Jawab tabel bisnis; pastikan status konfigurasi produksi | Currency, kapasitas, aturan inklusi, cakupan PP tercatat |
| 1 — mesin | Tambah fungsi tarif/baris dan ringkasan murni; integrasikan ke `compute`/`computeTrip` tanpa mengubah opex/capex | Kasus campuran, presisi, nilai produk terpisah, serta PP lolos |
| 2 — meja | Form model tarif/tarif/unit, target dan rincian kontribusi; gunakan `$derived` yang ada | Tambah/edit/hapus langsung memperbarui berat dan jasa; mobile tetap terbaca |
| 3 — trip | Schema/validator dan CRUD per trip, autentikasi/pemilik, versi, pemilihan trip | Reload dan dua trip terisolasi; pengguna lain tidak dapat mengubahnya |
| 4 — pelanggan | Migrasi Postgres baru, field dan API titipan, assignment trip, agregasi server | Seluruh titipan tercakup, tanpa duplikasi; mutation dan reload konsisten |
| 5 — rilis | Konfigurasi backend, migrasi bertahap, QA preview, baru merge/deploy | Login, persistensi, hitungan dan UI tervalidasi |

Migrasi data lama:
- Skenario `live` diarsipkan atau menjadi skenario legacy. Jangan menebak pemilik, trip aktif, tanggal, target, atau currency USD.
- Barang manual lama dapat dipetakan sebagai tarif per kg dengan tarif IDR skenario saat migrasi; tandai asal legacy. Tarif dibekukan pada baris agar perubahan default tidak mengubah riwayat. Perubahan kecil akibat perbaikan presisi harus dijelaskan.
- `titipan.kg` lama sudah total: jangan mengalikannya dengan qty baru. Pertahankan nilai asli; jumlah/berat per unit harus dikonfirmasi sebelum migrasi final.
- Relasi trip, tarif, dan status penerimaan titipan lama boleh belum lengkap; tampilkan antrean peninjauan dan jangan otomatis memasukkannya ke trip baru.
- Tambahkan field secara kompatibel terlebih dahulu, lakukan backfill terverifikasi, lalu perketat validasi. Tidak ada reset/drop data.
- Pilih pembatalan/hapus lunak atau penghapusan sesuai kebutuhan bisnis yang dikonfirmasi; rekonsiliasi omzet dan kapasitas tetap wajib.

## 8. Kasus penerimaan yang akan diuji

Fixture berikut hanya contoh pengujian: tarif semuanya USD, kapasitas efektif 65 kg, target jasa USD 1.200, semua baris termasuk dalam penghitungan.

| Barang | Qty | Berat/unit | Model/tarif | Berat total | Jasa |
| --- | ---: | ---: | --- | ---: | ---: |
| Baju | 4 | 0,5 kg | per kg, USD 20/kg | 2 kg | USD 40 |
| Rokok | 5 slop | 0,2 kg | per item, USD 10/slop | 1 kg | USD 50 |
| HP | 2 unit | 0,25 kg | per item, USD 30/unit | 0,5 kg | USD 60 |
| Total | | | | 3,5 kg | USD 150 |

Hasil: sisa 61,5 kg; kebutuhan jasa USD 1.050; pencapaian 12,5%.
- Ubah berat HP menjadi 0,3 kg/unit: berat total trip menjadi 3,6 kg; omzet tetap USD 150.
- Hapus rokok dari fixture awal: berat menjadi 2,5 kg; omzet USD 100.
- Barang per kg 0,25 kg × 3 dengan USD 10/kg: jasa USD 7,50 meskipun tampilan berat hanya satu desimal.
- Ubah nilai pembelian: omzet jasa tetap; nilai produk berubah.
- Kapasitas terlampaui, target terlampaui, target kosong, tarif belum ditetapkan, nol yang disengaja, NaN/Infinity/angka negatif, dan currency berbeda tanpa kurs.
- Aturan status penerimaan/pembayaran, pembatalan/refund, pindah trip/kaki, lebih dari 100 titipan, retry sinkronisasi, dan konflik save.
- PP: capex tetap sekali; pendapatan sesuai kaki/cakupan; overcapacity diperiksa per kaki; ganti tab arah tidak mengubah total PP.
- Sesi/role/ownership: klien tidak mengubah tarif final atau trip milik jastiper lain; demo tidak menulis data nyata.

Validasi implementasi nanti: test hitungan dan integrasi yang relevan, `npm test`, `npm run check:auth`, typecheck, build pada database uji, serta pemeriksaan render/interaksi desktop-mobile dan output produksi. Draft rancangan ini hanya dokumentasi; build atau test aplikasi belum dijalankan.
