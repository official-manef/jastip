import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { seedUjiIfEmpty, useLedger } from "@/lib/titip/ledger-store";

export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    seedUjiIfEmpty();
    void useLedger.persist.rehydrate();
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-lg italic leading-none text-primary-fg">
              t
            </span>
            <span className="truncate font-display text-2xl italic leading-none tracking-tight">titipin</span>
          </Link>
          <p className="text-sm text-muted">Satu rute · Jakarta ↔ Turki</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-4 pb-10">{children}</main>
    </div>
  );
}
