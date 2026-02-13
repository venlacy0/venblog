/* Home page interactions:
   - Hero parallax on scroll.
 */

/* ─── Hero 视差 ─── */
function initHeroParallax() {
  const heroInner = document.querySelector(".hero__inner");
  const hero = document.querySelector(".hero");
  if (!heroInner || !hero) return;

  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  if (reducedMotion) return;

  let rafId = 0;

  function update() {
    const scrollY = window.scrollY || window.pageYOffset;
    const heroH = hero.offsetHeight || 1;

    if (scrollY > heroH) {
      rafId = 0;
      return;
    }

    const ratio = scrollY / heroH;
    const ty = scrollY * 0.35;
    const scale = 1 - ratio * 0.06;
    const opacity = 1 - ratio * 1.2;

    heroInner.style.transform = `translate3d(0, ${ty}px, 0) scale(${scale})`;
    heroInner.style.opacity = String(Math.max(0, opacity));
    rafId = 0;
  }

  function onScroll() {
    if (!rafId) {
      rafId = requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  update();
}

function init() {
  initHeroParallax();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
