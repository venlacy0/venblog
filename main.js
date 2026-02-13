/* Home page interactions:
   - Hero parallax on scroll.
   - Showcase timeline tab navigation.
*/

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

/* ─── 中间展示区：叙事时间轴 ─── */
function initShowcase() {
  const showcase = document.querySelector(".showcase");
  if (!showcase) return;

  const timeline = showcase.querySelector(".showcase__timeline");
  const tabs = Array.from(showcase.querySelectorAll(".showcase__tab"));
  const panels = Array.from(showcase.querySelectorAll(".showcase__panel"));

  if (!timeline || tabs.length === 0 || panels.length === 0) return;

  const prevBtn = showcase.querySelector(".showcase__nav--prev");
  const nextBtn = showcase.querySelector(".showcase__nav--next");
  const currentEl = showcase.querySelector("[data-showcase-current]");
  const totalEl = showcase.querySelector("[data-showcase-total]");

  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  const scrollBehavior = reducedMotion ? "auto" : "smooth";

  let activeIndex = tabs.findIndex(
    (tab) => tab.getAttribute("aria-selected") === "true",
  );
  if (activeIndex < 0) activeIndex = 0;

  function updateNavButtons() {
    const maxIndex = tabs.length - 1;
    if (prevBtn) prevBtn.disabled = activeIndex <= 0;
    if (nextBtn) nextBtn.disabled = activeIndex >= maxIndex;
  }

  function updateStatus() {
    if (currentEl) currentEl.textContent = String(activeIndex + 1);
    if (totalEl) totalEl.textContent = String(tabs.length);
  }

  function keepTabInView(index) {
    const tab = tabs[index];
    if (!tab) return;
    tab.scrollIntoView({
      behavior: scrollBehavior,
      block: "nearest",
      inline: "nearest",
    });
  }

  function setActive(index, options = {}) {
    const { focusTab = false } = options;
    const nextIndex = clamp(index, 0, tabs.length - 1);
    activeIndex = nextIndex;

    tabs.forEach((tab, i) => {
      const active = i === activeIndex;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel, i) => {
      const active = i === activeIndex;
      panel.classList.toggle("is-active", active);
      panel.setAttribute("aria-hidden", active ? "false" : "true");
    });

    updateStatus();
    updateNavButtons();
    keepTabInView(activeIndex);

    if (focusTab) {
      tabs[activeIndex]?.focus();
    }
  }

  function moveBy(delta, focusTab) {
    setActive(activeIndex + delta, { focusTab });
  }

  timeline.addEventListener("click", (event) => {
    const tab = event.target.closest(".showcase__tab");
    if (!tab) return;
    const idx = Number(tab.dataset.showcaseIndex);
    if (!Number.isFinite(idx)) return;
    setActive(idx, { focusTab: false });
  });

  timeline.addEventListener("keydown", (event) => {
    const tab = event.target.closest(".showcase__tab");
    if (!tab) return;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveBy(1, true);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveBy(-1, true);
        break;
      case "Home":
        event.preventDefault();
        setActive(0, { focusTab: true });
        break;
      case "End":
        event.preventDefault();
        setActive(tabs.length - 1, { focusTab: true });
        break;
      default:
        break;
    }
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", () => moveBy(-1, true));
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => moveBy(1, true));
  }

  setActive(activeIndex);
}

function init() {
  initHeroParallax();
  initShowcase();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
