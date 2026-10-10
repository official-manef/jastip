<script lang="ts">
  import { onMount } from "svelte";
  import { hasGateSessionMarker } from "../auth/gate-session-marker";
  import { roleLabel } from "./roles";
  import { loadMe, session } from "./session.svelte";

  let gate = $state(false);
  let leaving = $state(false);
  let notice = $state("");

  onMount(() => {
    void (async () => {
      await loadMe();
      gate = hasGateSessionMarker();
    })();
  });

  const initial = $derived((session.user?.name || session.user?.email || "?").slice(0, 1).toUpperCase());

  async function keluar() {
    leaving = true;
    notice = "";
    try {
      const { signOut } = await import("../auth/client");
      await signOut("/masuk");
    } catch {
      leaving = false;
      notice = "Keluar gagal. Coba lagi.";
    }
  }
</script>

<div class="flex min-h-11 items-center justify-end">
  {#if session.pending}
    <div class="h-9 w-28 animate-pulse rounded-full bg-line" aria-hidden="true"></div>
    <span class="sr-only">Memeriksa akun</span>
  {:else if session.user}
    <div class="flex items-center gap-2">
      <a href={session.role ? (session.role === "klien" ? "/titip" : session.role === "admin" ? "/admin" : "/") : "/masuk"} class="flex min-h-11 max-w-[12rem] items-center gap-2 rounded-full border border-border bg-surface pr-3 pl-1">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-sm italic text-primary">{initial}</span>
        <span class="min-w-0 text-left leading-tight">
          <span class="block truncate text-sm font-medium">{session.user.name || session.user.email}</span>
          <span class="block truncate text-xs text-muted">{roleLabel(session.role)}</span>
        </span>
      </a>
      {#if !gate}
        <button type="button" class="min-h-11 rounded-full px-2 text-sm text-muted" disabled={leaving} onclick={keluar}>
          {leaving ? "Keluar…" : "Keluar"}
        </button>
      {/if}
    </div>
  {:else}
    <a href="/masuk" class="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg">Masuk</a>
  {/if}
</div>
{#if notice}
  <p class="mt-1 text-right text-xs text-accent" role="status">{notice}</p>
{/if}
