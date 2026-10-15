<script lang="ts">
  /**
   * Mobile top bar + drawer. Under `lg` only. The bar is plain: wordmark left,
   * one Menu button right; the drawer lists nav entries as rows.
   */
  import { page } from "$app/state";
  import Akun from "./Akun.svelte";
  import { isActive, navFor } from "./nav";
  import { session } from "./session.svelte";

  const items = $derived(navFor(session.role));
  const here = $derived(page.url.pathname);

  let open = $state(false);

  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape" && open) open = false;
  }
</script>

<svelte:window onkeydown={onKey} />

<nav
  class="sticky top-0 z-40 flex items-center justify-between bg-bg px-4 py-3 lg:hidden"
  aria-label="Navigasi"
>
  <a href="/" class="font-display text-xl font-medium leading-none tracking-tight">titipin</a>
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-haspopup="dialog"
    class="btn-quiet min-h-9 px-3 text-small"
  >
    {open ? "Tutup" : "Menu"}
  </button>
</nav>

{#if open}
  <div class="fixed inset-0 z-40 bg-fg/40 lg:hidden" role="presentation" onclick={() => (open = false)}
  ></div>
  <div
    class="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-lg bg-bg px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
    role="dialog"
    aria-label="Menu"
    aria-modal="true"
  >
    <nav class="flex flex-col gap-0.5">
      {#each items as item (item.href)}
        <a
          href={item.href}
          onclick={() => (open = false)}
          aria-current={isActive(item.href, here) ? "page" : undefined}
          class="flex min-h-12 items-center gap-3 rounded px-3 text-body {isActive(item.href, here)
            ? 'bg-primary text-primary-fg'
            : 'text-fg hover:bg-surface'}"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-5 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d={item.icon} />
          </svg>
          {item.label} <span class="text-small text-muted">{item.hint}</span>
        </a>
      {/each}
    </nav>
    <div class="mt-4">
      <Akun />
    </div>
  </div>
{/if}
