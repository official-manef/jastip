import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ME,
  marketById,
  nowStamp,
  seedOrders,
  seedTrips,
  type Order,
  type OrderStatus,
  type Trip,
} from "@/lib/titip/model";

export type Role = "pelanggan" | "jastiper";

export type NewOrder = {
  tripId: string;
  buyer: string;
  item: string;
  store: string;
  url: string;
  qty: number;
  unitPrice: number;
  weightKg: number;
  note: string;
};

export type NewTrip = {
  marketId: string;
  dropCity: string;
  departsAt: string;
  returnsAt: string;
  categories: string[];
  feePercent: number;
  minFee: number;
  shippingIdr: number;
  slotsTotal: number;
  weightTotal: number;
  note: string;
};

type Result = { ok: true; code: string; id: string } | { ok: false; error: string };

type State = {
  role: Role;
  trips: Trip[];
  orders: Order[];
  seq: number;
  justAddedId: string | null;
  setRole: (role: Role) => void;
  addOrder: (draft: NewOrder) => Result;
  cancelOrder: (id: string) => Result;
  setStatus: (id: string, status: OrderStatus, note?: string) => Result;
  addTrip: (draft: NewTrip) => Result;
  closeTrip: (id: string) => void;
  reset: () => void;
};

function restoreCapacity(trips: Trip[], order: Order): Trip[] {
  const used = Math.round(order.weightKg * order.qty * 10) / 10;
  return trips.map((t) =>
    t.id === order.tripId
      ? {
          ...t,
          slotsLeft: Math.min(t.slotsTotal, t.slotsLeft + 1),
          weightLeft: Math.min(t.weightTotal, Math.round((t.weightLeft + used) * 10) / 10),
        }
      : t,
  );
}

const fresh = () => ({
  role: "pelanggan" as Role,
  trips: seedTrips(),
  orders: seedOrders(),
  seq: 2406,
  justAddedId: null as string | null,
});

export const useTitip = create<State>()(
  persist(
    (set, get) => ({
      ...fresh(),
      setRole: (role) => set({ role }),
      addOrder: (draft) => {
        let result: Result = { ok: false, error: "Gagal mengirim" };
        set((s) => {
          const trip = s.trips.find((t) => t.id === draft.tripId);
          if (!trip || !trip.open) {
            result = { ok: false, error: "Trip ini sudah tutup." };
            return s;
          }
          if (trip.slotsLeft < 1) {
            result = { ok: false, error: "Slot trip ini sudah habis." };
            return s;
          }
          const used = Math.round(draft.weightKg * draft.qty * 10) / 10;
          if (used > trip.weightLeft + 0.001) {
            result = { ok: false, error: "Berat melebihi sisa muatan." };
            return s;
          }
          const seq = s.seq + 1;
          const code = `TP-${seq}`;
          const id = `od_${seq}`;
          const at = nowStamp();
          const order: Order = {
            id,
            code,
            tripId: draft.tripId,
            buyer: draft.buyer.trim(),
            mine: true,
            item: draft.item.trim(),
            store: draft.store.trim(),
            url: draft.url.trim(),
            qty: draft.qty,
            unitPrice: draft.unitPrice,
            weightKg: draft.weightKg,
            note: draft.note.trim(),
            status: "diminta",
            createdAt: at,
            events: [{ status: "diminta", at }],
          };
          result = { ok: true, code, id };
          return {
            seq,
            orders: [order, ...s.orders],
            trips: s.trips.map((t) =>
              t.id === trip.id
                ? {
                    ...t,
                    slotsLeft: t.slotsLeft - 1,
                    weightLeft: Math.round((t.weightLeft - used) * 10) / 10,
                  }
                : t,
            ),
          };
        });
        return result;
      },
      cancelOrder: (id) => {
        const current = get().orders.find((o) => o.id === id);
        if (!current || !current.mine) return { ok: false, error: "Pesanan ini bukan milikmu." };
        if (current.status !== "diminta") {
          return { ok: false, error: "Hanya permintaan yang belum dikonfirmasi yang bisa dibatalkan." };
        }
        const at = nowStamp();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id
              ? { ...o, status: "ditolak", events: [...o.events, { status: "ditolak", at, note: "Dibatalkan pemesan." }] }
              : o,
          ),
          trips: restoreCapacity(s.trips, current),
        }));
        return { ok: true, code: current.code, id };
      },
      setStatus: (id, status, note) => {
        const current = get().orders.find((o) => o.id === id);
        if (!current) return { ok: false, error: "Pesanan tidak ketemu." };
        if (get().role !== "jastiper") return { ok: false, error: "Ganti ke peran Bawa dulu." };
        const trip = get().trips.find((t) => t.id === current.tripId);
        if (!trip || trip.owner !== "me") return { ok: false, error: "Ini bukan trip kamu." };
        const at = nowStamp();
        const trimmed = note?.trim();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status,
                  events: [...o.events, { status, at, note: trimmed || undefined }],
                }
              : o,
          ),
          trips: status === "ditolak" && current.status !== "ditolak" ? restoreCapacity(s.trips, current) : s.trips,
        }));
        return { ok: true, code: current.code, id };
      },
      addTrip: (draft) => {
        const market = MARKETS_SAFE(draft.marketId);
        if (!market) return { ok: false, error: "Pilih kota belanja." };
        const id = `tr_${Date.now().toString(36)}`;
        const row: Trip = {
          id,
          owner: "me",
          jastiperName: ME.name,
          handle: ME.handle,
          rating: ME.rating,
          completed: ME.completed,
          base: ME.base,
          marketId: draft.marketId,
          dropCity: draft.dropCity,
          departsAt: draft.departsAt,
          returnsAt: draft.returnsAt,
          categories: draft.categories,
          feePercent: draft.feePercent,
          minFee: draft.minFee,
          shippingIdr: draft.shippingIdr,
          slotsLeft: draft.slotsTotal,
          slotsTotal: draft.slotsTotal,
          weightLeft: draft.weightTotal,
          weightTotal: draft.weightTotal,
          note: draft.note.trim(),
          open: true,
        };
        set((s) => ({ trips: [row, ...s.trips], justAddedId: id }));
        return { ok: true, code: market.code, id };
      },
      closeTrip: (id) =>
        set((s) => ({
          trips: s.trips.map((t) => (t.id === id && t.owner === "me" ? { ...t, open: !t.open } : t)),
        })),
      reset: () => set(fresh()),
    }),
    {
      name: "titipin-ledger-v1",
      skipHydration: true,
      partialize: (s) => ({ role: s.role, trips: s.trips, orders: s.orders, seq: s.seq }),
    },
  ),
);

function MARKETS_SAFE(id: string) {
  try {
    return marketById(id);
  } catch {
    return null;
  }
}
