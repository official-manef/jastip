<script lang="ts">
  import { onMount } from "svelte";
  import { homeFor, isRole, ROLES, roleLabel, type Role } from "../../lib/titip/roles";
  import { authedFetch, loadMe, PENDING_ROLE_KEY, session } from "../../lib/titip/session.svelte";

  let chosen = $state<Role | null>(null);
  let busy = $state(false);
  let notice = $state("");
  let signInFn = $state<((providerId: string, opts: { callbackURL?: string }) => Promise<void>) | null>(null);

  onMount(() => {
    void loadMe();
    void import("../../lib/auth/client").then((mod) => {
      signInFn = mod.signIn;
    });
  });

  function pesan(error: unknown): string {
    const text = error instanceof Error ? error.message : "";
    if (/pop-?up/i.test(text)) return "Izinkan pop-up untuk masuk.";
    if (/cancel/i.test(text)) return "Masuk dibatalkan.";
    return "Masuk gagal. Coba lagi.";
  }

  async function pakai() {
    if (!chosen || busy) return;
    busy = true;
    notice = "";
    try {
      const res = await authedFetch("/api/peran", {
        method: "POST",
        body: JSON.stringify({ role: chosen }),
      });
      const data = (await res.json()) as { role?: unknown; error?: string };
      if (data.error === "admin-taken") {
        notice = "Peran admin sudah diambil. Pilih klien atau jastiper.";
        busy = false;
        return;
      }
      if (!res.ok || !isRole(data.role)) {
        notice = "Peran belum tersimpan. Coba lagi.";
        busy = false;
        return;
      }
      window.location.assign(homeFor(data.role));
    } catch {
      notice = "Peran belum tersimpan. Coba lagi.";
      busy = false;
    }
  }

  function lanjut(providerId: string) {
    if (!chosen || !signInFn || busy) return;
    busy = true;
    notice = "";
    sessionStorage.setItem(PENDING_ROLE_KEY, chosen);
    void signInFn(providerId, { callbackURL: "/masuk/selesai" }).catch((error: unknown) => {
      busy = false;
      notice = pesan(error);
    });
  }
</script>

<section class="mx-auto max-w-lg">
  {#if session.pending}
    <div class="space-y-3" aria-hidden="true">
      <div class="h-9 w-48 animate-pulse rounded-lg bg-line"></div>
      <div class="h-24 animate-pulse rounded-2xl bg-line"></div>
      <div class="h-24 animate-pulse rounded-2xl bg-line"></div>
      <div class="h-24 animate-pulse rounded-2xl bg-line"></div>
    </div>
    <p class="sr-only">Memeriksa akun</p>
  {:else if session.user && session.role}
    <p class="text-sm font-medium tracking-wide text-primary uppercase">Akun</p>
    <h1 class="mt-1 font-display text-4xl italic">Sudah masuk</h1>
    <p class="mt-3 text-muted">
      {session.user.name || session.user.email} · peran {roleLabel(session.role)}.
    </p>
    <a href={homeFor(session.role)} class="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg">
      Lanjut
    </a>
  {:else}
    <p class="text-sm font-medium tracking-wide text-primary uppercase">CGK ↔ IST</p>
    <h1 class="mt-1 font-display text-4xl italic">{session.user ? "Pilih peran" : "Masuk ke titipin"}</h1>
    <p class="mt-3 text-muted">
      {#if session.user}
        Kamu sudah masuk sebagai {session.user.name || session.user.email}. Pilih peran sekali. Admin hanya untuk pengembang, dan hanya satu.
      {:else}
        Pilih peran, lalu masuk dengan Google atau X. Meja hitung tetap bisa dibuka tanpa akun.
      {/if}
    </p>

    <div class="mt-6 grid gap-3">
      {#each ROLES as item (item.id)}
        <button
          type="button"
          class="rounded-2xl border px-4 py-3 text-left shadow-ticket {chosen === item.id ? 'border-primary bg-surface' : 'border-border bg-surface'}"
          aria-pressed={chosen === item.id}
          onclick={() => (chosen = item.id)}
        >
          <span class="block font-display text-2xl italic">{item.label}</span>
          <span class="mt-1 block text-sm text-muted">{item.blurb}</span>
        </button>
      {/each}
    </div>

    {#if notice}
      <p class="mt-4 text-sm text-accent" role="status">{notice}</p>
    {/if}

    {#if session.user}
      <button type="button" class="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg disabled:opacity-50" disabled={!chosen || busy} onclick={pakai}>
        {busy ? "Menyimpan…" : "Pakai peran ini"}
      </button>
    {:else}
      <div class="mt-6 grid gap-2">
        <button type="button" class="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg disabled:opacity-50" disabled={!chosen || !signInFn || busy} onclick={() => lanjut("grok-google")}>
          Lanjut dengan Google
        </button>
        <button type="button" class="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-medium disabled:opacity-50" disabled={!chosen || !signInFn || busy} onclick={() => lanjut("grok-x")}>
          Lanjut dengan X
        </button>
      </div>
      {#if !chosen}
        <p class="mt-3 text-sm text-muted">Pilih peran dulu, baru lanjut.</p>
      {/if}
    {/if}
  {/if}
</section>
