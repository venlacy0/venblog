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

  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  const scrollHint = document.querySelector(".hero__scroll");
  const prevBtn = document.querySelector(".scene__nav--prev");
  const nextBtn = document.querySelector(".scene__nav--next");

  const pathLen = path.getTotalLength();
  path.style.strokeDasharray = String(pathLen);
  path.style.strokeDashoffset = String(pathLen);

  let trackRevealed = false;

  /** 检测轨道是否可以滚动，并更新导航按钮状态 */
  function updateNavButtons() {
    if (!prevBtn || !nextBtn) return;

    const stickyRect = sticky.getBoundingClientRect();
    const cards = track.querySelectorAll(".scene-card");
    if (cards.length === 0) return;

    const firstCard = cards[0].getBoundingClientRect();
    const lastCard = cards[cards.length - 1].getBoundingClientRect();
    const totalCardsWidth = lastCard.right - firstCard.left;

    // 轨道内容是否超出可视区
    const overflows = totalCardsWidth > stickyRect.width - 120;

    if (overflows && trackRevealed) {
      prevBtn.classList.add("is-visible");
      nextBtn.classList.add("is-visible");

      prevBtn.disabled = firstCard.left >= stickyRect.left + 60;
      nextBtn.disabled = lastCard.right <= stickyRect.right - 60;
    } else {
      prevBtn.classList.remove("is-visible");
      nextBtn.classList.remove("is-visible");
    }
  }

  /** 水平滚动轨道（按钮驱动，使用 CSS transform 偏移） */
  let navOffset = 0;
  function scrollTrack(direction) {
    const scrollAmount = 320;
    if (direction === "prev") {
      navOffset = Math.min(0, navOffset + scrollAmount);
    } else {
      navOffset = navOffset - scrollAmount;
    }
    // navOffset 会在 render 里叠加到 translateX 上
    // 需要触发一次渲染
    kick();
    setTimeout(updateNavButtons, 420);
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => scrollTrack("prev"));
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => scrollTrack("next"));
  }

  function render(progress01) {
    const p = clamp01(progress01);

    // 1) 横线从左向右绘出
    const drawP = easeOutCubic(clamp01((p - 0.03) / 0.55));
    path.style.strokeDashoffset = String(pathLen * (1 - drawP));

    // 2) 轨道从右往左滑入（滚动驱动）
    const moveP = easeInOutCubic(clamp01((p - 0.18) / 0.62));
    const opacity = clamp01((p - 0.12) / 0.18);

    // 计算居中位置和起始位置
    const stickyW = sticky.offsetWidth;
    const trackW = track.scrollWidth;
    const centeredX = (stickyW - trackW) / 2;
    const startX = stickyW + 40; // 从右侧屏幕外
    const tx = lerp(startX, centeredX, moveP) + navOffset;

    track.style.transform = `translate3d(${tx}px, -50%, 0)`;
    track.style.opacity = opacity.toFixed(3);

    // 标记轨道是否已到位（用于导航按钮）
    const nowRevealed = moveP > 0.92;
    if (nowRevealed !== trackRevealed) {
      trackRevealed = nowRevealed;
      if (trackRevealed) {
        setTimeout(updateNavButtons, 100);
      } else {
        if (prevBtn) prevBtn.classList.remove("is-visible");
        if (nextBtn) nextBtn.classList.remove("is-visible");
      }
    }

    // 滚动时隐藏首屏滚动提示
    if (scrollHint) {
      scrollHint.style.opacity = String(Math.max(0, 1 - p * 8));
    }
  }

  if (reducedMotion) {
    path.style.strokeDashoffset = "0";
    trackRevealed = true;
    const stickyW = sticky.offsetWidth;
    const trackW = track.scrollWidth;
    track.style.transform = `translate3d(${(stickyW - trackW) / 2}px, -50%, 0)`;
    track.style.opacity = "1";
    updateNavButtons();
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
    updateNavButtons();
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
