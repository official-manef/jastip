/**
 * Katalog destinasi jastip untuk pasar Indonesia.
 *
 * Daftar ini adalah bahan produk, bukan hukum: kategori, mata uang belanja,
 * dan catatan akses bisa berbeda per orang. Harga tiket/biaya jalan tetap diisi
 * jastiper di kalkulator; di sini hanya nilai contoh yang wajar untuk memulai.
 *
 * `kurs` = rupiah per 1 unit mata uang lokal (perkiraan, bisa diubah di kalkulator).
 * `transit` = bandara/lokasi yang sering dipakai sebagai titik singgah.
 *
 * Tujuan: hindari isian bebas sebisa mungkin. Negara yang lazim dipilih sudah
 * disemai di sini; kalau tetap tak ada, pengguna bisa menambah "Negara lain…"
 * (lihat `CustomDest`).
 */

export type Currency =
  | "JPY" | "KRW" | "SGD" | "HKD" | "THB" | "USD" | "EUR" | "MYR" | "AUD" | "TRY"
  | "IDR" | "CNY" | "TWD" | "VND" | "PHP" | "INR" | "AED" | "SAR" | "GBP" | "CAD"
  | "NZD" | "EGP" | "CHF" | "SAR";

/** Kawasan untuk pengelompokan di pemilih negara (ala booking). */
export type Kawasan = "Asia Timur" | "Asia Tenggara" | "Asia Selatan" | "Timur Tengah" | "Eropa" | "Amerika" | "Oseania" | "Afrika";

export type Destinasi = {
  /** Kode stabil; dipakai sebagai id tahap & slug. */
  code: string;
  negara: string;
  /** Kota/bandara utama tempat belanja. */
  kota: string;
  /** Kode bandara IATA bila ada. */
  iata?: string;
  /** Mata uang belanja utama di negara itu. */
  currency: Currency;
  /** Rupiah per 1 unit `currency` (nilai contoh; ditimpa kurs dinamis bila ada). */
  kurs: number;
  /** Kawasan, untuk pengelompokan pemilih. */
  kawasan: Kawasan;
  /** Kategori produk yang paling dicari dari negara ini. */
  kategori: string[];
  /** Kenapa negara ini dipilih (permintaan, akses, reputasi). */
  alasan: string;
  /** Ringkasan singkat untuk daftar. */
  ringkas: string;
};

/**
 * Kurs dinamis yang bisa ditimpa dari luar (fetch `/api/kurs`). Disimpan di
 * modul supaya `viewOf` dan pemilih negara membaca nilai terbaru tanpa
 * membawa kurs ke dalam state trip.
 */
let kursLive: { rates: Partial<Record<Currency, number>>; updatedAt: string; sumber: string } | null = null;

export function setKursLive(k: { rates: Partial<Record<Currency, number>>; updatedAt: string; sumber: string } | null) {
  kursLive = k;
}

export function kursLiveInfo() {
  return kursLive;
}

/** Rupiah per 1 unit, dinamis bila ada, kalau tidak nilai seed. */
export function kursUntuk(currency: Currency, seed: number): number {
  const live = kursLive?.rates[currency];
  return typeof live === "number" && live > 0 ? live : seed;
}

/**
 * Negara di luar katalog. Disimpan di dalam tahap (bukan di katalog global),
 * supaya pengguna tetap bisa memakai negara apa pun tanpa mengubah kode.
 */
export type CustomDest = {
  negara: string;
  kota: string;
  currency: Currency;
  kurs: number;
  iata?: string;
};

/** Daftar mata uang yang dipakai tarif & target (katalog + custom). */
export const KATALOG_CURRENCIES: Currency[] = [
  "IDR", "USD", "TRY", "JPY", "KRW", "SGD", "HKD", "THB", "EUR", "MYR",
  "AUD", "CNY", "TWD", "VND", "PHP", "INR", "AED", "SAR", "GBP", "CAD", "NZD", "EGP", "CHF",
];

/**
 * Katalog negara, urut per kawasan (paling potensial dulu). Turki tetap di
 * dalam (koridor lama proyek) supaya trip lama terbaca.
 */
export const DESTINASI: Destinasi[] = [
  // ── Asia Timur ──────────────────────────────────────────────────────────
  {
    code: "jepang",
    negara: "Jepang",
    kota: "Tokyo",
    iata: "TYO",
    currency: "JPY",
    kurs: 105,
    kawasan: "Asia Timur",
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
    kawasan: "Asia Timur",
    kategori: ["K-beauty", "Fashion", "Album & fotokard K-pop", "Makanan"],
    alasan: "K-beauty dan merchandise K-pop adalah niche paling viral.",
    ringkas: "K-beauty, fashion, album K-pop.",
  },
  {
    code: "china",
    negara: "Tiongkok",
    kota: "Shanghai",
    iata: "PVG",
    currency: "CNY",
    kurs: 2200,
    kawasan: "Asia Timur",
    kategori: ["Elektronik", "Aksesori gadget", "Fashion", "Mainan"],
    alasan: "Sumber barang elektronik dan aksesori; harga pokok rendah.",
    ringkas: "Elektronik, aksesori, mainan.",
  },
  {
    code: "taiwan",
    negara: "Taiwan",
    kota: "Taipei",
    iata: "TPE",
    currency: "TWD",
    kurs: 500,
    kawasan: "Asia Timur",
    kategori: ["Skincare", "Makanan", "Teh", "Aksesori"],
    alasan: "Skincare dan makanan khas; dekat dan sering transit.",
    ringkas: "Skincare, makanan, teh.",
  },
  {
    code: "hongkong",
    negara: "Hong Kong",
    kota: "Hong Kong",
    iata: "HKG",
    currency: "HKD",
    kurs: 2050,
    kawasan: "Asia Timur",
    kategori: ["Skincare", "Tas branded", "Aksesori", "Produk lifestyle"],
    alasan: "Barang sulit dicari di Indonesia, akses cepat.",
    ringkas: "Skincare, tas branded, barang langka.",
  },

  // ── Asia Tenggara ───────────────────────────────────────────────────────
  {
    code: "singapura",
    negara: "Singapura",
    kota: "Singapore",
    iata: "SIN",
    currency: "SGD",
    kurs: 11800,
    kawasan: "Asia Tenggara",
    kategori: ["Kosmetik", "Obat & suplemen", "Brand regional", "Barang premium"],
    alasan: "Dekat dan sering transit; banyak brand regional dan barang premium.",
    ringkas: "Kosmetik, obat, brand premium. Dekat.",
  },
  {
    code: "malaysia",
    negara: "Malaysia",
    kota: "Kuala Lumpur",
    iata: "KUL",
    currency: "MYR",
    kurs: 3400,
    kawasan: "Asia Tenggara",
    kategori: ["Produk halal", "Fashion", "Kebutuhan harian"],
    alasan: "Jarak dekat, biaya logistik rendah; cocok volume harian.",
    ringkas: "Halal, fashion, harian. Biaya rendah.",
  },
  {
    code: "thailand",
    negara: "Thailand",
    kota: "Bangkok",
    iata: "BKK",
    currency: "THB",
    kurs: 460,
    kawasan: "Asia Tenggara",
    kategori: ["Kosmetik lokal", "Fashion murah", "Snack", "Herbal", "Produk viral"],
    alasan: "Produk viral murah dan dekat; cepat berputar.",
    ringkas: "Kosmetik viral, snack, herbal.",
  },
  {
    code: "vietnam",
    negara: "Vietnam",
    kota: "Ho Chi Minh",
    iata: "SGN",
    currency: "VND",
    kurs: 0.63,
    kawasan: "Asia Tenggara",
    kategori: ["Kopi", "Fashion murah", "Kulit", "Suvenir"],
    alasan: "Kopi dan kulit dengan harga murah; pasar berkembang.",
    ringkas: "Kopi, kulit, fashion murah.",
  },
  {
    code: "filipina",
    negara: "Filipina",
    kota: "Manila",
    iata: "MNL",
    currency: "PHP",
    kurs: 280,
    kawasan: "Asia Tenggara",
    kategori: ["Kosmetik lokal", "Snack", "Kebutuhan harian"],
    alasan: "Produk lokal murah; permintaan harian stabil.",
    ringkas: "Kosmetik lokal, snack.",
  },

  // ── Asia Selatan ────────────────────────────────────────────────────────
  {
    code: "india",
    negara: "India",
    kota: "Mumbai",
    iata: "BOM",
    currency: "INR",
    kurs: 190,
    kawasan: "Asia Selatan",
    kategori: ["Obat generik", "Tekstil", "Bumbu", "Perhiasan"],
    alasan: "Obat dan tekstil murah; pasar besar.",
    ringkas: "Obat, tekstil, bumbu.",
  },

  // ── Timur Tengah ────────────────────────────────────────────────────────
  {
    code: "turki",
    negara: "Turki",
    kota: "Istanbul",
    iata: "IST",
    currency: "TRY",
    kurs: 470,
    kawasan: "Timur Tengah",
    kategori: ["Tekstil", "Kurma", "Parfum lokal", "Turkish delight"],
    alasan: "Koridor lama proyek; tetap didukung supaya trip lama terbaca.",
    ringkas: "Tekstil, kurma, makanan. Koridor lama.",
  },
  {
    code: "uniemirat",
    negara: "Uni Emirat Arab",
    kota: "Dubai",
    iata: "DXB",
    currency: "AED",
    kurs: 4300,
    kawasan: "Timur Tengah",
    kategori: ["Emas", "Parfum", "Gadget", "Barang luxury"],
    alasan: "Pusat transit dan barang luxury; bebas pajak.",
    ringkas: "Emas, gadget, luxury. Bebas pajak.",
  },
  {
    code: "arab",
    negara: "Arab Saudi",
    kota: "Jeddah",
    iata: "JED",
    currency: "SAR",
    kurs: 4200,
    kawasan: "Timur Tengah",
    kategori: ["Kurma premium", "Parfum", "Tekstil", "Oleh-oleh haji/umrah"],
    alasan: "Musim umrah/haji; permintaan oleh-oleh tinggi sepanjang tahun.",
    ringkas: "Kurma, parfum, oleh-oleh umrah.",
  },
  {
    code: "mesir",
    negara: "Mesir",
    kota: "Kairo",
    iata: "CAI",
    currency: "EGP",
    kurs: 320,
    kawasan: "Afrika",
    kategori: ["Tekstil", "Perhiasan", "Suvenir", "Minyak esensial"],
    alasan: "Oleh-oleh khas dengan harga rendah.",
    ringkas: "Tekstil, suvenir, minyak esensial.",
  },

  // ── Eropa ────────────────────────────────────────────────────────────────
  {
    code: "prancis",
    negara: "Prancis",
    kota: "Paris",
    iata: "CDG",
    currency: "EUR",
    kurs: 17200,
    kawasan: "Eropa",
    kategori: ["Parfum", "Kosmetik", "Fashion", "Barang luxury"],
    alasan: "Parfum dan luxury dengan margin tinggi; tiket mahal, muatan harus padat nilai.",
    ringkas: "Parfum, luxury, fashion.",
  },
  {
    code: "jerman",
    negara: "Jerman",
    kota: "Frankfurt",
    iata: "FRA",
    currency: "EUR",
    kurs: 17200,
    kawasan: "Eropa",
    kategori: ["Skincare & farmasi", "Alat rumah tangga", "Otomotif", "Brand Eropa"],
    alasan: "Farmasi dan alat rumah tangga brand Eropa.",
    ringkas: "Farmasi, alat rumah tangga, brand Eropa.",
  },
  {
    code: "belanda",
    negara: "Belanda",
    kota: "Amsterdam",
    iata: "AMS",
    currency: "EUR",
    kurs: 17200,
    kawasan: "Eropa",
    kategori: ["Kosmetik", "Keju & makanan", "Sepeda", "Bunga"],
    alasan: "Hub transit Eropa; produk makanan dan kosmetik.",
    ringkas: "Kosmetik, makanan, transit Eropa.",
  },
  {
    code: "inggris",
    negara: "Inggris",
    kota: "London",
    iata: "LHR",
    currency: "GBP",
    kurs: 20100,
    kawasan: "Eropa",
    kategori: ["Fashion", "Kosmetik", "Buku", "Barang antik"],
    alasan: "Fashion dan brand klasik; nilai tinggi.",
    ringkas: "Fashion, kosmetik, brand klasik.",
  },
  {
    code: "italia",
    negara: "Italia",
    kota: "Milan",
    iata: "MXP",
    currency: "EUR",
    kurs: 17200,
    kawasan: "Eropa",
    kategori: ["Fashion", "Kulit", "Parfum", "Makanan"],
    alasan: "Fashion dan kulit premium; margin tinggi.",
    ringkas: "Fashion, kulit, parfum.",
  },
  {
    code: "swiss",
    negara: "Swiss",
    kota: "Zurich",
    iata: "ZRH",
    currency: "CHF",
    kurs: 17800,
    kawasan: "Eropa",
    kategori: ["Jam tangan", "Cokelat", "Suplemen", "Skincare"],
    alasan: "Jam dan cokelat premium; permintaan stabil.",
    ringkas: "Jam, cokelat, suplemen.",
  },

  // ── Amerika ──────────────────────────────────────────────────────────────
  {
    code: "amerika",
    negara: "Amerika Serikat",
    kota: "Los Angeles",
    iata: "LAX",
    currency: "USD",
    kurs: 15800,
    kawasan: "Amerika",
    kategori: ["Sepatu", "Streetwear", "Gadget", "Supplement", "Brand belum masuk Indonesia"],
    alasan: "Brand yang belum resmi masuk Indonesia; nilai tinggi per item.",
    ringkas: "Sepatu, gadget, brand belum masuk sini.",
  },
  {
    code: "kanada",
    negara: "Kanada",
    kota: "Toronto",
    iata: "YYZ",
    currency: "CAD",
    kurs: 11500,
    kawasan: "Amerika",
    kategori: ["Suplemen", "Pakaian musim dingin", "Skincare", "Makanan"],
    alasan: "Suplemen dan pakaian musim dingin; kualitas bagus.",
    ringkas: "Suplemen, pakaian dingin.",
  },

  // ── Oseania ──────────────────────────────────────────────────────────────
  {
    code: "australia",
    negara: "Australia",
    kota: "Sydney",
    iata: "SYD",
    currency: "AUD",
    kurs: 10400,
    kawasan: "Oseania",
    kategori: ["Vitamin", "Produk kesehatan", "Skincare", "Susu", "Brand lokal"],
    alasan: "Vitamin, susu, dan produk kesehatan dengan permintaan stabil.",
    ringkas: "Vitamin, susu, produk kesehatan.",
  },
  {
    code: "selandia",
    negara: "Selandia Baru",
    kota: "Auckland",
    iata: "AKL",
    currency: "NZD",
    kurs: 9600,
    kawasan: "Oseania",
    kategori: ["Susu & dairy", "Madu", "Wol", "Manuka"],
    alasan: "Susu dan madu berkualitas; permintaan ibu & anak.",
    ringkas: "Susu, madu, wool.",
  },
];

const BY_CODE = new Map(DESTINASI.map((d) => [d.code, d]));

/** Cari destinasi katalog berdasarkan kode. */
export function destinasiByCode(code: string): Destinasi | undefined {
  return BY_CODE.get(code);
}

/** Kode destinasi yang dikenal katalog; kompat dengan trip lama. */
export const DESTINASI_CODES = DESTINASI.map((d) => d.code);

/** Titik asal rumah (Jakarta). Tahap pertama biasanya dari sini. */
export const ASAL = { code: "jakarta", negara: "Indonesia", kota: "Jakarta", iata: "CGK", currency: "IDR" as Currency, kurs: 1, kawasan: "Asia Tenggara" as Kawasan };

/**
 * Bentuk seragam untuk dipakai UI: katalog maupun custom. Custom tidak masuk
 * katalog global, tapi tampil sama.
 *
 * `kode` = `custom:<slug>` untuk custom, atau kode katalog.
 */
export type DestinasiView = {
  kode: string;
  code: string;
  negara: string;
  kota: string;
  iata?: string;
  currency: Currency;
  kurs: number;
  kawasan?: Kawasan;
  kategori: string[];
  alasan: string;
  ringkas: string;
  custom: boolean;
};

/** Kode sentinel yang dipilih pengguna untuk membuka isian negara baru. */
export const CUSTOM_KODE = "__custom__";

/** Kode negara custom dari nama negara, mis. "Brunei Darussalam" → "custom:brunei-darussalam". */
export function customKode(negara: string): string {
  const slug = negara.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "negara";
  return `custom:${slug}`;
}

/** Katalog → view. Kurs diganti kurs dinamis bila tersedia. */
export function toView(d: Destinasi): DestinasiView {
  return { ...d, kode: d.code, kurs: kursUntuk(d.currency, d.kurs), custom: false };
}

/** Custom (disimpan di tahap) → view. Kurs custom dipakai apa adanya. */
export function customToView(kode: string, c: CustomDest): DestinasiView {
  return {
    code: kode,
    kode,
    negara: c.negara,
    kota: c.kota || c.negara,
    iata: c.iata,
    currency: c.currency,
    kurs: c.kurs,
    kategori: [],
    alasan: "Negara tambahan yang kamu isi sendiri.",
    ringkas: "Negara tambahan.",
    custom: true,
  };
}

/**
 * View lengkap untuk satu tahap: pakai custom bawaan tahap bila ada, kalau
 * tidak dari katalog. Mengembalikan `undefined` untuk "jakarta" (titik asal).
 */
export function viewOf(code: string, custom?: CustomDest): DestinasiView | undefined {
  if (custom) return customToView(code, custom);
  if (code === "jakarta") {
    return {
      kode: code, code, negara: ASAL.negara, kota: ASAL.kota, iata: ASAL.iata,
      currency: ASAL.currency, kurs: ASAL.kurs, kawasan: ASAL.kawasan,
      kategori: [], alasan: "Titik asal.", ringkas: "Indonesia.", custom: false,
    };
  }
  if (isCustom(code)) {
    // Kode `custom:<slug>` tapi data custom tak ada (data lama) → tampilkan apa adanya.
    return {
      kode: code, code,
      negara: code.replace(/^custom:/, "").replace(/-/g, " "),
      kota: code.replace(/^custom:/, ""),
      currency: "USD", kurs: kursUntuk("USD", 15800),
      kategori: [], alasan: "Negara tambahan (data tak lengkap).", ringkas: "Negara tambahan.", custom: true,
    };
  }
  const d = BY_CODE.get(code);
  return d ? toView(d) : undefined;
}

/** True bila kode adalah negara tambahan (`custom:<slug>`). */
function isCustom(code: string): boolean {
  return code.startsWith("custom:");
}

/** Daftar negara per kawasan, urut sesuai katalog. */
export function destinasiPerKawasan(): { kawasan: Kawasan; items: Destinasi[] }[] {
  const urut: Kawasan[] = ["Asia Tenggara", "Asia Timur", "Asia Selatan", "Timur Tengah", "Eropa", "Amerika", "Oseania", "Afrika"];
  return urut
    .map((kawasan) => ({ kawasan, items: DESTINASI.filter((d) => d.kawasan === kawasan) }))
    .filter((grup) => grup.items.length > 0);
}
