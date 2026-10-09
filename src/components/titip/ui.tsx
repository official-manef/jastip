import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  idr,
  initials,
  kg,
  marketById,
  quote,
  ratingLabel,
  statusMeta,
  whenLabel,
  FLOW,
  type Order,
  type OrderStatus,
  type Quote,
  type Trip,
} from "@/lib/titip/model";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const tap = "transition-transform duration-150 ease-out active:scale-[0.96] disabled:active:scale-100";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "line" | "ghost" | "danger" }) {
  const look = {
    primary: "bg-primary text-primary-fg",
    line: "border border-border bg-surface text-fg",
    ghost: "bg-transparent text-fg",
    danger: "border border-accent bg-surface text-accent",
  }[variant];
  return (
    <button
      type={type}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium",
        tap,
        look,
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

export const control =
  "min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none placeholder:text-muted";

export function Mark({ name }: { name: string }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bg font-display text-sm text-primary">
      {initials(name)}
    </span>
  );
}

export function When({ iso, prefix }: { iso: string; prefix?: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(whenLabel(iso));
  }, [iso]);
  return (
    <span>
      {prefix}
      {label ?? "—"}
    </span>
  );
}

export function SlotMeter({ trip }: { trip: Trip }) {
  const used = trip.slotsTotal - trip.slotsLeft;
  const pct = trip.slotsTotal === 0 ? 0 : Math.round((used / trip.slotsTotal) * 100);
  const tight = trip.slotsLeft > 0 && trip.slotsLeft <= 2;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
        <span className={tight ? "font-medium text-accent" : undefined}>
          {trip.slotsLeft === 0 ? "Slot habis" : tight ? `Tinggal ${trip.slotsLeft} slot` : `${trip.slotsLeft} slot tersisa`}
        </span>
        <span className="tabular-nums">
          {used}/{trip.slotsTotal}
        </span>
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TripTicket({ trip, highlight }: { trip: Trip; highlight?: boolean }) {
  const market = marketById(trip.marketId);
  const full = trip.slotsLeft < 1;
  const closed = !trip.open;
  return (
    <article
      className={cx(
        "relative flex h-full flex-col rounded-3xl border border-border bg-surface p-4 shadow-ticket",
        highlight && "ring-2 ring-primary",
        (closed || full) && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl leading-none tracking-tight">
            {market.code}
            <span className="px-1.5 text-muted">→</span>
            {trip.dropCity}
          </p>
          <p className="mt-1 text-sm text-muted">
            {market.city} · berangkat <When iso={trip.departsAt} />
          </p>
        </div>
        <span
          className={cx(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            closed ? "bg-bg text-muted" : "bg-primary text-primary-fg",
          )}
        >
          {closed ? "Tutup" : "Open"}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Mark name={trip.jastiperName} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {trip.jastiperName}
            {trip.owner === "me" ? <span className="text-muted"> · kamu</span> : null}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
            <span className="tabular-nums">{ratingLabel(trip.rating)}</span>
            <span>· {trip.completed} trip</span>
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {trip.categories.map((c) => (
          <li key={c} className="rounded-full bg-bg px-2 py-0.5 text-xs">
            {c}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <SlotMeter trip={trip} />
        <p className="mt-2 text-xs text-muted">Sisa muatan {kg(trip.weightLeft)}</p>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-dashed border-line pt-3">
        <div>
          <p className="text-xs text-muted">Jasa</p>
          <p className="font-display text-xl leading-none tabular-nums">{trip.feePercent}%</p>
          <p className="mt-1 text-xs text-muted">min {idr(trip.minFee)}</p>
        </div>
        {closed || full ? (
          <span className="text-sm text-muted">{closed ? "Tidak menerima" : "Penuh"}</span>
        ) : (
          <Link
            to="/trip/$tripId"
            params={{ tripId: trip.id }}
            className={cx(
              "inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg",
              tap,
            )}
          >
            Titip barang
          </Link>
        )}
      </div>
    </article>
  );
}

export function Breakdown({ q }: { q: Quote }) {
  const rows = [
    ["Harga barang", idr(q.goods), `1 ${q.market.currency} = ${idr(q.market.rate)}`],
    ["Ongkir antar", idr(q.ship), "flat per permintaan"],
    ["Jasa titip", idr(q.fee), q.feeWasMin ? "kena minimum" : "dari harga barang"],
  ] as const;
  return (
    <div className="rounded-2xl border border-border bg-bg p-3">
      <ul className="space-y-2 text-sm">
        {rows.map(([label, value, hint]) => (
          <li key={label} className="flex items-start justify-between gap-3">
            <span>
              <span className="block">{label}</span>
              <span className="text-xs text-muted">{hint}</span>
            </span>
            <span className="tabular-nums">{value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-end justify-between border-t border-line pt-3" aria-live="polite">
        <span className="text-sm font-medium">Perkiraan total</span>
        <span className="font-display text-2xl leading-none tabular-nums">{idr(q.total)}</span>
      </div>
    </div>
  );
}

export function StatusRail({ status }: { status: OrderStatus }) {
  if (status === "ditolak") {
    return (
      <p className="rounded-xl bg-bg px-3 py-2 text-sm text-accent">
        Ditolak — slot dikembalikan ke trip.
      </p>
    );
  }
  const index = FLOW.findIndex((s) => s.id === status);
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {FLOW.map((step, i) => {
        const state = i < index ? "done" : i === index ? "now" : "wait";
        return (
          <li key={step.id} className="min-w-0">
            <span
              className={cx(
                "mb-1 block h-1 rounded-full transition-colors duration-200",
                state === "wait" ? "bg-line" : "bg-primary",
              )}
            />
            <span className={cx("block truncate text-xs", state === "now" ? "font-medium text-fg" : "text-muted")}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderCard({ order, trip, children }: { order: Order; trip?: Trip; children?: ReactNode }) {
  const meta = statusMeta(order.status);
  const q = trip ? quote(trip, order.qty, order.unitPrice) : null;
  const market = trip ? marketById(trip.marketId) : null;
  return (
    <article className="rounded-3xl border border-border bg-surface p-4 shadow-ticket">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted tabular-nums">{order.code}</p>
          <h3 className="mt-0.5 text-xl leading-tight">{order.item}</h3>
          <p className="text-sm text-muted">
            {order.store}
            {market ? ` · ${market.city}` : ""} · {order.qty} pcs
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-bg px-2.5 py-1 text-xs font-medium">{meta.label}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{meta.hint}</p>
      <div className="mt-3">
        <StatusRail status={order.status} />
      </div>
      {q ? (
        <p className="mt-3 text-sm">
          Perkiraan <span className="font-medium tabular-nums">{idr(q.total)}</span>
          <span className="text-muted"> · jasa {idr(q.fee)}</span>
        </p>
      ) : null}
      {order.note ? <p className="mt-2 text-sm text-muted">“{order.note}”</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}
