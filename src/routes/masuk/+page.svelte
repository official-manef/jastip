<script lang="ts">
  import { onMount } from "svelte";
  import { homeFor, isRole, ROLES, roleLabel, type Role } from "../../lib/titip/roles";
  import Ringkas from "../../lib/titip/Ringkas.svelte";
  import { authedFetch, loadMe, PENDING_ROLE_KEY, session } from "../../lib/titip/session.svelte";

  let chosen = $state<Role | null>(null);
  let busy = $state(false);
  let notice = $state("");
  let registering = $state(false);
  let name = $state("");
  let email = $state("");
  let password = $state("");
  const field = "field";

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
      if (data.error === "admin-forbidden") {
        notice = "Akun ini belum ditetapkan sebagai admin.";
        busy = false;
        return;
      }
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
    if ((registering && !chosen) || busy || !session.databaseReady) return;
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
        notice = response.status === 503 ? "Penyimpanan akun belum tersedia. Meja hitung tetap bisa digunakan." : registering
          ? "Akun belum dibuat. Periksa isian atau masuk jika email sudah terdaftar."
          : "Email atau password tidak sesuai. Coba lagi.";
        return;
      }
      password = "";
      if (chosen) sessionStorage.setItem(PENDING_ROLE_KEY, chosen);
      else sessionStorage.removeItem(PENDING_ROLE_KEY);
      window.location.assign("/masuk/selesai");
    } catch (error) {
      notice = pesan(error);
    } finally {
      busy = false;
    }
  }
</script>

<section>
  {#if session.pending}
    <p class="text-body text-muted" role="status">Memeriksa akun…</p>
  {:else if session.user && session.role}
    <h1>Sudah masuk</h1>
    <p class="mt-4 text-lead">
      {session.user.name || session.user.email} · peran {roleLabel(session.role)}.
    </p>
    <a href={homeFor(session.role)} class="btn mt-6">Lanjut</a>
  {:else}
    <header data-rise style="--i: 0">
      <h1>{session.user ? "Pilih peran" : "Masuk ke titipin"}</h1>
      <p class="mt-4 text-lead">
        {#if session.user}
          Kamu sudah masuk sebagai {session.user.name || session.user.email}. Pilih peran sekali. Admin ditetapkan oleh operator.
        {:else}
          Masuk dengan email dan password. Untuk akun baru, pilih peran klien atau jastiper. Meja hitung tetap bisa dibuka tanpa akun.
        {/if}
      </p>
    </header>

    <div class="mt-6" data-reveal>
      <Ringkas compact />
    </div>

    {#if session.user}
      <div class="mt-8 flex flex-col gap-2">
        {#each ROLES.filter((item) => item.id !== "admin" || session.canClaimAdmin) as item (item.id)}
          <button
            type="button"
            class="rounded p-4 text-left transition-colors {chosen === item.id ? 'bg-primary text-primary-fg' : 'bg-surface hover:bg-field'}"
            aria-pressed={chosen === item.id}
            onclick={() => (chosen = item.id)}
          >
            <span class="block text-lead">{item.label}</span>
            <span class="mt-1 block text-small {chosen === item.id ? 'text-primary-fg/80' : 'text-muted'}">{item.blurb}</span>
          </button>
        {/each}
      </div>
      {#if notice}
        <p class="mt-4 text-body text-accent" role="status">{notice}</p>
      {/if}
      <button type="button" class="btn mt-6 w-full disabled:opacity-50" disabled={!chosen || busy} onclick={pakai}>
        {busy ? "Menyimpan…" : "Pakai peran ini"}
      </button>
    {:else}
      {#if notice}
        <p class="mt-4 text-body text-accent" role="status">{notice}</p>
      {/if}
      {#if !session.databaseReady}
        <p class="mt-4 text-body text-accent" role="status">
          Penyimpanan akun belum tersedia. Pendaftaran dan login belum aktif.
          <a href="/meja" class="link">Gunakan meja hitung</a> dengan penyimpanan di perangkat ini.
        </p>
      {/if}

      <div class="mt-8 flex flex-col gap-2">
        {#each ROLES.filter((item) => item.id !== "admin" || session.canClaimAdmin) as item (item.id)}
          <button
            type="button"
            class="rounded p-4 text-left transition-colors {chosen === item.id ? 'bg-primary text-primary-fg' : 'bg-surface hover:bg-field'}"
            aria-pressed={chosen === item.id}
            onclick={() => (chosen = item.id)}
          >
            <span class="block text-lead">{item.label}</span>
            <span class="mt-1 block text-small {chosen === item.id ? 'text-primary-fg/80' : 'text-muted'}">{item.blurb}</span>
          </button>
        {/each}
      </div>

      <form class="mt-6 flex flex-col gap-4" onsubmit={lanjut}>
        {#if registering}
          <label class="block">
            <span class="mb-2 block text-small text-muted">Nama</span>
            <input class={field} bind:value={name} autocomplete="name" required maxlength="80" />
          </label>
        {/if}
        <label class="block">
          <span class="mb-2 block text-small text-muted">Email</span>
          <input class={field} type="email" bind:value={email} autocomplete="email" required maxlength="254" />
        </label>
        <label class="block">
          <span class="mb-2 block text-small text-muted">Password</span>
          <input class={field} type="password" bind:value={password} autocomplete={registering ? "new-password" : "current-password"} required minlength={registering ? 12 : 1} maxlength="128" />
        </label>
        {#if registering}<p class="text-small text-muted">Gunakan minimal 12 karakter.</p>{/if}
        <button type="submit" class="btn disabled:opacity-50" disabled={(registering && !chosen) || busy || !session.databaseReady}>
          {busy ? "Memproses…" : registering ? "Buat akun" : "Masuk"}
        </button>
        <button type="button" class="btn-quiet" disabled={busy} onclick={() => { registering = !registering; password = ""; notice = ""; }}>
          {registering ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
        </button>
      </form>
      {#if registering && !chosen}
        <p class="mt-3 text-small text-muted">Pilih peran dulu, baru lanjut.</p>
      {/if}
    {/if}
  {/if}
</section>
