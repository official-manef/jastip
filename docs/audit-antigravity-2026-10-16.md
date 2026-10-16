# Validasi audit oleh Antigravity — 16 Oktober 2026

Auditor: agent Antigravity (`agy`, headless, `--mode accept-edits --effort high`).
Prompt: [prompt-antigravity-validasi.md](prompt-antigravity-validasi.md).
Uji di dev lokal saja; tidak menulis Convex produksi, tidak commit/push.
Catatan: panggilan berhenti karena kuota (HTTP 429), tapi laporan lengkap diterima.

## Hasil validasi (18 temuan)

| Temuan | Status | Bukti ringkas |
| --- | --- | --- |
| F01 | PASS | 1440×900: sidebar 900 px = viewport; akun di y=880 |
| F02 | PASS | 390×844: tombol Menu di y=12, sebelum `<main>` |
| F03 | PARTIAL → diperbaiki | Setelah End, 10 elemen terlewati tetap transparan sampai scroll balik |
| F04 | PASS | Per item 100.000 × qty 2 → Jasa naik sesuai hitungan |
| F05 | PASS (sebagian) | Subtotal "Jasa (IDR)"/"Jasa (USD)" terpisah + peringatan tanpa kurs |
| F06 | PASS | Tambah tahap Turki: label tetap IDR/USD, tidak jadi TRY |
| F07 | PASS | Koper 0 + kabin 0 → tombol disabled "Pakai harga saran (kuota 0)" |
| F08 | PASS (kode) | Label "Markup atas modal"; rumus tidak dihitung ulang di browser |
| F09 | PASS | 0,25 kg dan 0,35 kg tampil beda |
| F10 | PASS | Kartu jastiper ikut state kalkulator, tetap setelah refresh |
| F11 | PASS | Urungkan memulihkan barang; Reset minta konfirmasi; aria-label "Hapus {nama}" |
| F12 | FAIL → diperbaiki | Kontras batas field 1,67–1,7:1 (< WCAG 3:1); setelah perbaikan 3,5–3,9:1 |
| F13 | PASS | Form di atas fold; judul "Masuk ke titipin"/"Daftar akun titipin" |
| F14 | PASS (sebagian) | Diuji tanpa login; tautan klien hanya dibaca di kode |
| F15 | PASS (sebagian) | Panah/Home/End pindah tab + roving tabindex + aria-controls; aria-pressed status dicek di kode |
| F16 | PASS | Tiap route punya title; asisten → portal berubah |
| F18 | PASS | Tidak ada "function calling"/"BYOK"/"Tool:"/"AI_API_KEY"/"env" di UI |

## Temuan baru (dari Antigravity, sudah diverifikasi & dikerjakan)

1. **F03 akar teknis** — `rootMargin: -12%` + `forceVisible` hanya mengecek
   `bottom > 0`, sehingga elemen yang dilewati saat lompat ke dasar tidak
   ter-reveal. **Diperbaiki** (lihat commit).
2. **`titipan.setStatus`** — `ctx.db.get(args.id as never)` tanpa tipe tabel.
   **Diperbaiki**: `v.id("titipan")`.
3. **`titipan.list`/`listPeople`** — `.collect()` lalu `.slice(0,100)` membaca
   seluruh tabel. **Diperbaiki** untuk `titipan.list`: `.order("desc").take(100)`.
   (`listPeople` belum — lihat catatan.)
4. **Kontras field** — ring 32% muted = 1,70:1, di bawah WCAG 3:1.
   **Diperbaiki** oleh Antigravity: 70% muted = 3,73:1 (verified hitung ulang).

## Rekomendasi keputusan

**F17** masih terjadi (dikonfirmasi dari kode): `claimRole` mengizinkan siapa pun
mendaftar sebagai jastiper; `titipan.list` mengembalikan semua titipan + nama
pemilik; `setStatus` bisa mengubah titipan siapa pun. Usul Antigravity:
1. Jastiper baru berstatus menunggu, disetujui operator lewat `/admin`.
2. Jastiper hanya melihat/mengubah titipan yang ditugaskan ke trip-nya.
3. Tambah `tripId`/`jastiperId` di tabel `titipan`, filter di `list`/`setStatus`.

**F05**: peringatan sudah jujur; konversi kurs bisa ditunda. Bila dibuat, kurs
diinput operator per trip, bukan dari data pribadi.

## Tidak diuji

Alur berakun (daftar/login/peran/admin/titipan sungguhan), produksi Vercel, build
produksi di `:8081`, Safari/Firefox, pembaca layar, mode offline, uji beban, pentest.
