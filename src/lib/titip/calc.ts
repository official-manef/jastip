export type Dir = "cgk-ist" | "ist-cgk";

export type Good = {
  id: string;
  name: string;
  kg: number;
  qty: number;
  beli: number;
  feeMode?: "kg" | "item";
  feeRate?: number;
};

export type OpexLine = { id: string; label: string; amount: number };
export type CapexLine = { id: string; label: string; price: number; trips: number };

export type Scenario = {
  bags: number;
  kgPerBag: number;
  cabin: number;
  tare: number;
  overPerKg: number;
  hargaPerKg: number;
  margin: number;
  ujiKg: number;
  kursTry: number;
  goods: Good[];
  opex: OpexLine[];
  capex: CapexLine[];
};

export type Ledger = {
  kotor: number;
  bersih: number;
  terpakai: number;
  sisa: number;
  overKg: number;
  denda: number;
  opexBase: number;
  opex: number;
  capexTrip: number;
  beban: number;
  modalPerKg: number;
  saranPerKg: number;
  pendapatan: number;
  laba: number;
  nilaiBeliIdr: number;
  pcsUji: number;
  potensi: number;
  breakEvenKg: number;
  penuh: number;
  mixedPricing: boolean;
};

export const DIR_META: Record<Dir, { from: string; to: string; code: string; shop: "IDR" | "TRY"; blurb: string }> = {
  "cgk-ist": {
    from: "Jakarta",
    to: "Turki",
    code: "CGK → IST",
    shop: "IDR",
    blurb: "Beli di Jakarta, bagasi turun di Istanbul.",
  },
  "ist-cgk": {
    from: "Turki",
    to: "Jakarta",
    code: "IST → CGK",
    shop: "TRY",
    blurb: "Beli di Istanbul, bagasi turun di Jakarta.",
  },
};

function good(id: string, name: string, kg: number, qty: number, beli: number): Good {
  return { id, name, kg, qty, beli };
}

export function scenarioFor(dir: Dir): Scenario {
  if (dir === "cgk-ist") {
    return {
      bags: 1,
      kgPerBag: 23,
      cabin: 7,
      tare: 3.2,
      overPerKg: 350000,
      hargaPerKg: 280000,
      margin: 40,
      ujiKg: 0.5,
      kursTry: 470,
      goods: [
        good("kopi", "Kopi biji", 1, 4, 180000),
        good("teh", "Teh kemasan", 0.4, 3, 45000),
        good("skin", "Skincare", 0.25, 6, 85000),
        good("snack", "Snack", 0.35, 4, 40000),
        good("batik", "Batik", 0.5, 2, 250000),
      ],
      opex: [
        { id: "tiket", label: "Tiket CGK–IST", amount: 6800000 },
        { id: "transfer", label: "Transfer bandara", amount: 250000 },
        { id: "pack", label: "Packing & lakban", amount: 150000 },
        { id: "visa", label: "E-visa Turki", amount: 750000 },
        { id: "makan", label: "Makan & lokal", amount: 400000 },
      ],
      capex: [
        { id: "koper", label: "Koper", price: 1800000, trips: 24 },
        { id: "scale", label: "Timbangan", price: 350000, trips: 40 },
        { id: "cube", label: "Packing cube", price: 220000, trips: 20 },
      ],
    };
  }
  return {
    bags: 1,
    kgPerBag: 30,
    cabin: 8,
    tare: 3.5,
    overPerKg: 380000,
    hargaPerKg: 420000,
    margin: 45,
    ujiKg: 0.4,
    kursTry: 470,
    goods: [
      good("delight", "Turkish delight", 0.8, 3, 450),
      good("tekstil", "Tekstil & scarf", 0.45, 4, 600),
      good("parfum", "Parfum kecil", 0.15, 4, 900),
      good("sepatu", "Sepatu", 0.9, 1, 2500),
      good("kurma", "Kurma", 1, 2, 350),
    ],
    opex: [
      { id: "tiket", label: "Tiket IST–CGK", amount: 7200000 },
      { id: "transfer", label: "Transfer Istanbul", amount: 300000 },
      { id: "pack", label: "Packing", amount: 180000 },
      { id: "makan", label: "Makan & lokal", amount: 500000 },
      { id: "last", label: "Antar Jakarta", amount: 200000 },
    ],
    capex: [
      { id: "koper", label: "Koper", price: 1800000, trips: 24 },
      { id: "scale", label: "Timbangan", price: 350000, trips: 40 },
      { id: "cube", label: "Packing cube", price: 220000, trips: 20 },
    ],
  };
}

export function feeFor(g: Good, defaultPerKg: number): number {
  const rate = g.feeRate ?? (g.feeMode === "item" ? 0 : defaultPerKg);
  return g.qty * rate * (g.feeMode === "item" ? 1 : g.kg);
}

export function compute(dir: Dir, s: Scenario): Ledger {
  const kotor = round1(s.bags * s.kgPerBag + s.cabin);
  const bersih = round1(Math.max(0, kotor - s.tare));
  const terpakai = round1(s.goods.reduce((sum, g) => sum + g.kg * g.qty, 0));
  const sisa = round1(bersih - terpakai);
  const overKg = round1(Math.max(0, -sisa));
  const denda = Math.round(overKg * s.overPerKg);
  const opexBase = s.opex.reduce((sum, line) => sum + line.amount, 0);
  const opex = opexBase + denda;
  const capexTrip = Math.round(
    s.capex.reduce((sum, line) => sum + line.price / Math.max(1, line.trips), 0),
  );
  const beban = opex + capexTrip;
  const modalPerKg = bersih > 0 ? Math.round(beban / bersih) : 0;
  const saranPerKg = Math.round(modalPerKg * (1 + s.margin / 100));
  const pendapatan = Math.round(s.goods.reduce((sum, g) => sum + feeFor(g, s.hargaPerKg), 0));
  const mixedPricing = s.goods.some((g) => g.feeMode === "item" || g.feeRate !== undefined);
  const laba = pendapatan - beban;
  const nilaiBeliIdr = Math.round(
    s.goods.reduce((sum, g) => {
      const raw = g.qty * g.beli;
      return sum + (dir === "ist-cgk" ? raw * s.kursTry : raw);
    }, 0),
  );
  const room = Math.max(0, sisa);
  const pcsUji = s.ujiKg > 0 ? Math.floor(room / s.ujiKg) : 0;
  const potensi = Math.round(room * s.hargaPerKg);
  const effectiveRate = mixedPricing && terpakai > 0 ? pendapatan / terpakai : s.hargaPerKg;
  const breakEvenKg = effectiveRate > 0 ? round1(beban / effectiveRate) : 0;
  const penuh = bersih > 0 ? Math.min(1, terpakai / bersih) : 1;
  return {
    kotor,
    bersih,
    terpakai,
    sisa,
    overKg,
    denda,
    opexBase,
    opex,
    capexTrip,
    beban,
    modalPerKg,
    saranPerKg,
    pendapatan,
    laba,
    nilaiBeliIdr,
    pcsUji,
    potensi,
    breakEvenKg,
    penuh,
    mixedPricing,
  };
}

export type TripMode = "one" | "pp";

export type TripLedger = Ledger & {
  mode: TripMode;
  tiket: number;
  tiketLawan: number;
  tiketTotal: number;
  opexLain: number;
  kaki: 1 | 2;
};

function ticketAmount(s: Scenario): number {
  return s.opex.find((line) => line.id === "tiket")?.amount ?? 0;
}

/** One-way uses the open leg. PP sums both tickets and the other opex, and counts capex once. */
export function computeTrip(mode: TripMode, dir: Dir, byDir: Record<Dir, Scenario>): TripLedger {
  const here = compute(dir, byDir[dir]);
  const other: Dir = dir === "cgk-ist" ? "ist-cgk" : "cgk-ist";
  const there = compute(other, byDir[other]);
  const tiket = ticketAmount(byDir[dir]);
  const tiketLawan = ticketAmount(byDir[other]);

  if (mode === "one") {
    return {
      ...here,
      mode,
      tiket,
      tiketLawan: 0,
      tiketTotal: tiket,
      opexLain: here.opexBase - tiket,
      kaki: 1,
    };
  }

  const opexBase = here.opexBase + there.opexBase;
  const denda = here.denda + there.denda;
  const opex = opexBase + denda;
  const capexTrip = compute("cgk-ist", byDir["cgk-ist"]).capexTrip;
  const beban = opex + capexTrip;
  const bersihAll = here.bersih + there.bersih;
  const modalPerKg = bersihAll > 0 ? Math.round(beban / bersihAll) : 0;
  const saranPerKg = Math.round(modalPerKg * (1 + byDir[dir].margin / 100));
  const pendapatan = here.pendapatan + there.pendapatan;
  const laba = pendapatan - beban;
  const mixedPricing = here.mixedPricing || there.mixedPricing;
  const usedAll = here.terpakai + there.terpakai;
  const hargaAvg = usedAll > 0 ? pendapatan / usedAll
    : bersihAll > 0 ? (here.bersih * byDir[dir].hargaPerKg + there.bersih * byDir[other].hargaPerKg) / bersihAll : 0;
  return {
    ...here,
    mode,
    opexBase,
    opex,
    denda,
    capexTrip,
    beban,
    modalPerKg,
    saranPerKg,
    pendapatan,
    laba,
    mixedPricing,
    nilaiBeliIdr: here.nilaiBeliIdr + there.nilaiBeliIdr,
    breakEvenKg: hargaAvg > 0 ? round1(beban / hargaAvg) : 0,
    tiket,
    tiketLawan,
    tiketTotal: tiket + tiketLawan,
    opexLain: opexBase - tiket - tiketLawan,
    kaki: 2,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
