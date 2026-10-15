/**
 * Katalog destinasi jastip untuk pasar Indonesia.
 *
 * Daftar ini adalah bahan produk, bukan hukum: kategori, mata uang belanja,
 * dan catatan akses bisa berbeda per orang. Harga tiket/biaya jalan tetap diisi
 * jastiper di kalkulator; di sini hanya nilai contoh yang wajar untuk memulai.
 *
 * `kurs` = rupiah per 1 unit mata uang lokal (perkiraan, bisa diubah di kalkulator).
 * `transit` = bandara/lokasi yang sering dipakai sebagai titik singgah.
 */

export type Destinasi = {
  /** Kode stabil; dipakai sebagai id tahap & slug. */
  code: string;
  negara: string;
  /** Kota/bandara utama tempat belanja. */
  kota: string;
  /** Kode bandara IATA bila ada. */
  iata?: string;
  /** Mata uang belanja utama di negara itu. */
  currency: "JPY" | "KRW" | "SGD" | "HKD" | "THB" | "USD" | "EUR" | "MYR" | "AUD" | "TRY" | "IDR";
  /** Rupiah per 1 unit `currency` (perkiraan; jastiper boleh ubah). */
  kurs: number;
  /** Kategori produk yang paling dicari dari negara ini. */
  kategori: string[];
  /** Kenapa negara ini dipilih (permintaan, akses, reputasi). */
  alasan: string;
  /** Ringkasan singkat untuk daftar. */
  ringkas: string;
};

/**
 * 10 negara paling populer (urut dari yang dipandang paling potensial).
 * Turki tidak masuk daftar ini (koridor lama proyek) dan ditambahkan di akhir
 * supaya trip lama tetap bisa dibaca.
 */
export const DESTINASI: Destinasi[] = [
  {
    code: "jepang",
    negara: "Jepang",
    kota: "Tokyo",
    iata: "TYO",
    currency: "JPY",
    kurs: 105,
    kategori: ["Skincare", "Makeup", "Kamera", "Elektronik", "Figure", "Produk eksklusif lokal"],
    alasan: "Permintaan kuat untuk beauty, kamera, dan merchandise; reputasi barang bagus.",
    ringkas: "Skincare, kamera, figure, barang eksklusif.",
  },
  {
    code: "korea",
    negara: "Korea Selatan",
    kota: "Seoul",
    iata: "SEL",
    currency: "KRW",
    kurs: 11.5,
    kategori: ["K-beauty", "Fashion", "Album & fotokard K-pop", "Makanan"],
    alasan: "K-beauty dan merchandise K-pop adalah niche paling viral.",
    ringkas: "K-beauty, fashion, album K-pop.",
  },
  {
    code: "singapura",
    negara: "Singapura",
    kota: "Singapore",
    iata: "SIN",
    currency: "SGD",
    kurs: 11800,
    kategori: ["Kosmetik", "Obat & suplemen", "Brand regional", "Barang premium"],
    alasan: "Dekat dan sering transit; banyak brand regional dan barang premium.",
    ringkas: "Kosmetik, obat, brand premium. Dekat.",
  },
  {
    code: "hongkong",
    negara: "Hong Kong",
    kota: "Hong Kong",
    iata: "HKG",
    currency: "HKD",
    kurs: 2050,
    kategori: ["Skincare", "Tas branded", "Aksesori", "Produk lifestyle"],
    alasan: "Barang sulit dicari di Indonesia, akses cepat.",
    ringkas: "Skincare, tas branded, barang langka.",
  },
  {
    code: "thailand",
    negara: "Thailand",
    kota: "Bangkok",
    iata: "BKK",
    currency: "THB",
    kurs: 460,
    kategori: ["Kosmetik lokal", "Fashion murah", "Snack", "Herbal", "Produk viral"],
    alasan: "Produk viral murah dan dekat; cepat berputar.",
    ringkas: "Kosmetik viral, snack, herbal.",
  },
  {
    code: "amerika",
    negara: "Amerika Serikat",
    kota: "Los Angeles",
    iata: "LAX",
    currency: "USD",
    kurs: 15800,
    kategori: ["Sepatu", "Streetwear", "Gadget", "Supplement", "Brand belum masuk Indonesia"],
    alasan: "Brand yang belum resmi masuk Indonesia; nilai tinggi per item.",
    ringkas: "Sepatu, gadget, brand belum masuk sini.",
  },
  {
    code: "prancis",
    negara: "Prancis",
    kota: "Paris",
    iata: "CDG",
    currency: "EUR",
    kurs: 17200,
    kategori: ["Parfum", "Kosmetik", "Fashion", "Barang luxury"],
    alasan: "Parfum dan luxury dengan margin tinggi; tiket mahal, muatan harus padat nilai.",
    ringkas: "Parfum, luxury, fashion.",
  },
  {
    code: "malaysia",
    negara: "Malaysia",
    kota: "Kuala Lumpur",
    iata: "KUL",
    currency: "MYR",
    kurs: 3400,
    kategori: ["Produk halal", "Fashion", "Kebutuhan harian"],
    alasan: "Jarak dekat, biaya logistik rendah; cocok volume harian.",
    ringkas: "Halal, fashion, harian. Biaya rendah.",
  },
  {
    code: "jerman",
    negara: "Jerman",
    kota: "Frankfurt",
    iata: "FRA",
    currency: "EUR",
    kurs: 17200,
    kategori: ["Skincare & farmasi", "Alat rumah tangga", "Otomotif", "Brand Eropa"],
    alasan: "Farmasi dan alat rumah tangga brand Eropa.",
    ringkas: "Farmasi, alat rumah tangga, brand Eropa.",
  },
  {
    code: "australia",
    negara: "Australia",
    kota: "Sydney",
    iata: "SYD",
    currency: "AUD",
    kurs: 10400,
    kategori: ["Vitamin", "Produk kesehatan", "Skincare", "Susu", "Brand lokal"],
    alasan: "Vitamin, susu, dan produk kesehatan dengan permintaan stabil.",
    ringkas: "Vitamin, susu, produk kesehatan.",
  },
  {
    code: "turki",
    negara: "Turki",
    kota: "Istanbul",
    iata: "IST",
    currency: "TRY",
    kurs: 470,
    kategori: ["Tekstil", "Kurma", "Parfum lokal", "Turkish delight"],
    alasan: "Koridor lama proyek; tetap didukung supaya trip lama terbaca.",
    ringkas: "Tekstil, kurma, makanan. Koridor lama.",
  },
];

const BY_CODE = new Map(DESTINASI.map((d) => [d.code, d]));

export function destinasiByCode(code: string): Destinasi | undefined {
  return BY_CODE.get(code);
}

/** Kode destinasi yang dikenal katalog; kompat dengan trip lama. */
export const DESTINASI_CODES = DESTINASI.map((d) => d.code);

/** Titik asal rumah (Jakarta). Tahap pertama biasanya dari sini. */
export const ASAL = { code: "jakarta", negara: "Indonesia", kota: "Jakarta", iata: "CGK" } as const;
