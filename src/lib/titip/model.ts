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

export function kg(n: number): string {
  return `${n.toFixed(1).replace(".", ",")} kg`;
}
