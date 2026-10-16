# Titipin

Reading this as: kalkulator bagasi multi-negara untuk klien dan jastiper Indonesia, dengan bahasa
visual waybill; ENERGY 1 / RHYTHM 2 / MOTION 1.

Art direction diambil dari skill **design-taste-frontend** (tasteskill v2), direction
`quiet-instrument` (seed 2117912992): alat presisi yang bicara pelan. Kolom sempit, angka tabular
besar, banyak ruang kosong yang disengaja.

## Palet — "Three stones"

Satu ground, satu ink, satu accent, satu field.

| Peran | Nilai | Dipakai untuk |
| --- | --- | --- |
| Ground | `#eeecea` | Latar halaman |
| Surface | `#e4e1dd` | Panel, input, tombol sekunder |
| Field | `#cdc3b6` | Panel dalam (readout, meter) |
| Ink | `#333231` | Teks utama |
| Muted | `#4a463f` | Teks sekunder (kontras ≥7:1 di ground) |
| Accent | `#5c6b54` | Tombol utama, pilihan aktif, meter |
| Accent-ink | `#ffffff` | Teks di accent |
| Rugi | `#7d3a2b` | Angka minus (laba negatif, kelebihan bagasi, error) |

Permukaan dipisahkan oleh **satu langkah tone**, bukan garis atau bayangan.

## Dua shell

- **Publik** (`/`, `/masuk`): tanpa sidebar. Header tipis (wordmark kiri, Masuk kanan), konten
  diletakkan di tengah layar (grid `place-items-center`) dan dibatasi `max-w-[46rem]`.
- **App** (`/meja`, `/portal`, `/titip`, `/asisten`, `/pengaturan`, `/admin`): rail sidebar tetap
  (>=lg) + bar/drawer (mobile). Area kerja memakai sisa lebar penuh, konten `max-w-[68rem]` di tengah.

## Kalkulator multi-tahap (wizard ala booking)

Kalkulator menyusun trip sebagai daftar tahap. Pemilih tahap = deretan tombol berurutan berisi kode rute
(mis. `CGK → TYO`), kota, dan lama; tahap aktif disorot.

Layout mengambil pola aplikasi booking pesawat supaya familiar:

- **Stepper** empat langkah di atas kolom kerja: **Rute → Muatan → Biaya → Ringkasan**. Nomor langkah
  aktif di-accent, langkah selesai tone lebih tua; bisa diklik langsung.
- **Kolom kerja** = satu bagian per langkah (bukan halaman panjang). Navigasi "Sebelumnya / Berikutnya".
- **Ringkasan lengket** (`position: sticky`, `lg` ke atas) di sisi kanan: sisa kuota besar, total muatan,
  jasa/beban/laba trip — angka kunci selalu terlihat seperti ringkasan harga tiket.
- Di **mobile**, kolom kanan pindah ke bawah; stepper bisa digulir mendatar.

Pemilih negara (`PilihNegara.svelte`) = satu dropdown dikelompokkan per kawasan (`optgroup`), plus
opsi **"Negara lain…"** di dasar untuk negara yang belum ada. Form custom hanya muncul saat opsi itu
dipilih; mata uang dipilih dari daftar, bukan diketik.

## Tipe

Satu keluarga: **Clash Grotesk** (Fontshare). Lima ukuran: small, body 17–19px, lead, head, display.
Display dipakai sekali per layar (readout sisa kuota). Tracking −0.03em pada display, tabular untuk
angka.

## Aturan rumah yang dipegang

- Tanpa garis tipis, tanpa kotak 1px, tanpa bayangan pada elemen diam, tanpa gradasi, tanpa glass,
  tanpa emoji, tanpa label kecil di atas judul.
- Satu radius untuk seluruh halaman (`--radius: 4px`), satu bentuk tombol.
- Angka awal adalah skenario contoh, bukan harga pasar atau klaim omzet. Portal diberi label contoh.
- Foto rute berasal dari Wikimedia Commons (CC BY-SA), bukan hasil produk Titipin, dan diberi kredit.

## Gerak

- **Signature move:** foto atmosfer rute berganti pelan (*slow crossfade*, 3 gambar) — berhenti saat
  tab disembunyikan.
- Entrance per bagian (`[data-reveal]`, stagger), feedback tekan pada tombol.
- Satu video rute sebagai loop senyap dengan poster.
- Semua gerak transform/opacity, dengan fallback `prefers-reduced-motion`.
