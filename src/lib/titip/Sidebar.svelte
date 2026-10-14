<script lang="ts">
  /** Desktop sidebar: brand, primary nav, account. Hidden under `lg`. */
  import { page } from "$app/state";
  import Akun from "./Akun.svelte";
  import { isActive, navFor } from "./nav";
  import { session } from "./session.svelte";

  const items = $derived(navFor(session.role));
  const here = $derived(page.url.pathname);
</script>

<aside
  class="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface/70 px-3 py-4 lg:flex"
  aria-label="Navigasi utama"
>
  <a href="/" class="mb-4 flex items-center gap-2 px-2">
    <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-lg italic leading-none text-primary-fg">t</span>
    <span class="truncate font-display text-2xl italic leading-none tracking-tight">titipin</span>
  </a>

  <nav class="flex flex-1 flex-col gap-1">
    {#each items as item (item.href)}
      <a
        href={item.href}
        aria-current={isActive(item.href, here) ? "page" : undefined}
        class="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium {isActive(item.href, here)
          ? 'bg-primary text-primary-fg'
          : 'text-muted hover:bg-bg hover:text-fg'}"
      >
        <svg viewBox="0 0 24 24" class="size-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d={item.icon} />
        </svg>
        <span class="min-w-0">
          <span class="block truncate">{item.label}</span>
          <span class="block truncate text-xs font-normal {isActive(item.href, here) ? 'text-primary-fg/70' : 'text-muted/80'}">{item.hint}</span>
        </span>
      </a>
    {/each}
  </nav>

  <div class="mt-3 border-t border-border pt-3">
    <Akun />
  </div>
</aside>
