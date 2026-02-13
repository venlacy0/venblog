/* Motion-driven scroll scene:
   - Hero parallax on scroll.
   - Draws the chain path from left to right as you scroll.
   - Reveals a horizontal track of post cards along the line.
   - Nav buttons scroll the track when cards overflow.
*/

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(x) {
  if (x < 0.5) return 4 * x * x * x;
  return 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const VIEWBOX_W = 1000;
const VIEWBOX_H = 220;

/* ─── Hero 视差 ─── */
function initHeroParallax() {
  const heroInner = document.querySelector(".hero__inner");
  const hero = document.querySelector(".hero");
  if (!heroInner || !hero) return;

  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  if (reducedMotion) return;

  let lastY = 0;
  let rafId = 0;

  function update() {
    const scrollY = window.scrollY || window.pageYOffset;
    const heroH = hero.offsetHeight;
    // 只在 hero 可视范围内生效
    if (scrollY > heroH) {
      rafId = 0;
      return;
    }
    const ratio = scrollY / heroH;
    // 标题上移 + 微微缩小 + 淡出
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

/* ─── 主滚动场景 ─── */
function initScene() {
  const scene = document.querySelector(".scene");
  const sticky = document.querySelector(".scene__sticky");
  const path = document.querySelector("#chainPath");
  const track = document.querySelector("#sceneTrack");

  if (!scene || !sticky || !path || !track) return;

  // 兼容旧版 index.html：如果缺少 rail/viewport，则在运行时补齐结构
  let rail = document.querySelector("#sceneRail");
  let viewport = document.querySelector("#sceneViewport");

  if (!rail || !viewport) {
    rail = document.createElement("div");
    rail.className = "scene__rail";
    rail.id = "sceneRail";

    viewport = document.createElement("div");
    viewport.className = "scene__viewport";
    viewport.id = "sceneViewport";

    // 将 track 包进 viewport/rail
    const parent = track.parentNode;
    viewport.appendChild(track);
    rail.appendChild(viewport);

    if (parent) parent.appendChild(rail);
  }

  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  const prevBtn = document.querySelector(".scene__nav--prev");
  const nextBtn = document.querySelector(".scene__nav--next");

  const scrollBehavior = reducedMotion ? "auto" : "smooth";

  const pathLen = path.getTotalLength();
  path.style.strokeDasharray = String(pathLen);
  path.style.strokeDashoffset = String(pathLen);

  let trackRevealed = false;
  let didCenter = false;
  let navRaf = 0;

  // 只有 JS 生效时才启用“默认隐藏 + 动效显现”，避免出现“没 JS 就一片空白”
  scene.classList.add("scene--js");

  function scheduleNavUpdate() {
    if (navRaf) return;
    navRaf = requestAnimationFrame(() => {
      navRaf = 0;
      updateNavButtons();
    });
  }

  function centerViewport() {
    const max = viewport.scrollWidth - viewport.clientWidth;
    if (max <= 1) return;
    viewport.scrollLeft = Math.round(max / 2);
  }

  function measureStep() {
    const first = track.querySelector(".scene-card");
    if (!first) return 320;
    const cardW = first.getBoundingClientRect().width || 0;
    const styles = getComputedStyle(track);
    const gapStr = styles.columnGap || styles.gap || "0";
    const gap = Number.parseFloat(gapStr) || 0;
    return Math.max(120, Math.round(cardW + gap));
  }

  /** 检测轨道是否可以滚动，并更新导航按钮状态 */
  function updateNavButtons() {
    if (!prevBtn || !nextBtn) return;

    const max = viewport.scrollWidth - viewport.clientWidth;
    const overflows = max > 2;

    if (!overflows || !trackRevealed) {
      prevBtn.classList.remove("is-visible");
      nextBtn.classList.remove("is-visible");
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    prevBtn.classList.add("is-visible");
    nextBtn.classList.add("is-visible");

    const left = viewport.scrollLeft;
    prevBtn.disabled = left <= 1;
    nextBtn.disabled = left >= max - 1;
  }

  /** 水平滚动轨道（按钮驱动，使用真实滚动容器） */
  function scrollTrack(direction) {
    const step = measureStep();
    const delta = direction === "prev" ? -step : step;
    viewport.scrollBy({ left: delta, behavior: scrollBehavior });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => scrollTrack("prev"));
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => scrollTrack("next"));
  }

  viewport.addEventListener("scroll", scheduleNavUpdate, { passive: true });

  function render(progress01) {
    const p = clamp01(progress01);

    // 1) 横线从左向右绘出
    const drawP = easeOutCubic(clamp01((p - 0.03) / 0.55));
    path.style.strokeDashoffset = String(pathLen * (1 - drawP));

    // 2) 展示栏从右往左滑入（滚动驱动）
    const moveP = easeInOutCubic(clamp01((p - 0.18) / 0.62));
    const opacity = clamp01((p - 0.12) / 0.18);

    // 展示栏进场：小幅右移回弹，避免整块被推到屏幕外导致“看不到内容”
    const stickyW = sticky.offsetWidth;
    const enterX = Math.min(140, Math.max(60, stickyW * 0.18));
    const tx = lerp(enterX, 0, moveP);

    rail.style.transform = `translate3d(${tx}px, -50%, 0)`;
    rail.style.opacity = opacity.toFixed(3);
    rail.classList.toggle("is-interactive", opacity > 0.08);

    // 标记轨道是否已到位（用于导航按钮）
    const nowRevealed = moveP > 0.92;
    if (nowRevealed !== trackRevealed) {
      trackRevealed = nowRevealed;
      if (trackRevealed) {
        if (!didCenter) {
          didCenter = true;
          requestAnimationFrame(() => {
            centerViewport();
            updateNavButtons();
          });
        } else {
          scheduleNavUpdate();
        }
      } else {
        if (prevBtn) prevBtn.classList.remove("is-visible");
        if (nextBtn) nextBtn.classList.remove("is-visible");
      }
    }
  }

  if (reducedMotion) {
    path.style.strokeDashoffset = "0";
    rail.style.transform = "translate3d(0, -50%, 0)";
    rail.style.opacity = "1";
    rail.classList.add("is-interactive");
    trackRevealed = true;
    centerViewport();
    updateNavButtons();
    window.addEventListener("resize", scheduleNavUpdate, { passive: true });
    return;
  }

  let target = 0;
  let current = 0;
  let ticking = false;

  function computeTargetProgress() {
    const rect = scene.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const total = rect.height - vh;
    if (total <= 0) return 0;
    const scrolled = Math.min(Math.max(-rect.top, 0), total);
    return scrolled / total;
  }

  function kick() {
    target = computeTargetProgress();
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(tick);
    }
  }

  function tick() {
    current = current + (target - current) * 0.12;

    const done = Math.abs(target - current) < 0.0007;
    if (done) current = target;

    render(current);

    if (!done) {
      requestAnimationFrame(tick);
      return;
    }

    ticking = false;
  }

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", () => {
    kick();
    scheduleNavUpdate();
  });
  kick();
}

function init() {
  initHeroParallax();
  initScene();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
