/**
 * Formatter angka untuk tampilan. Modul ini dulu memuat model marketplace
 * contoh (banyak kota, tarif persen/minimum); sisa yang benar-benar dipakai UI
 * hanyalah format rupiah dan kilogram, jadi hanya itu yang dipertahankan.
 */

/** Pisahkan ribuan dengan titik, desimal dengan koma (gaya Indonesia). */
export function group(n: number, digits = 0): string {
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(digits);
  const [whole, frac] = fixed.split(".");
  const dots = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = frac ? `${dots},${frac}` : dots;
  return neg ? `-${body}` : body;
}

export function idr(n: number): string {
  return `${n < 0 ? "-" : ""}Rp${group(Math.round(Math.abs(n)))}`;
}

/**
 * F09: tampilkan presisi sumber, jangan bulatkan terlalu awal (0,25 dan 0,35
 * dulu sama-sama "0,3 kg"). Pakai sampai 2 desimal, buang nol tak berarti:
 * 0,3 → "0,3"; 0,25 → "0,25". Aturan sama di mana-mana supaya konsisten.
 */
export function kg(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const text = rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, ".0");
  return `${text.replace(".", ",")} kg`;
}
