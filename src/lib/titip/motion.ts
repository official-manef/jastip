/**
 * Motion layer, one place. The static page is finished without it; this only
 * adds entrances (SKILL.md step 9) and keeps the crossfade from running while
 * the tab is hidden. Everything animates transform/opacity only.
 */

/** Reveal `[data-reveal]` elements once, as they enter the viewport. */
export function initReveal(): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
  );
  const observe = () => {
    for (const el of document.querySelectorAll("[data-reveal]:not(.is-in)")) io.observe(el);
  };
  observe();
  // New sections can appear (route changes); re-scan a couple of times.
  const timers = [200, 700].map((ms) => window.setTimeout(observe, ms));
  return () => {
    io.disconnect();
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
