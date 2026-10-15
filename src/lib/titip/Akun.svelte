<script lang="ts">
  import { onMount } from "svelte";
  import { roleLabel } from "./roles";
  import { homeFor } from "./roles";
  import { loadMe, session } from "./session.svelte";

  let leaving = $state(false);
  let notice = $state("");

  onMount(() => {
    void loadMe();
  });

  const initial = $derived((session.user?.name || session.user?.email || "?").slice(0, 1).toUpperCase());
  const home = $derived(session.role ? homeFor(session.role) : "/masuk");

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

<div class="flex min-h-11 items-center">
  {#if session.pending}
    <p class="text-small text-muted" role="status">Memeriksa akun…</p>
  {:else if session.user}
    <div class="flex flex-wrap items-center gap-2">
      <a href={home} class="flex min-h-11 max-w-[14rem] items-center gap-2 rounded pr-3 pl-1 hover:bg-field">
        <span class="grid size-9 shrink-0 place-items-center rounded bg-bg text-body">{initial}</span>
        <span class="min-w-0 leading-tight">
          <span class="block truncate text-body">{session.user.name || session.user.email}</span>
          <span class="block truncate text-small text-muted">{roleLabel(session.role)}</span>
        </span>
      </a>
      <button type="button" class="link text-small" disabled={leaving} onclick={keluar}>
        {leaving ? "Keluar…" : "Keluar"}
      </button>
    </div>
  {:else}
    <a href="/masuk" class="btn w-full px-4 text-small">Masuk</a>
  {/if}
</div>
{#if notice}
  <p class="mt-1 text-small text-accent" role="status">{notice}</p>
{/if}
