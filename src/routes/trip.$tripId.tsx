import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Breakdown, Button, control, Field, Mark, SlotMeter, When } from "@/components/titip/ui";
import { formatRange, idr, kg, marketById, moneyForeign, quote, ratingLabel } from "@/lib/titip/model";
import { useTitip } from "@/lib/titip/store";

export const Route = createFileRoute("/trip/$tripId")({
  component: TripPage,
});

const WEIGHTS = [0.2, 0.5, 1, 2];

function TripPage() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const trip = useTitip((s) => s.trips.find((t) => t.id === tripId));
  const addOrder = useTitip((s) => s.addOrder);
  const [item, setItem] = useState("");
  const [store, setStore] = useState("");
  const [url, setUrl] = useState("");
  const [buyer, setBuyer] = useState("Aku");
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState(0.5);
  const [error, setError] = useState("");

  const unit = Number(price.replace(",", ".")) || 0;
  const q = useMemo(() => (trip ? quote(trip, qty, unit) : null), [trip, qty, unit]);

  if (!trip || !q) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl">Trip ini tidak ada.</h1>
        <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary">
          Kembali ke papan
        </Link>
      </div>
    );
  }

  const market = marketById(trip.marketId);
  const closed = !trip.open || trip.slotsLeft < 1;
  const weightNeed = Math.round(weight * qty * 10) / 10;
  const tooHeavy = weightNeed > trip.weightLeft + 0.001;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!trip) return;
    if (item.trim().length < 2) return setError("Nama barang masih terlalu pendek.");
    if (store.trim().length < 2) return setError("Isi nama toko.");
    if (url && !/^https?:\/\//.test(url.trim())) return setError("Link harus diawali http:// atau https://");
    if (buyer.trim().length < 2) return setError("Isi nama pemesan.");
    if (!(unit > 0)) return setError("Harga satuan harus lebih dari nol.");
    if (tooHeavy) return setError("Berat melebihi sisa muatan trip ini.");
    const res = addOrder({
      tripId: trip.id,
      buyer,
      item,
      store,
      url,
      qty,
      unitPrice: unit,
      weightKg: weight,
      note,
    });
    if (!res.ok) return setError(res.error);
    toast.success(`${res.code} masuk antrean.`);
    void navigate({ to: "/pesanan" });
  }

  return (
    <div>
      <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Semua trip
      </Link>
      <div className="mt-2 grid gap-6 lg:grid-cols-2">
        <section>
          <p className="text-sm font-medium text-primary">
            {market.city}, {market.country}
          </p>
          <h1 className="mt-1 text-4xl leading-tight">
            {market.code} → {trip.dropCity}
          </h1>
          <p className="mt-2 text-muted">
            {formatRange(trip.departsAt, trip.returnsAt)} · berangkat <When iso={trip.departsAt} />
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Mark name={trip.jastiperName} />
            <div>
              <p className="font-medium">
                {trip.jastiperName}
                <span className="text-muted"> @{trip.handle}</span>
              </p>
              <p className="text-sm text-muted">
                {ratingLabel(trip.rating)} · {trip.completed} trip selesai · antar dari {trip.base}
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-prose text-sm">{trip.note}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {trip.categories.map((c) => (
              <li key={c} className="rounded-full bg-surface px-2.5 py-1 text-xs border border-border">
                {c}
              </li>
            ))}
          </ul>
          <div className="mt-5 max-w-sm rounded-2xl border border-border bg-surface p-4">
            <SlotMeter trip={trip} />
            <p className="mt-2 text-sm text-muted">
              Sisa {kg(trip.weightLeft)} dari {kg(trip.weightTotal)}. Ongkir {trip.shippingIdr === 0 ? "—" : "flat"} per
              permintaan, jasa {trip.feePercent}% (minimum berlaku).
            </p>
          </div>
        </section>

        <form onSubmit={submit} className="h-fit rounded-3xl border border-border bg-surface p-4 shadow-ticket lg:sticky lg:top-24">
          <h2 className="text-2xl">Hitung & kirim</h2>
          <p className="mt-1 text-sm text-muted">
            Harga dalam {market.currency}. Kurs demo 1 {market.symbol} = {idr(market.rate)}.
          </p>
          <div className="mt-4 space-y-3">
            <Field label="Barang">
              <input value={item} onChange={(e) => setItem(e.target.value)} className={control} placeholder="Nama barang" />
            </Field>
            <Field label="Toko">
              <input value={store} onChange={(e) => setStore(e.target.value)} className={control} placeholder="Uniqlo, Olive Young…" />
            </Field>
            <Field label="Link" hint="opsional">
              <input value={url} onChange={(e) => setUrl(e.target.value)} className={control} placeholder="https://" inputMode="url" />
            </Field>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Jumlah">
                <div className="flex items-center gap-2">
                  <Button variant="line" className="size-11 px-0" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Kurangi">
                    −
                  </Button>
                  <span className="w-6 text-center tabular-nums">{qty}</span>
                  <Button variant="line" className="size-11 px-0" onClick={() => setQty((n) => Math.min(20, n + 1))} aria-label="Tambah">
                    +
                  </Button>
                </div>
              </Field>
              <div className="min-w-40 flex-1">
              <Field label="Harga satuan" hint={market.currency}>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={control}
                  inputMode="decimal"
                  placeholder={market.currency === "JPY" ? "2990" : "189"}
                />
              </Field>
              </div>
            </div>
            <Field label="Berat per item" hint={tooHeavy ? "muatan tidak cukup" : `${weightNeed.toFixed(1).replace(".", ",")} kg`}>
              <div className="flex flex-wrap gap-2">
                {WEIGHTS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeight(w)}
                    className={
                      weight === w
                        ? "min-h-10 rounded-full bg-primary px-3 text-sm text-primary-fg"
                        : "min-h-10 rounded-full border border-border px-3 text-sm"
                    }
                  >
                    {w.toFixed(1).replace(".", ",")} kg
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Nama pemesan">
              <input value={buyer} onChange={(e) => setBuyer(e.target.value)} className={control} />
            </Field>
            <Field label="Catatan" hint="ukuran, warna, pengganti">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${control} min-h-20 py-2`} />
            </Field>
            <p className="text-xs text-muted tabular-nums">
              Subtotal {moneyForeign(q.foreign, market)}
            </p>
            <Breakdown q={q} />
            {error ? <p className="text-sm text-accent">{error}</p> : null}
            <Button type="submit" className="w-full justify-between" disabled={closed || tooHeavy}>
              <span>{closed ? "Trip tidak menerima" : "Kirim permintaan"}</span>
              <span className="tabular-nums">{unit > 0 ? idr(q.total) : ""}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
