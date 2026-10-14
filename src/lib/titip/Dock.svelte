<script lang="ts">
  /**
   * Mobile dock (bottom bar) + draggable drawer.
   *
   * - Under `lg` only: the sidebar is hidden, this is the whole nav.
   * - Dock shows the first few items; the RIGHTMOST button opens the drawer.
   * - The drawer is drag-handled: drag down to dismiss, up to expand.
   *   Menu entries render as thumbnails (icon tile + label + hint).
   */
  import { page } from "$app/state";
  import Akun from "./Akun.svelte";
  import { isActive, navFor } from "./nav";
  import { session } from "./session.svelte";

  const items = $derived(navFor(session.role));
  const here = $derived(page.url.pathname);
  // Primary items stay on the dock; the drawer always lists everything.
  const dockItems = $derived(items.slice(0, 3));

  let open = $state(false);
  let dragging = $state(false);
  /** 0 = fully open, 1 = dragged-down fraction of the drawer height. */
  let pull = $state(0);
  let startY = 0;
  let height = 0;
  let sheet: HTMLDivElement | null = $state(null);

  function openDrawer() {
    pull = 0;
    open = true;
  }

  function closeDrawer() {
    open = false;
    dragging = false;
    pull = 0;
  }

  function startDrag(event: PointerEvent) {
    if (!sheet) return;
    dragging = true;
    startY = event.clientY;
    height = sheet.getBoundingClientRect().height || 1;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    if (!dragging) return;
    const delta = event.clientY - startY;
    pull = Math.min(1, Math.max(0, delta / height));
  }

  function endDrag(event: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    // Past ~40% pulled down → dismiss; otherwise snap back open.
    if (pull > 0.4) closeDrawer();
    else pull = 0;
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape" && open) closeDrawer();
  }
</script>

<svelte:window onkeydown={onKey} />

<nav
  class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
  aria-label="Navigasi bawah"
>
  <div class="mx-auto flex max-w-2xl items-stretch">
    {#each dockItems as item (item.href)}
      <a
        href={item.href}
        aria-current={isActive(item.href, here) ? "page" : undefined}
        class="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium {isActive(item.href, here) ? 'text-primary' : 'text-muted'}"
      >
        <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d={item.icon} />
        </svg>
        {item.label}
      </a>
    {/each}
    <button
      type="button"
      onclick={() => (open ? closeDrawer() : openDrawer())}
      aria-expanded={open}
      aria-haspopup="dialog"
      class="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium {open ? 'text-primary' : 'text-muted'}"
    >
      <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
      Menu
    </button>
  </div>
</nav>

{#if open}
  <div
    class="fixed inset-0 z-40 bg-fg/40 lg:hidden"
    role="presentation"
    onclick={closeDrawer}
    style="opacity: {1 - pull * 0.6}"
  ></div>
  <div
    bind:this={sheet}
    class="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl border border-border bg-surface shadow-ticket lg:hidden"
    role="dialog"
    aria-label="Menu"
    aria-modal="true"
    style="transform: translateY({pull * 100}%); transition: {(dragging ? 'none' : 'transform 220ms cubic-bezier(0.2,0,0,1)')}"
  >
    <button
      type="button"
      class="flex w-full cursor-grab touch-none flex-col items-center gap-3 px-4 pt-3 pb-2 active:cursor-grabbing"
      onpointerdown={startDrag}
      onpointermove={moveDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      aria-label="Tarik untuk menutup"
    >
      <span class="h-1.5 w-10 rounded-full bg-line"></span>
    </button>

    <div class="px-4 pb-4">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {#each items as item (item.href)}
          <a
            href={item.href}
            onclick={closeDrawer}
            aria-current={isActive(item.href, here) ? "page" : undefined}
            class="flex flex-col gap-3 rounded-2xl border p-3 {isActive(item.href, here)
              ? 'border-primary bg-primary/5'
              : 'border-border bg-bg'}"
          >
            <span class="grid size-11 place-items-center rounded-xl {isActive(item.href, here) ? 'bg-primary text-primary-fg' : 'bg-surface text-primary'}">
              <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d={item.icon} />
              </svg>
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium">{item.label}</span>
              <span class="block truncate text-xs text-muted">{item.hint}</span>
            </span>
          </a>
        {/each}
      </div>
      <div class="mt-4 border-t border-border pt-3">
        <Akun />
      </div>
    </div>
  </div>
{/if}
