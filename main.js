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

function initArchiveTagFilter() {
  const archive = document.querySelector(".archive");
  if (!archive) return;

  const tagList = archive.querySelector(".archive__tag-list");
  const statusEl = archive.querySelector(".archive__status");
  const gridEl = archive.querySelector(".archive__grid");
  const viewSwitch = archive.querySelector(".archive__view-switch");
  const viewButtons = Array.from(archive.querySelectorAll(".archive-view-btn"));
  const buttons = Array.from(archive.querySelectorAll(".archive-tag"));
  const cards = Array.from(archive.querySelectorAll(".archive-card"));
  if (!tagList || buttons.length === 0 || cards.length === 0) return;

  const allTagLabel = "全部";
  const viewModeKey = "venblog-archive-view";
  const validTags = new Set(buttons.map((b) => b.dataset.tag).filter(Boolean));

  const isMobileViewport = () => window.matchMedia("(max-width: 860px)").matches;
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let viewAnimToken = 0;
  let currentViewMode = "grid";

  function applyViewModeClass(mode) {
    if (!gridEl) return;
    gridEl.classList.toggle("is-list", mode === "list");
  }

  function setViewButtons(mode) {
    for (const btn of viewButtons) {
      const isActive = btn.dataset.view === mode;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  }

  function animateViewModeChange(nextMode) {
    if (!gridEl) return;

    const canAnimate =
      !prefersReducedMotion() &&
      typeof document.body?.animate === "function";

    if (!canAnimate) {
      applyViewModeClass(nextMode);
      return;
    }

    const visibleCards = cards.filter((card) => !card.hidden);
    if (visibleCards.length === 0) {
      applyViewModeClass(nextMode);
      return;
    }

    const firstRects = new Map();
    for (const card of visibleCards) {
      firstRects.set(card, card.getBoundingClientRect());
      if (typeof card.getAnimations === "function") {
        for (const anim of card.getAnimations()) {
          anim.cancel();
        }
      }
    }

    const token = ++viewAnimToken;
    gridEl.classList.add("is-view-animating");
    applyViewModeClass(nextMode);

    const animations = [];
    for (const card of visibleCards) {
      const firstRect = firstRects.get(card);
      const lastRect = card.getBoundingClientRect();
      if (!firstRect || !lastRect) continue;

      const dx = firstRect.left - lastRect.left;
      const dy = firstRect.top - lastRect.top;
      const sx = firstRect.width / Math.max(lastRect.width, 1);
      const sy = firstRect.height / Math.max(lastRect.height, 1);

      const movedEnough =
        Math.abs(dx) > 0.5 ||
        Math.abs(dy) > 0.5 ||
        Math.abs(sx - 1) > 0.01 ||
        Math.abs(sy - 1) > 0.01;

      if (!movedEnough) continue;

      const animation = card.animate(
        [
          {
            transformOrigin: "top left",
            transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
            opacity: 0.88,
          },
          {
            transformOrigin: "top left",
            transform: "translate(0, 0) scale(1, 1)",
            opacity: 1,
          },
        ],
        {
          duration: 420,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "both",
        },
      );

      animations.push(animation);
    }

    if (animations.length === 0) {
      if (token === viewAnimToken) {
        gridEl.classList.remove("is-view-animating");
      }
      return;
    }

    Promise.allSettled(
      animations.map((anim) => anim.finished.catch(() => undefined)),
    ).finally(() => {
      if (token === viewAnimToken) {
        gridEl.classList.remove("is-view-animating");
      }
    });
  }

  function cancelCardAnimations() {
    for (const card of cards) {
      if (typeof card.getAnimations !== "function") continue;
      for (const anim of card.getAnimations()) {
        anim.cancel();
      }
    }
  }

  function animateFilterChange() {
    if (!gridEl || prefersReducedMotion() || typeof document.body?.animate !== "function") {
      return;
    }

    const visibleCards = cards.filter((card) => !card.hidden);
    const maxStagger = 90;

    visibleCards.forEach((card, idx) => {
      card.animate(
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: 260,
          easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
          delay: Math.min(idx * 20, maxStagger),
          fill: "both",
        },
      );
    });
  }

  function readViewMode() {
    try {
      const stored = localStorage.getItem(viewModeKey);
      return stored === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  }

  function saveViewMode(mode) {
    try {
      localStorage.setItem(viewModeKey, mode);
    } catch {
      // ignore
    }
  }

  function setViewMode(mode, { persist } = { persist: true }) {
    if (!gridEl || viewButtons.length === 0) return;

    const nextMode = mode === "list" ? "list" : "grid";

    if (nextMode !== currentViewMode) {
      animateViewModeChange(nextMode);
      currentViewMode = nextMode;
    } else {
      applyViewModeClass(nextMode);
    }

    setViewButtons(nextMode);

    if (persist) saveViewMode(nextMode);
  }

  function parseCardTags(card) {
    const raw = card.getAttribute("data-tags");
    if (!raw) return ["未分类"];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => String(t));
      }
    } catch {
      // ignore
    }
    return ["未分类"];
  }

  const cardItems = cards.map((card) => ({ card, tags: parseCardTags(card) }));

  function setActiveButton(tag) {
    for (const btn of buttons) {
      const isActive = btn.dataset.tag === tag;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");

      if (isActive && isMobileViewport()) {
        btn.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }
  }

  function setStatus(tag, count) {
    if (!statusEl) return;

    const lang = document.documentElement.getAttribute("data-lang") || "zh";
    const activeBtn = buttons.find((btn) => btn.dataset.tag === tag);
    const activeName = activeBtn?.querySelector(".archive-tag__name")?.textContent?.trim();
    const isAll = tag === allTagLabel;

    if (lang === "en") {
      const enTag = isAll ? "all" : (activeName || tag);
      const noun = count === 1 ? "article" : "articles";
      statusEl.textContent = `Showing ${enTag} · ${count} ${noun}`;
      return;
    }

    const zhTag = isAll ? allTagLabel : (activeName || tag);
    statusEl.textContent = `显示${zhTag} · ${count} 篇`;
  }

  function syncUrl(tag) {
    const url = new URL(window.location.href);
    if (!tag || tag === allTagLabel) {
      url.searchParams.delete("tag");
    } else {
      url.searchParams.set("tag", tag);
    }
    window.history.replaceState({}, "", url.toString());
  }

  function applyFilter(tag, { updateUrl } = { updateUrl: true }) {
    viewAnimToken += 1;
    if (gridEl) {
      gridEl.classList.remove("is-view-animating");
    }
    cancelCardAnimations();

    const nextTag = validTags.has(tag) ? tag : allTagLabel;
    let visibleCount = 0;

    for (const item of cardItems) {
      const { card, tags } = item;
      const match = nextTag === allTagLabel ? true : tags.includes(nextTag);
      card.hidden = !match;
      card.classList.toggle("is-hidden", !match);
      if (match) visibleCount += 1;
    }

    animateFilterChange();
    setActiveButton(nextTag);
    setStatus(nextTag, visibleCount);
    if (updateUrl) syncUrl(nextTag);
  }

  tagList.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".archive-tag");
    if (!btn) return;
    const tag = btn.dataset.tag || allTagLabel;
    applyFilter(tag);
  });

  if (viewSwitch && viewButtons.length > 0 && gridEl) {
    viewSwitch.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".archive-view-btn");
      if (!btn) return;
      setViewMode(btn.dataset.view);
    });

    const initialMode = readViewMode();
    currentViewMode = initialMode;
    applyViewModeClass(initialMode);
    setViewButtons(initialMode);
  }

  const initTag = new URLSearchParams(window.location.search).get("tag");
  if (initTag && validTags.has(initTag)) {
    applyFilter(initTag, { updateUrl: false });
  } else {
    applyFilter(allTagLabel, { updateUrl: Boolean(initTag) });
  }
}

function init() {
  initHeroParallax();
  initArchiveTagFilter();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
