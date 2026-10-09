export const MARKETS = [
  { id: "tyo", city: "Tokyo", code: "TYO", country: "Jepang", currency: "JPY", symbol: "¥", rate: 108 },
  { id: "osa", city: "Osaka", code: "OSA", country: "Jepang", currency: "JPY", symbol: "¥", rate: 108 },
  { id: "sel", city: "Seoul", code: "SEL", country: "Korea", currency: "KRW", symbol: "₩", rate: 11 },
  { id: "bkk", city: "Bangkok", code: "BKK", country: "Thailand", currency: "THB", symbol: "฿", rate: 470 },
  { id: "sin", city: "Singapura", code: "SIN", country: "Singapura", currency: "SGD", symbol: "S$", rate: 12200 },
  { id: "lax", city: "Los Angeles", code: "LAX", country: "Amerika", currency: "USD", symbol: "$", rate: 15800 },
] as const;

export const DROPS = ["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Medan", "Denpasar"] as const;

export const CATS = ["Fashion", "Skincare", "Snack", "Sneakers", "Elektronik", "Figure", "Alat tulis"] as const;

export const ME = {
  name: "Raka Wijaya",
  handle: "raka.bawa",
  rating: 4.9,
  completed: 38,
  base: "Jakarta",
} as const;

export type Market = (typeof MARKETS)[number];

export type OrderStatus =
  | "diminta"
  | "dikonfirmasi"
  | "dibeli"
  | "dikirim"
  | "tiba"
  | "selesai"
  | "ditolak";

export type Trip = {
  id: string;
  owner: "me" | "other";
  jastiperName: string;
  handle: string;
  rating: number;
  completed: number;
  base: string;
  marketId: string;
  dropCity: string;
  departsAt: string;
  returnsAt: string;
  categories: string[];
  feePercent: number;
  minFee: number;
  shippingIdr: number;
  slotsLeft: number;
  slotsTotal: number;
  weightLeft: number;
  weightTotal: number;
  note: string;
  open: boolean;
};

export type OrderEvent = {
  status: OrderStatus;
  at: string;
  note?: string;
};

export type Order = {
  id: string;
  code: string;
  tripId: string;
  buyer: string;
  mine: boolean;
  item: string;
  store: string;
  url: string;
  qty: number;
  unitPrice: number;
  weightKg: number;
  note: string;
  status: OrderStatus;
  createdAt: string;
  events: OrderEvent[];
};

export const FLOW: { id: OrderStatus; label: string; hint: string }[] = [
  { id: "diminta", label: "Diminta", hint: "Menunggu jawaban jastiper" },
  { id: "dikonfirmasi", label: "Dikonfirmasi", hint: "Diterima, siap dibelikan" },
  { id: "dibeli", label: "Dibeli", hint: "Sudah dibayar di toko" },
  { id: "dikirim", label: "Dikirim", hint: "Dalam perjalanan pulang" },
  { id: "tiba", label: "Tiba", hint: "Sampai di kota antar" },
  { id: "selesai", label: "Selesai", hint: "Sudah diserahkan" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function marketById(id: string): Market {
  const found = MARKETS.find((m) => m.id === id);
  if (!found) throw new Error(`Pasar tidak dikenal: ${id}`);
  return found;
}

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

export function moneyForeign(n: number, market: Market): string {
  const digits = market.currency === "JPY" || market.currency === "KRW" ? 0 : 2;
  return `${market.symbol}${group(n, digits)}`;
}

export function kg(n: number): string {
  return `${n.toFixed(1).replace(".", ",")} kg`;
}

export function ratingLabel(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

export function formatDay(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

export function formatRange(a: string, b: string): string {
  return `${formatDay(a)} – ${formatDay(b)}`;
}

export function formatStamp(iso: string): string {
  const [date, time] = iso.split("T");
  const hm = (time ?? "00:00").slice(0, 5).replace(":", ".");
  return `${formatDay(date)} · ${hm}`;
}

export function nowStamp(): string {
  const n = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`;
}

export function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function whenLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return "sudah lewat";
  if (d === 0) return "hari ini";
  if (d === 1) return "besok";
  return `${d} hari lagi`;
}

export type Quote = {
  foreign: number;
  goods: number;
  fee: number;
  ship: number;
  total: number;
  market: Market;
  feeWasMin: boolean;
};

export function quote(trip: Trip, qty: number, unitPrice: number): Quote {
  const market = marketById(trip.marketId);
  const foreign = qty * unitPrice;
  const goods = Math.round(foreign * market.rate);
  const feeRaw = Math.round((goods * trip.feePercent) / 100);
  const feeWasMin = feeRaw < trip.minFee;
  const fee = Math.max(trip.minFee, feeRaw);
  const ship = trip.shippingIdr;
  return { foreign, goods, fee, ship, total: goods + fee + ship, market, feeWasMin };
}

export function statusMeta(status: OrderStatus) {
  if (status === "ditolak") return { label: "Ditolak", hint: "Jastiper tidak bisa bawa" };
  return FLOW.find((s) => s.id === status) ?? FLOW[0];
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = FLOW.findIndex((s) => s.id === status);
  if (i < 0 || i >= FLOW.length - 1) return null;
  return FLOW[i + 1].id;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

function trip(partial: Trip): Trip {
  return partial;
}

function order(partial: Order): Order {
  return partial;
}

export function seedTrips(): Trip[] {
  return [
    trip({
      id: "tr_tokyo",
      owner: "me",
      jastiperName: ME.name,
      handle: ME.handle,
      rating: ME.rating,
      completed: ME.completed,
      base: ME.base,
      marketId: "tyo",
      dropCity: "Jakarta",
      departsAt: "2026-10-14",
      returnsAt: "2026-10-21",
      categories: ["Fashion", "Skincare", "Snack"],
      feePercent: 12,
      minFee: 25000,
      shippingIdr: 20000,
      slotsLeft: 5,
      slotsTotal: 8,
      weightLeft: 8.4,
      weightTotal: 12,
      note: "Shibuya, Ginza, dan drugstore. Tidak terima cairan di atas 100 ml atau branded tanpa struk.",
      open: true,
    }),
    trip({
      id: "tr_seoul",
      owner: "other",
      jastiperName: "Salsa Putri",
      handle: "salsa.kulit",
      rating: 4.8,
      completed: 21,
      base: "Bandung",
      marketId: "sel",
      dropCity: "Bandung",
      departsAt: "2026-10-12",
      returnsAt: "2026-10-18",
      categories: ["Skincare", "Fashion"],
      feePercent: 10,
      minFee: 20000,
      shippingIdr: 15000,
      slotsLeft: 2,
      slotsTotal: 6,
      weightLeft: 3.1,
      weightTotal: 8,
      note: "Olive Young Myeongdong dan Musinsa. Shade makeup dikonfirmasi dulu lewat catatan.",
      open: true,
    }),
    trip({
      id: "tr_bkk",
      owner: "other",
      jastiperName: "Dimas Arya",
      handle: "dimas.bawa",
      rating: 4.7,
      completed: 14,
      base: "Surabaya",
      marketId: "bkk",
      dropCity: "Surabaya",
      departsAt: "2026-10-11",
      returnsAt: "2026-10-16",
      categories: ["Snack", "Skincare"],
      feePercent: 8,
      minFee: 15000,
      shippingIdr: 18000,
      slotsLeft: 4,
      slotsTotal: 10,
      weightLeft: 6.5,
      weightTotal: 15,
      note: "Big C dan Boots. Snack dalam kemasan utuh. Tidak bawa durian atau barang berbau.",
      open: true,
    }),
    trip({
      id: "tr_sin",
      owner: "other",
      jastiperName: "Mira Hartono",
      handle: "mira.snkr",
      rating: 5,
      completed: 9,
      base: "Jakarta",
      marketId: "sin",
      dropCity: "Jakarta",
      departsAt: "2026-10-18",
      returnsAt: "2026-10-20",
      categories: ["Sneakers", "Fashion"],
      feePercent: 15,
      minFee: 50000,
      shippingIdr: 25000,
      slotsLeft: 3,
      slotsTotal: 4,
      weightLeft: 4.2,
      weightTotal: 6,
      note: "Orchard dan Jewel. Ukuran sepatu wajib ditulis. Full set box, tidak dipotong.",
      open: true,
    }),
    trip({
      id: "tr_lax",
      owner: "other",
      jastiperName: "Farhan Malik",
      handle: "farhan.us",
      rating: 4.6,
      completed: 6,
      base: "Jakarta",
      marketId: "lax",
      dropCity: "Jakarta",
      departsAt: "2026-11-02",
      returnsAt: "2026-11-12",
      categories: ["Elektronik", "Fashion", "Sneakers"],
      feePercent: 18,
      minFee: 75000,
      shippingIdr: 45000,
      slotsLeft: 6,
      slotsTotal: 6,
      weightLeft: 10,
      weightTotal: 10,
      note: "Retail US dengan resi. Tidak terima baterai lepas dan parfum di atas 100 ml.",
      open: true,
    }),
    trip({
      id: "tr_osa",
      owner: "other",
      jastiperName: "Intan Laras",
      handle: "intan.osa",
      rating: 4.9,
      completed: 17,
      base: "Yogyakarta",
      marketId: "osa",
      dropCity: "Yogyakarta",
      departsAt: "2026-10-25",
      returnsAt: "2026-11-02",
      categories: ["Figure", "Alat tulis", "Snack"],
      feePercent: 11,
      minFee: 20000,
      shippingIdr: 22000,
      slotsLeft: 7,
      slotsTotal: 8,
      weightLeft: 5.5,
      weightTotal: 7,
      note: "Den-Den Town dan Loft. Figure preorder hanya jika rilis sebelum tanggal pulang.",
      open: true,
    }),
  ];
}

export function seedOrders(): Order[] {
  return [
    order({
      id: "od_nadya",
      code: "TP-2401",
      tripId: "tr_tokyo",
      buyer: "Nadya",
      mine: false,
      item: "Heattech crewneck",
      store: "Uniqlo Shibuya",
      url: "https://www.uniqlo.com/jp/",
      qty: 2,
      unitPrice: 2990,
      weightKg: 0.3,
      note: "Hitam, size M.",
      status: "dikonfirmasi",
      createdAt: "2026-10-07T09:20",
      events: [
        { status: "diminta", at: "2026-10-07T09:20" },
        { status: "dikonfirmasi", at: "2026-10-07T14:05", note: "Stok ada." },
      ],
    }),
    order({
      id: "od_gilang",
      code: "TP-2402",
      tripId: "tr_tokyo",
      buyer: "Gilang",
      mine: false,
      item: "Mexico 66",
      store: "Onitsuka Tiger",
      url: "",
      qty: 1,
      unitPrice: 14300,
      weightKg: 0.9,
      note: "Putih/biru, 42.",
      status: "diminta",
      createdAt: "2026-10-09T08:10",
      events: [{ status: "diminta", at: "2026-10-09T08:10" }],
    }),
    order({
      id: "od_putri",
      code: "TP-2403",
      tripId: "tr_tokyo",
      buyer: "Putri",
      mine: false,
      item: "Shiro hair oil",
      store: "Shiro Ginza",
      url: "",
      qty: 1,
      unitPrice: 4400,
      weightKg: 0.2,
      note: "Yang 30 ml.",
      status: "dibeli",
      createdAt: "2026-10-06T11:00",
      events: [
        { status: "diminta", at: "2026-10-06T11:00" },
        { status: "dikonfirmasi", at: "2026-10-06T16:40" },
        { status: "dibeli", at: "2026-10-08T13:15", note: "Struk disimpan." },
      ],
    }),
    order({
      id: "od_me_seoul",
      code: "TP-2404",
      tripId: "tr_seoul",
      buyer: "Aku",
      mine: true,
      item: "Heartleaf 77 toner",
      store: "Olive Young",
      url: "",
      qty: 1,
      unitPrice: 18900,
      weightKg: 0.4,
      note: "Versi 250 ml.",
      status: "dikirim",
      createdAt: "2026-10-05T18:22",
      events: [
        { status: "diminta", at: "2026-10-05T18:22" },
        { status: "dikonfirmasi", at: "2026-10-05T21:00" },
        { status: "dibeli", at: "2026-10-08T12:30" },
        { status: "dikirim", at: "2026-10-09T07:45", note: "Masuk koper, pulang 18 Okt." },
      ],
    }),
    order({
      id: "od_me_bkk",
      code: "TP-2405",
      tripId: "tr_bkk",
      buyer: "Aku",
      mine: true,
      item: "Mama cup variety",
      store: "Big C",
      url: "",
      qty: 6,
      unitPrice: 45,
      weightKg: 0.2,
      note: "Campur rasa tom yum dan creamy.",
      status: "tiba",
      createdAt: "2026-10-04T10:12",
      events: [
        { status: "diminta", at: "2026-10-04T10:12" },
        { status: "dikonfirmasi", at: "2026-10-04T15:00" },
        { status: "dibeli", at: "2026-10-07T09:40" },
        { status: "dikirim", at: "2026-10-08T20:10" },
        { status: "tiba", at: "2026-10-09T16:05", note: "Bisa diambil besok di Surabaya." },
      ],
    }),
    order({
      id: "od_me_sin",
      code: "TP-2406",
      tripId: "tr_sin",
      buyer: "Aku",
      mine: true,
      item: "2002R",
      store: "Foot Locker Orchard",
      url: "",
      qty: 1,
      unitPrice: 189,
      weightKg: 1.1,
      note: "Warna sea salt, size 43. Boleh ganti warna kalau habis.",
      status: "diminta",
      createdAt: "2026-10-09T11:30",
      events: [{ status: "diminta", at: "2026-10-09T11:30" }],
    }),
  ];
}

export type Activity = {
  at: string;
  buyer: string;
  item: string;
  status: OrderStatus;
  tripLabel: string;
};

export function recentActivity(orders: Order[], trips: Trip[]): Activity[] {
  const rows: Activity[] = [];
  for (const o of orders) {
    const tripRow = trips.find((t) => t.id === o.tripId);
    const market = tripRow ? marketById(tripRow.marketId) : null;
    const tripLabel = tripRow && market ? `${market.code} → ${tripRow.dropCity}` : "Trip";
    for (const e of o.events) {
      rows.push({ at: e.at, buyer: o.buyer, item: o.item, status: e.status, tripLabel });
    }
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  return rows.slice(0, 6);
}
