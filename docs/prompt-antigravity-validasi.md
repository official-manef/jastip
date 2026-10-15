# Prompt untuk agent Antigravity — validasi kerja audit Titipin

Serahkan file ini (atau isinya) ke agent Antigravity sebagai prompt. Semua
perintah dijalankan di repo, bukan di mesin pengguna.

---

## Peran kamu

Kamu auditor independen. Tugasmu **memverifikasi**, bukan mempercayai. Kerja
agent lain (OpenCode) baru saja mengubah repo ini untuk menindaklanjuti audit
15 Oktober. Jangan menerima klaim apa pun tanpa bukti yang kamu hasilkan sendiri.
Kamu boleh membaca kode, menjalankan perintah, dan membuka browser. **Jangan
mengubah kode apa pun** kecuali diminta di bagian "Perbaikan yang boleh kamu
kerjakan". Laporkan temuan, jangan sembunyikan yang gagal.

## Repo

- Path: `C:\Users\rahma\00-project\manef\jastip` (WSL: `/mnt/c/Users/rahma/00-project/manef/jastip`).
- Ranting: `main`. Commit terakhir: `fd3b942` ("Tindak lanjut audit 15 Okt: 13 dari 18 temuan + rename istilah").
- Rujukan audit asli: `docs/audit-2026-10-15.md` (18 temuan: 8 P1, 10 P2).
- Klaim status tindak lanjut: `docs/progress.md`, entri "16 Oktober 2026".
- Situs produksi: `https://jastip-ochre.vercel.app`.

## Aturan akses (jangan dilanggar)

- Uji terhadap **dev lokal** (`http://127.0.0.1:8080`) dan **build produksi lokal**
  (`npm run preview:restart` → `http://127.0.0.1:8081`). Produksi Vercel hanya
  untuk cek visual terakhir, bukan menulis data.
- **Jangan** menulis ke Convex produksi, jangan membuat akun di produksi, jangan
  mengubah data akun nyata. Kalau butuh akun, pakai dev/Convex dev saja.
- **Jangan** commit, push, atau buka PR. Kalau menemukan masalah, tulis di laporan.
- Jangan minta kredensial, cookie, atau isi `.env`/`.manef/config.json` ke chat.

## Cara menjalankan

```bash
cd /mnt/c/Users/rahma/00-project/manef/jastip
sh startup.sh                      # dev server di 0.0.0.0:8080 (idempoten)
npm run typecheck                  # harus 0 error
npm test                           # 61 tes harus lulus
npm run build                      # harus sukses
npm run preview:restart            # build produksi di 127.0.0.1:8081
node scripts/browser-smoke.mjs <url> screenshots/<nama>.png   # render + konsol
```

Untuk interaksi (klik, ketik, tombol panah, fokus): pakai `agent-browser`
(bukan skrip Playwright tulis-tangan). Screenshot selalu ke
`/mnt/c/Users/rahma/00-project/manef/jastip/screenshots/`, **jangan `/tmp`**.

---

## Bagian 1 — Validasi klaim perbaikan (WAJIB, satu per satu)

Untuk tiap temuan di bawah, nyatakan **PASS / FAIL / PARTIAL** dan sertakan bukti
kamu sendiri (perintah + keluaran, atau screenshot). Klaim lama hanya hipotesis.

### P1

- **F01** Sidebar harus setinggi viewport (`h-dvh`), akun menempel dasar sidebar
  (`mt-auto`), bukan mengikuti tinggi dokumen. Uji: buka `/meja` desktop, gulir
  sampai dasar — apakah "Masuk/Keluar" tetap terjangkau tanpa menggulir konten?
- **F02** Navigasi mobile harus muncul **sebelum** konten (di atas `<main>`),
  bukan setelah footer. Uji: `/meja` di 390×844 — apakah tombol Menu terlihat di
  layar awal tanpa menggulir?
- **F03** Konten tidak boleh transparan setelah navigasi/async load. Uji: hard
  reload `/portal`, `/titip`, `/asisten`, `/pengaturan`; periksa elemen punya
  `opacity:0`/`translateY` yang tidak pernah menjadi `is-in`. Cek juga saat data
  titipan datang **setelah** render. Ini area paling berisiko — uji ekstra.
- **F04** Laba trip memakai omzet per baris (tarif baris), bukan berat × tarif
  global. Uji: tambah barang, tarif Per item 100000 qty 2, bandingkan "Jasa"
  dan laba — angkanya harus konsisten (satu sumber).
- **F06** Label mata uang tidak boleh berubah jadi TRY hanya karena arah rute.
  Uji: buat tahap Turki, lihat label omzet/laba — harus Rupiah (IDR) kecuali
  pengguna mengganti mata uang tarif sendiri.
- **F07** Kuota 0 → saran harga tidak tersedia & tombol disabled, bukan saran Rp0
  atau "impas 0 kg". Uji: set koper=0, kabin=0.

### P2

- **F08** Label harus "Markup atas modal" (bukan "Target margin"), dan angkanya
  = modal × (1 + markup).
- **F09** Berat 0,25 dan 0,35 kg harus tampil beda (bukan sama-sama "0,3").
- **F10** Kartu jastiper di `/portal` harus mengikuti state kalkulator saat ini,
  bukan skenario contoh statis. Uji: ubah trip di `/meja`, buka `/portal` tab
  Raka, bandingkan angka; lalu refresh `/portal` — harus tetap sinkron.
- **F11** Hapus barang menyediakan **Undo** yang terlihat; Reset minta
  **konfirmasi** dulu; tombol Hapus punya nama barang di accessible name.
- **F12** Semua kolom input (`/masuk`, input biaya, pertanyaan asisten) harus
  terbaca sebagai field (ada batas/kontras), tidak menyatu dengan latar.
- **F13** Form login/daftar lebih awal (di atas fold); pilihan peran hanya saat
  mendaftar; judul berubah sesuai mode (Masuk vs Daftar).
- **F14** Tautan "Kembali" di `/titip` untuk klien **tidak** boleh menuju halaman
  yang sama (`/titip`).
- **F15** tablist `/portal`: ArrowLeft/Right/Home/End memindah tab, ada
  `aria-controls`/`role=tabpanel`, `tabindex` roving. Tombol status punya
  `aria-pressed` + nama barang.
- **F16** Tiap halaman punya `<title>` sendiri, dan judul berubah saat navigasi
  klien (bukan tertinggal halaman sebelumnya). Uji: `/asisten` → klik `/portal`.
- **F18** UI tidak menampilkan istilah internal (`function calling`, `BYOK`,
  `Tool: set_trip`, `AI_API_KEY`, `env`). Uji `/pengaturan` dan `/asisten`.

## Bagian 2 — Yang butuh mata & browser manusia (klaim sebagian)

- **F05** Mata uang campur (IDR + USD): subtotal per mata uang TAMPIL, dan ada
  peringatan bahwa total campur hanya perkiraan. Konversi kurs **belum ada**.
  Verifikasi: apakah peringatan/ subtotal benar dan angka tidak menyesatkan?
  Jangan minta konversi kurs dari nilai pribadi pengguna.
- **F03** lihat di atas — fokus khusus.

## Bagian 3 — Sisa yang belum (jangan diperbaiki, cuma nilai)

- **F17** Jastiper bisa memilih peran sendiri dan langsung melihat/mengubah semua
  titipan tanpa persetujuan operator. Ini **risiko otorisasi**. Tugasmu: konfirmasi
  apakah masih terjadi (di dev), dan tulis rekomendasi model persetujuan
  (operator approve / batasi per penugasan trip). Jangan implementasi dulu.

## Bagian 4 — Perbaikan yang boleh kamu kerjakan (kecil, terisolasi)

Hanya kalau validasi di Bagian 1 menemukan **FAIL** dan perbaikan jelas & kecil
(≤ 1 berkas, tanpa perubahan skema/data):

1. Salah ejaan / label tak konsisten / `aria-label` kurang.
2. `title` halaman kurang satu di route.
3. Kelas fokus/ kontras yang gagal WCAG AA pada kontrol form.

Kalau butuh perubahan besar (skema, otorisasi, konversi kurs): **jangan kerjakan**,
tulis usulan di laporan saja. Setelah perbaikan kecil, jalankan ulang
`npm run typecheck`, `npm test`, `node scripts/browser-smoke.mjs` pada halaman yang
terdampak, dan tunjukkan hasilnya.

## Format laporan (wajib)

Tulis ringkas, dalam bahasa Indonesia:

```
## Hasil validasi
| Temuan | Status | Bukti |
| F01 | PASS | <perintah/observasi> |
| F03 | FAIL | <apa yang terlihat + screenshot> |
...

## Temuan baru (di luar 18)
- <deskripsi, cara reproduksi, dampak, saran>

## Perbaikan kecil yang saya lakukan (jika ada)
- <berkas, apa yang diubah, hasil uji ulang>

## Rekomendasi keputusan (F17, F05)
- ...
```

## Yang tidak boleh kamu klaim

- "Semua sudah beres" tanpa bukti per temuan.
- Uji admin produksi, pentest, uji beban, Safari/Firefox, pembaca layar, atau
  mode offline — kalau tidak diuji, bilang **tidak diuji**.
- Bahwa kamu memperbaiki sesuatu tanpa menjalankan ulang gate (typecheck, test,
  build, smoke).
