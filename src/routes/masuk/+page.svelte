<script lang="ts">
  import { onMount } from "svelte";
  import { homeFor, isRole, ROLES, roleLabel, type Role } from "../../lib/titip/roles";
  import { authedFetch, loadMe, PENDING_ROLE_KEY, session } from "../../lib/titip/session.svelte";

  let chosen = $state<Role | null>(null);
  let busy = $state(false);
  let notice = $state("");
  let registering = $state(false);
  let name = $state("");
  let email = $state("");
  let password = $state("");
  const control = "min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none focus:border-primary";

  onMount(() => {
    void loadMe();
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

  async function lanjut(event: SubmitEvent) {
    event.preventDefault();
    if (!chosen || busy) return;
    busy = true;
    notice = "";
    try {
      const response = await fetch(`/api/auth/${registering ? "sign-up" : "sign-in"}/email`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, ...(registering ? { name: name.trim() } : {}) }),
      });
      if (!response.ok) {
        notice = registering
          ? "Akun belum dibuat. Periksa isian atau masuk jika email sudah terdaftar."
          : "Email atau password tidak sesuai. Coba lagi.";
        return;
      }
      password = "";
      sessionStorage.removeItem("grok-auth.bearer-token");
      sessionStorage.setItem(PENDING_ROLE_KEY, chosen);
      window.location.assign("/masuk/selesai");
    } catch (error) {
      notice = pesan(error);
    } finally {
      busy = false;
    }
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
        Pilih peran, lalu masuk dengan email dan password. Meja hitung tetap bisa dibuka tanpa akun.
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
      <form class="mt-6 grid gap-4" onsubmit={lanjut}>
        {#if registering}
          <label class="grid gap-1 text-sm">Nama
            <input class={control} bind:value={name} autocomplete="name" required maxlength="80" />
          </label>
        {/if}
        <label class="grid gap-1 text-sm">Email
          <input class={control} type="email" bind:value={email} autocomplete="email" required maxlength="254" />
        </label>
        <label class="grid gap-1 text-sm">Password
          <input class={control} type="password" bind:value={password} autocomplete={registering ? "new-password" : "current-password"} required minlength={registering ? 12 : 1} maxlength="128" />
        </label>
        {#if registering}<p class="text-xs text-muted">Gunakan minimal 12 karakter.</p>{/if}
        <button type="submit" class="min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-fg disabled:opacity-50" disabled={!chosen || busy}>
          {busy ? "Memproses…" : registering ? "Buat akun" : "Masuk"}
        </button>
        <button type="button" class="min-h-11 rounded-full border border-border px-5 text-sm" disabled={busy} onclick={() => { registering = !registering; password = ""; notice = ""; }}>
          {registering ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
        </button>
      </form>
      {#if !chosen}
        <p class="mt-3 text-sm text-muted">Pilih peran dulu, baru lanjut.</p>
      {/if}
    {/if}
  {/if}
</section>
