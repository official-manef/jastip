<script lang="ts">
  /**
   * Dashboard per peran. Satu route, tiga bentuk:
   *
   * - Klien    : titipan saya + status + langganan.
   * - Jastiper : titipan masuk (antrean) + ringkasan trip + langganan.
   * - Admin    : jumlah orang/peran + titipan + ringkasan.
   *
   * Data asli dari Convex (`/api/*`), bukan contoh statis. Tanpa akun →
   * arahkan ke masuk.
   */
  import { onMount } from "svelte";
  import { idr, kg } from "../../lib/titip/model";
  import { arahLabel, statusLabel, type TitipanRow } from "../../lib/titip/titipan";
  import { roleLabel } from "../../lib/titip/roles";
  import { authedFetch, loadMe, session } from "../../lib/titip/session.svelte";
  import { desk, initDesk } from "../../lib/titip/trip-store.svelte";
  import { tripLintas } from "../../lib/titip/pricing";

  type Person = { id: string; name: string; email: string; role: "klien" | "jastiper" | "admin" | null };
  type Langganan = {
    aktif: { plan: string; harga: number; mulai: string | null; selesai: string | null; metode: string | null } | null;
    pending: { plan: string; harga: number; invoiceId: string } | null;
    harga: number;
  };

  let rows = $state<TitipanRow[]>([]);
  let people = $state<Person[]>([]);
  let langganan = $state<Langganan | null>(null);
  let loading = $state(true);
  let notice = $state("");
  let busy = $state(false);

  onMount(() => {
    void (async () => {
      await loadMe();
      if (!session.user || !session.role) { loading = false; return; }
      initDesk();
      await muat();
    })();
  });

  const lintas = $derived(tripLintas(desk.kaki.map((k) => ({
    id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario,
  }))));

  const milikku = $derived(rows);
  const antre = $derived(rows.filter((r) => r.status !== "selesai"));

  function tanggal(iso: string | null): string {
    if (!iso) return "—";
    const t = Date.parse(iso);
    return Number.isFinite(t) ? new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
  }

  async function muat() {
    loading = true;
    notice = "";
    try {
      const [t, l] = await Promise.all([
        authedFetch("/api/titipan").then((r) => (r.ok ? r.json() : { rows: [] })),
        authedFetch("/api/langganan").then((r) => (r.ok ? r.json() : null)),
      ]);
      rows = (t as { rows?: TitipanRow[] }).rows ?? [];
      langganan = l as Langganan | null;
      if (session.role === "admin") {
        const a = await authedFetch("/api/admin");
        if (a.ok) people = ((await a.json()) as { people?: Person[] }).people ?? [];
      }
    } catch {
      notice = "Sebagian data belum terbaca.";
    } finally {
      loading = false;
    }
  }

  async function berlangganan() {
    if (busy) return;
    busy = true;
    notice = "";
    try {
      const res = await authedFetch("/api/langganan", { method: "POST", body: JSON.stringify({ plan: "pro" }) });
      const data = (await res.json()) as { invoiceId?: string; error?: string };
      if (!res.ok) { notice = data.error === "masuk" ? "Masuk dulu." : "Invoice belum dibuat."; return; }
      notice = `Invoice ${data.invoiceId} dibuat. Pembayaran DOKU belum aktif — hubungi operator.`;
      await muat();
    } catch {
      notice = "Invoice belum dibuat.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Dashboard — Titipin</title></svelte:head>

<section>
  {#if session.pending || loading}
    <p class="text-body text-muted" role="status">Memuat dashboard…</p>
  {:else if !session.user}
    <h1>Dashboard</h1>
    <p class="mt-4 text-lead">Masuk untuk melihat dashboard-mu.</p>
    <a href="/masuk" class="btn mt-6">Masuk</a>
  {:else if !session.role}
    <h1>Dashboard</h1>
    <p class="mt-4 text-lead">Pilih peran dulu (klien atau jastiper).</p>
    <a href="/masuk" class="btn mt-6">Pilih peran</a>
  {:else}
    <header class="max-w-[40rem]" data-rise style="--i: 0">
      <h1>Dashboard {roleLabel(session.role)}</h1>
      <p class="mt-4 text-lead">
        {session.user.name || session.user.email} — ringkasan sesuai peranmu.
      </p>
    </header>

    {#if notice}<p class="mt-4 text-body text-accent" role="status">{notice}</p>{/if}

    <!-- Panel langganan: sama untuk semua peran. -->
    <div class="panel mt-6 p-5" data-reveal>
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <h2 class="text-lead">Langganan</h2>
        <span class="rounded bg-surface px-3 py-1.5 text-small">
          {langganan?.aktif ? "Pro aktif" : "Gratis"}
        </span>
      </div>
      {#if langganan?.aktif}
        <dl class="mt-3 grid gap-2 text-body sm:grid-cols-3">
          <div><dt class="text-small text-muted">Mulai</dt><dd class="num">{tanggal(langganan.aktif.mulai)}</dd></div>
          <div><dt class="text-small text-muted">Selesai</dt><dd class="num">{tanggal(langganan.aktif.selesai)}</dd></div>
          <div><dt class="text-small text-muted">Metode</dt><dd>{langganan.aktif.metode ?? "—"}</dd></div>
        </dl>
      {:else}
        <p class="mt-2 text-body text-muted">
          Paket Pro {idr(langganan?.harga ?? 99000)}/bulan: trip & riwayat tanpa batas, proyeksi target, ekspor.
        </p>
        {#if langganan?.pending}
          <p class="mt-2 text-small text-muted">Invoice {langganan.pending.invoiceId} menunggu pembayaran.</p>
        {/if}
        <button type="button" class="btn mt-3 disabled:opacity-50" disabled={busy} onclick={berlangganan}>
          {busy ? "Menyiapkan…" : "Langganan Pro"}
        </button>
        <p class="mt-2 text-small text-muted">Pembayaran lewat DOKU belum aktif; tombol menyiapkan invoice saja.</p>
      {/if}
    </div>

    {#if session.role === "klien"}
      <dl class="mt-6 grid gap-3 sm:grid-cols-3" data-reveal>
        <div class="panel p-4"><dt class="text-small text-muted">Titipan saya</dt><dd class="num mt-1 text-lead">{milikku.length}</dd></div>
        <div class="panel p-4"><dt class="text-small text-muted">Berat</dt><dd class="num mt-1 text-lead">{kg(milikku.reduce((s, r) => s + r.kg, 0))}</dd></div>
        <div class="panel p-4"><dt class="text-small text-muted">Masih jalan</dt><dd class="num mt-1 text-lead">{antre.length}</dd></div>
      </dl>
      <div class="mt-5 flex flex-wrap gap-3" data-reveal>
        <a class="btn" href="/titip">Kelola titipan</a>
        <a class="link text-body self-center" href="/meja">Buka kalkulator</a>
      </div>
    {:else if session.role === "jastiper"}
      <dl class="mt-6 grid gap-3 sm:grid-cols-3" data-reveal>
        <div class="panel p-4"><dt class="text-small text-muted">Titipan masuk</dt><dd class="num mt-1 text-lead">{rows.length}</dd></div>
        <div class="panel p-4"><dt class="text-small text-muted">Antrean</dt><dd class="num mt-1 text-lead">{antre.length}</dd></div>
        <div class="panel p-4"><dt class="text-small text-muted">Kapasitas trip</dt><dd class="num mt-1 text-lead">{kg(lintas.capacityKg)}</dd></div>
      </dl>
      <div class="mt-5 flex flex-wrap gap-3" data-reveal>
        <a class="btn" href="/meja">Atur trip</a>
        <a class="link text-body self-center" href="/titip">Semua titipan</a>
      </div>
    {:else}
      <dl class="mt-6 grid gap-3 sm:grid-cols-3" data-reveal>
        <div class="panel p-4"><dt class="text-small text-muted">Orang</dt><dd class="num mt-1 text-lead">{people.length}</dd></div>
        <div class="panel p-4"><dt class="text-small text-muted">Jastiper</dt><dd class="num mt-1 text-lead">{people.filter((p) => p.role === "jastiper").length}</dd></div>
        <div class="panel p-4"><dt class="text-small text-muted">Titipan</dt><dd class="num mt-1 text-lead">{rows.length}</dd></div>
      </dl>
      <div class="mt-5 flex flex-wrap gap-3" data-reveal>
        <a class="btn" href="/admin">Kelola peran</a>
        <a class="link text-body self-center" href="/meja">Buka kalkulator</a>
      </div>
    {/if}

    {#if rows.length}
      <div class="mt-8" data-reveal>
        <h2 class="text-lead">Titipan terbaru</h2>
        <ul class="mt-3 flex flex-col gap-2">
          {#each rows.slice(0, 5) as row (row.id)}
            <li class="panel flex flex-wrap items-baseline justify-between gap-2 p-4">
              <div>
                <p class="text-body">{row.nama}</p>
                <p class="text-small text-muted">{arahLabel(row.arah)}{session.role !== "klien" && row.pemilik ? ` · ${row.pemilik}` : ""}</p>
              </div>
              <p class="num text-small">{kg(row.kg)} · {statusLabel(row.status)}</p>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</section>
