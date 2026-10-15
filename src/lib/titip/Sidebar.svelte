<script lang="ts">
  /** Desktop rail: wordmark, nav, account. Separated by a tone step, no rule. */
  import { page } from "$app/state";
  import Akun from "./Akun.svelte";
  import { isActive, navFor } from "./nav";
  import { session } from "./session.svelte";

  const items = $derived(navFor(session.role));
  const here = $derived(page.url.pathname);
</script>

<aside
  class="sticky top-0 hidden min-h-dvh w-60 shrink-0 flex-col bg-surface px-3 py-5 lg:flex"
  aria-label="Navigasi utama"
>
  <a href="/meja" class="mb-6 flex items-baseline gap-2 px-2" aria-label="titipin, meja hitung">
    <span class="font-display text-xl font-medium leading-none tracking-tight">titipin</span>
    <span class="text-small text-muted">CGK ↔ IST</span>
  </a>

  <nav class="flex flex-1 flex-col gap-0.5">
    {#each items as item (item.href)}
      <a
        href={item.href}
        aria-current={isActive(item.href, here) ? "page" : undefined}
        class="flex min-h-11 items-center gap-3 rounded px-3 text-body {isActive(item.href, here)
          ? 'bg-primary text-primary-fg'
          : 'text-fg hover:bg-field'}"
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
</aside>
