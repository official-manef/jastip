/**
 * Motion layer, one place. The static page is finished without it; this only
 * adds entrances (SKILL.md step 9) and keeps the crossfade from running while
 * the tab is hidden. Everything animates transform/opacity only.
 *
 * F03: konten yang muncul belakangan (data async: titipan, jawaban AI, tab
 * portal) harus ikut ter-reveal. MutationObserver menangkap node baru, dan
 * fallback memastikan tak ada yang tertinggal transparan.
 */

/** Reveal `[data-reveal]` elements once, as they enter the viewport. */
export function initReveal(): () => void {
  const reveal = (el: Element) => el.classList.add("is-in");
  const all = () => document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)");

  // Tanpa IntersectionObserver: konten harus tetap terlihat (jangan pernah
  // meninggalkan opacity:0). Langsung tampilkan.
  if (typeof IntersectionObserver === "undefined") {
    for (const el of all()) reveal(el);
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    // F01: area konten app kini scroll container sendiri, bukan viewport.
    { root: document.getElementById("konten-app"), rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
  );

  const observe = () => {
    for (const el of all()) io.observe(el);
  };
  observe();

  // Konten baru (route berubah / data datang) langsung diobservasi.
  const mo = new MutationObserver(() => observe());
  mo.observe(document.body, { childList: true, subtree: true });

  /**
   * Jaring pengaman: apa pun yang atapnya sudah melewati garis bawah viewport
   * (`top < vh*0.98`) dipaksa terlihat. Termasuk elemen yang sudah terlewat di
   * atas (top negatif / bottom ≤ 0) — kasus lompat ke dasar halaman (End), di
   * mana IntersectionObserver tidak pernah melaporkan `isIntersecting` untuk
   * elemen yang dilewati. Elemen yang masih di bawah fold (top > vh) dibiarkan
   * menunggu scroll.
   */
  const forceVisible = () => {
    const vh = window.innerHeight || 0;
    for (const el of all()) {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.98) reveal(el);
    }
  };

  // Ikut scroll: lompat cepat (End/Home, anchor, restore) tak boleh meninggalkan
  // konten transparan. rAF-throttled supaya tidak membebani.
  const scroller = document.getElementById("konten-app");
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => { raf = 0; forceVisible(); });
  };
  (scroller ?? window).addEventListener("scroll", onScroll, { passive: true });

  const timers = [600, 1600, 3000].map((ms) => window.setTimeout(() => { observe(); forceVisible(); }, ms));
  forceVisible();

  return () => {
    io.disconnect();
    mo.disconnect();
    (scroller ?? window).removeEventListener("scroll", onScroll);
    if (raf) window.cancelAnimationFrame(raf);
    for (const t of timers) window.clearTimeout(t);
  };
}

/** Pause CSS animations (the crossfade) while the tab is hidden. */
export function initLoopPause(): () => void {
  const apply = () => {
    const state = document.hidden ? "paused" : "running";
    for (const el of document.querySelectorAll<HTMLElement>(".crossfade > *")) {
      el.style.animationPlayState = state;
    }
  };
  apply();
  document.addEventListener("visibilitychange", apply);
  return () => document.removeEventListener("visibilitychange", apply);
}
