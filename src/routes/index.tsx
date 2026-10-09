import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, control, cx } from "@/components/titip/ui";
import { computeTrip, DIR_META, type Dir, type Scenario, type TripLedger, type TripMode } from "@/lib/titip/calc";
import { useLedger } from "@/lib/titip/ledger-store";
import { idr, kg } from "@/lib/titip/model";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Titipin — Jakarta ↔ Turki" }] }),
  component: Desk,
});

function Desk() {
  const dir = useLedger((s) => s.dir);
  const mode = useLedger((s) => s.mode);
  const byDir = useLedger((s) => s.byDir);
  const scenario = byDir[dir];
  const setDir = useLedger((s) => s.setDir);
  const setMode = useLedger((s) => s.setMode);
  const patch = useLedger((s) => s.patch);
  const patchDir = useLedger((s) => s.patchDir);
  const setGood = useLedger((s) => s.setGood);
  const addGood = useLedger((s) => s.addGood);
  const removeGood = useLedger((s) => s.removeGood);
  const setOpex = useLedger((s) => s.setOpex);
  const setCapex = useLedger((s) => s.setCapex);
  const resetDir = useLedger((s) => s.resetDir);
  const meta = DIR_META[dir];
  const other: Dir = dir === "cgk-ist" ? "ist-cgk" : "cgk-ist";
  const ledger = computeTrip(mode, dir, byDir);
  const [draftName, setDraftName] = useState("");
  const [draftKg, setDraftKg] = useState("0,5");
  const [draftBeli, setDraftBeli] = useState("");

  function addDraft() {
    const name = draftName.trim();
    const kgEach = Number(draftKg.replace(",", "."));
    const beli = Number(draftBeli.replace(/\./g, "")) || 0;
    if (name.length < 2 || !(kgEach > 0)) return;
    addGood({ id: `g${Date.now().toString(36)}`, name, kg: kgEach, qty: 1, beli });
    setDraftName("");
    setDraftBeli("");
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="order-2 space-y-4 lg:order-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl leading-tight sm:text-4xl">{meta.from} → {meta.to}</h1>
            <p className="text-sm text-muted">
              {mode === "pp"
                ? "Pulang-pergi. Tiket dan opex kedua kaki dijumlahkan. Capex tetap sekali."
                : `${meta.blurb} Hanya tiket dan opex arah ini.`}
            </p>
            <p className="mt-1 text-xs text-muted">Data uji tersimpan di local storage browser ini.</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap rounded-full border border-border bg-surface p-1" role="group" aria-label="Arah rute">
              <Seg pressed={dir === "cgk-ist"} onClick={() => setDir("cgk-ist")}>
                Jakarta → Turki
              </Seg>
              <Seg pressed={dir === "ist-cgk"} onClick={() => setDir("ist-cgk")}>
                Turki → Jakarta
              </Seg>
            </div>
            <div className="flex flex-wrap rounded-full border border-border bg-surface p-1" role="group" aria-label="Jenis trip">
              <Seg pressed={mode === "one"} onClick={() => setMode("one")}>
                Pergi saja
              </Seg>
              <Seg pressed={mode === "pp"} onClick={() => setMode("pp")}>
                PP
              </Seg>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-border bg-surface p-4">
          <h2 className="text-2xl">Kuota bagasi</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Slider
              label="Koper check-in"
              value={scenario.bags}
              min={0}
              max={3}
              step={1}
              shown={`${scenario.bags} koper`}
              onChange={(bags) => patch({ bags })}
            />
            <Slider
              label="Kg per koper"
              value={scenario.kgPerBag}
              min={10}
              max={40}
              step={1}
              shown={kg(scenario.kgPerBag)}
              onChange={(kgPerBag) => patch({ kgPerBag })}
            />
            <Slider
              label="Kabin"
              value={scenario.cabin}
              min={0}
              max={12}
              step={1}
              shown={kg(scenario.cabin)}
              onChange={(cabin) => patch({ cabin })}
            />
            <Slider
              label="Tara koper & pribadi"
              value={scenario.tare}
              min={0}
              max={12}
              step={0.1}
              shown={kg(scenario.tare)}
              onChange={(tare) => patch({ tare })}
            />
            <Slider
              label="Denda kelebihan / kg"
              value={scenario.overPerKg}
              min={0}
              max={800000}
              step={10000}
              shown={idr(scenario.overPerKg)}
              onChange={(overPerKg) => patch({ overPerKg })}
            />
            <Slider
              label="Uji muat 1 pcs"
              value={scenario.ujiKg}
              min={0.1}
              max={3}
              step={0.1}
              shown={kg(scenario.ujiKg)}
              onChange={(ujiKg) => patch({ ujiKg })}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-2xl">Muatan</h2>
            <p className="text-sm text-muted tabular-nums">{kg(ledger.terpakai)} terpakai</p>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {scenario.goods.map((g) => (
              <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="text-xs text-muted tabular-nums">
                    {kg(g.kg)} × {g.qty} = {kg(g.kg * g.qty)}
                    {" · "}
                    beli {meta.shop === "TRY" ? `₺${g.beli}` : idr(g.beli)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <IconBtn label="Kurangi" onClick={() => setGood(g.id, { qty: Math.max(0, g.qty - 1) })}>
                    −
                  </IconBtn>
                  <span className="w-6 text-center text-sm tabular-nums">{g.qty}</span>
                  <IconBtn label="Tambah" onClick={() => setGood(g.id, { qty: g.qty + 1 })}>
                    +
                  </IconBtn>
                  <button type="button" className="min-h-11 px-2 text-sm text-muted" onClick={() => removeGood(g.id)}>
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              addDraft();
            }}
          >
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Barang baru"
              className={control}
              aria-label="Nama barang"
              suppressHydrationWarning
            />
            <input
              value={draftKg}
              onChange={(e) => setDraftKg(e.target.value)}
              inputMode="decimal"
              className={control}
              aria-label="Kg per pcs"
              suppressHydrationWarning
            />
            <input
              value={draftBeli}
              onChange={(e) => setDraftBeli(e.target.value)}
              inputMode="numeric"
              placeholder={meta.shop === "TRY" ? "₺" : "Rp"}
              className={control}
              aria-label="Harga beli"
              suppressHydrationWarning
            />
            <Button type="submit">Tambah</Button>
          </form>
        </section>

        <section className="rounded-3xl border border-border bg-surface p-4">
          <h2 className="text-2xl">{mode === "pp" ? "Opex kaki ini" : "Opex trip ini"}</h2>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {mode === "pp"
              ? `Tiket total ${idr(ledger.tiketTotal)} · kaki ini ${idr(ledger.tiket)} + lawan ${idr(ledger.tiketLawan)}`
              : `Tiket ${idr(ledger.tiket)}`}
          </p>
          <ul className="mt-3 space-y-2">
            {scenario.opex.map((line) => (
              <MoneyRow key={line.id} label={line.label} value={line.amount} onChange={(amount) => setOpex(line.id, amount)} />
            ))}
          </ul>
          {dir === "ist-cgk" || mode === "pp" ? (
            <label className="mt-4 block text-sm">
              <span className="mb-1 flex justify-between">
                <span className="font-medium">Kurs 1 TRY</span>
                <span className="tabular-nums">{idr(byDir["ist-cgk"].kursTry)}</span>
              </span>
              <input
                type="range"
                min={200}
                max={900}
                step={10}
                value={byDir["ist-cgk"].kursTry}
                onChange={(e) => patchDir("ist-cgk", { kursTry: Number(e.target.value) })}
                className="w-full"
                suppressHydrationWarning
              />
            </label>
          ) : null}
        </section>

        <section className="rounded-3xl border border-border bg-surface p-4">
          <h2 className="text-2xl">Capex, dibagi per trip</h2>
          {mode === "pp" ? <p className="mt-1 text-sm text-muted">Pulang-pergi tetap dihitung 1 trip.</p> : null}
          <ul className="mt-3 space-y-3">
            {scenario.capex.map((line) => (
              <li key={line.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_6rem] sm:items-end">
                <p className="text-sm font-medium">
                  {line.label}
                  <span className="mt-0.5 block text-xs font-normal text-muted tabular-nums">
                    {idr(Math.round(line.price / Math.max(1, line.trips)))} / trip
                  </span>
                </p>
                <FieldNum label="Harga alat" value={line.price} onChange={(price) => setCapex(line.id, { price })} />
                <FieldNum label="Umur trip" value={line.trips} onChange={(trips) => setCapex(line.id, { trips: Math.max(1, trips) })} />
              </li>
            ))}
          </ul>
          <button type="button" className="mt-4 text-sm text-muted" onClick={resetDir}>
            Reset arah ini
          </button>
        </section>
      </div>

      <aside className="order-1 lg:sticky lg:top-20 lg:order-2">
        <Sidebar scenario={scenario} dir={dir} mode={mode} otherLabel={ticketLabel(byDir[other])} ledger={ledger} onPatch={patch} />
      </aside>
    </div>
  );
}

function ticketLabel(s: Scenario): string {
  return s.opex.find((line) => line.id === "tiket")?.label ?? "Tiket lawan";
}

function Sidebar({
  scenario,
  dir,
  mode,
  otherLabel,
  ledger,
  onPatch,
}: {
  scenario: Scenario;
  dir: Dir;
  mode: TripMode;
  otherLabel: string;
  ledger: TripLedger;
  onPatch: (partial: Partial<Scenario>) => void;
}) {
  const meta = DIR_META[dir];
  const n = ledger;
  const over = n.sisa < 0;
  const tiketHere = scenario.opex.find((line) => line.id === "tiket")?.label ?? "Tiket";
  return (
    <div className="rounded-3xl border border-border bg-surface p-4 shadow-ticket">
      <p className="text-xs font-medium text-primary">
        {mode === "pp" ? "PP" : "Pergi saja"} · {meta.code}
      </p>
      <p className={cx("mt-2 font-display text-4xl leading-none tabular-nums", over ? "text-accent" : "text-fg")}>
        {over ? `−${kg(n.overKg)}` : kg(Math.max(0, n.sisa))}
      </p>
      <p className="mt-1 text-sm text-muted">{over ? "kelebihan bagasi" : "sisa kuota bersih"}</p>
      <div className="meter mt-3" aria-hidden="true">
        <span
          style={{
            width: `${Math.round(n.penuh * 100)}%`,
            background: over ? "var(--color-accent)" : undefined,
          }}
        />
      </div>
      <p className="mt-1 text-xs text-muted tabular-nums">
        {kg(n.terpakai)} / {kg(n.bersih)} bersih · kotor {kg(n.kotor)}
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        <Row k="Muat lagi" v={`${n.pcsUji} pcs`} hint={`pcs ${kg(scenario.ujiKg)}`} />
        <Row k="Harga jual / kg" v={idr(scenario.hargaPerKg)} />
        <Row k="Modal / kg" v={idr(n.modalPerKg)} hint={mode === "pp" ? "beban trip / kuota dua kaki" : "opex + capex / kuota"} />
        <Row k="Saran jual / kg" v={idr(n.saranPerKg)} hint={`margin ${scenario.margin}%`} />
      </dl>

      <label className="mt-4 block text-sm">
        <span className="mb-1 flex justify-between font-medium">
          <span>Harga per kg</span>
          <span className="tabular-nums">{idr(scenario.hargaPerKg)}</span>
        </span>
        <input
          type="range"
          min={50000}
          max={2000000}
          step={10000}
          value={scenario.hargaPerKg}
          onChange={(e) => onPatch({ hargaPerKg: Number(e.target.value) })}
          className="w-full"
          suppressHydrationWarning
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="mb-1 flex justify-between">
          <span>Target margin</span>
          <span className="tabular-nums">{scenario.margin}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={120}
          step={5}
          value={scenario.margin}
          onChange={(e) => onPatch({ margin: Number(e.target.value) })}
          className="w-full"
          suppressHydrationWarning
        />
      </label>
      <Button className="mt-3 w-full" variant="line" onClick={() => onPatch({ hargaPerKg: n.saranPerKg })}>
        Pakai harga saran
      </Button>

      <h3 className="mt-5 text-lg">Opex & capex</h3>
      <dl className="mt-2 space-y-2 text-sm">
        <Row k={tiketHere} v={idr(n.tiket)} />
        {mode === "pp" ? <Row k={otherLabel} v={idr(n.tiketLawan)} /> : null}
        <Row k="Tiket total" v={idr(n.tiketTotal)} hint={mode === "pp" ? "pergi + pulang" : "pergi saja"} />
        <Row k="Opex lain" v={idr(n.opexLain)} hint={mode === "pp" ? "dua kaki, tanpa tiket" : "tanpa tiket"} />
        <Row k="Denda" v={idr(n.denda)} hint={mode === "pp" ? "dua kaki" : n.overKg > 0 ? kg(n.overKg) : "tidak lewat"} />
        <Row k="Capex / trip" v={idr(n.capexTrip)} hint={mode === "pp" ? "sekali, bukan dua kali" : undefined} />
        <Row k="Beban terbang" v={idr(n.beban)} />
        <Row k="Modal barang" v={idr(n.nilaiBeliIdr)} hint={mode === "pp" ? "dua kaki" : meta.shop === "TRY" ? "TRY × kurs" : "harga beli"} />
      </dl>

      <div className="mt-4 rounded-2xl bg-bg p-3">
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm">{mode === "pp" ? "Laba trip" : "Laba bawa"}</span>
          <span className={cx("font-display text-3xl leading-none tabular-nums", n.laba < 0 ? "text-accent" : "text-primary")}>
            {idr(n.laba)}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">
          {idr(n.pendapatan)} jasa{mode === "pp" ? " dua kaki" : ""} − {idr(n.beban)} beban. Impas di {kg(n.breakEvenKg)}. Sisa kuota kaki ini masih senilai {idr(n.potensi)}.
        </p>
      </div>
    </div>
  );
}

function Row({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">
        {k}
        {hint ? <span className="mt-0.5 block text-xs">{hint}</span> : null}
      </dt>
      <dd className="shrink-0 tabular-nums">{v}</dd>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  shown,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shown: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{shown}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(step < 1 ? Math.round(n * 10) / 10 : n);
        }}
        className="w-full"
        suppressHydrationWarning
      />
    </label>
  );
}

function FieldNum({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cx(control, "mt-1")}
        suppressHydrationWarning
      />
    </label>
  );
}

function MoneyRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        value={value}
        min={0}
        step={50000}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cx(control, "w-36 tabular-nums")}
        aria-label={label}
        suppressHydrationWarning
      />
    </li>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full border border-border text-lg"
    >
      {children}
    </button>
  );
}

function Seg({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "min-h-11 rounded-full px-3 text-sm font-medium",
        pressed ? "bg-primary text-primary-fg" : "text-muted",
      )}
    >
      {children}
    </button>
  );
}
