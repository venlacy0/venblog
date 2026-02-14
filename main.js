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
  const buttons = Array.from(archive.querySelectorAll(".archive-tag"));
  const cards = Array.from(archive.querySelectorAll(".archive-card"));
  if (!tagList || buttons.length === 0 || cards.length === 0) return;

  const allTagLabel = "全部";
  const validTags = new Set(buttons.map((b) => b.dataset.tag).filter(Boolean));

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
    }
  }

  function setStatus(tag, count) {
    if (!statusEl) return;
    statusEl.textContent = `显示${tag} · ${count} 篇`;
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
    const nextTag = validTags.has(tag) ? tag : allTagLabel;
    let visibleCount = 0;

    for (const item of cardItems) {
      const { card, tags } = item;
      const match = nextTag === allTagLabel ? true : tags.includes(nextTag);
      card.hidden = !match;
      if (match) visibleCount += 1;
    }

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
