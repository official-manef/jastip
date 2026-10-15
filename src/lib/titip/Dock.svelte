<script lang="ts">
  /**
   * Mobile bar + full-height drawer. Under `lg` only; the desktop rail
   * (`Sidebar.svelte`) is the other half of the same nav list.
   */
  import { page } from "$app/state";
  import Akun from "./Akun.svelte";
  import { isActive, navFor } from "./nav";
  import { session } from "./session.svelte";

  const items = $derived(navFor(session.role));
  const here = $derived(page.url.pathname);
  const active = $derived(items.find((item) => isActive(item.href, here)));

  let open = $state(false);

  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape" && open) open = false;
  }
</script>

<svelte:window onkeydown={onKey} />

<nav
  class="sticky top-0 z-40 flex items-center justify-between gap-3 bg-bg px-4 py-3 lg:hidden"
  aria-label="Navigasi"
>
  <a href="/meja" class="font-display text-xl font-medium leading-none tracking-tight">titipin</a>
  <div class="flex items-center gap-2">
    {#if active}
      <span class="rounded bg-surface px-3 py-1.5 text-small text-fg">{active.label}</span>
    {/if}
    <button
      type="button"
      onclick={() => (open = !open)}
      aria-expanded={open}
      aria-haspopup="dialog"
      class="btn-quiet min-h-10 px-3 text-small"
    >
      Menu
    </button>
  </div>
</nav>

{#if open}
  <div class="fixed inset-0 z-40 bg-fg/40 lg:hidden" role="presentation" onclick={() => (open = false)}
  ></div>
  <div
    class="fixed inset-y-0 right-0 z-50 flex w-[min(20rem,86vw)] flex-col bg-bg px-4 py-5 lg:hidden"
    role="dialog"
    aria-label="Menu"
    aria-modal="true"
  >
    <div class="mb-4 flex items-center justify-between">
      <span class="font-display text-xl font-medium leading-none tracking-tight">titipin</span>
      <button type="button" class="btn-quiet min-h-10 px-3 text-small" onclick={() => (open = false)}>Tutup</button>
    </div>

    <nav class="flex flex-1 flex-col gap-0.5">
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
          {item.label}
        </a>
      {/each}
    </nav>

    <div class="mt-4">
      <Akun />
    </div>
  </div>
{/if}
