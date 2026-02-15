/**
 * 主题切换 + 色相调节
 *
 * - 亮色 / 暗色切换，localStorage 持久化，尊重系统偏好
 * - hover 主题按钮时展开色相条，拖动可实时调整全站色相
 * - 色相值持久化到 localStorage，刷新后保留
 */

(function () {
  "use strict";

  var THEME_KEY = "venblog-theme";
  var HUE_KEY = "venblog-hue";

  /* 默认色相 (原始暖棕色调 ≈ 16°) */
  var DEFAULT_HUE = 16;

  /* ═══════════════════════════════════════
     亮/暗模式
     ═══════════════════════════════════════ */

  function getPreferredTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  /* 尽早执行，防止闪烁 */
  applyTheme(getPreferredTheme());

  /* 进入页面时统一回到顶部（保留锚点跳转） */
  function initScrollTopOnOpen() {
    if (window.location.hash) return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    function scrollTopNow() {
      window.scrollTo(0, 0);
    }

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        function () {
          requestAnimationFrame(scrollTopNow);
          setTimeout(scrollTopNow, 0);
        },
        { once: true },
      );
    } else {
      requestAnimationFrame(scrollTopNow);
      setTimeout(scrollTopNow, 0);
    }

    window.addEventListener("pageshow", function () {
      scrollTopNow();
    });
  }

  initScrollTopOnOpen();

  /* ═══════════════════════════════════════
     HSL 色彩生成器
     根据一个色相值 (0-360) 生成完整的亮/暗色板
     ═══════════════════════════════════════ */

  /**
   * 将 HSL 转换为 HEX
   * @param {number} h - 色相 0-360
   * @param {number} s - 饱和度 0-100
   * @param {number} l - 亮度 0-100
   * @returns {string} hex 颜色值
   */
  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var r = 0,
      g = 0,
      b = 0;

    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return (
      "#" +
      ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
    );
  }

  /**
   * 生成 rgba 字符串
   */
  function hsla(h, s, l, a) {
    return "hsla(" + h + ", " + s + "%, " + l + "%, " + a + ")";
  }

  /**
   * 根据色相生成亮色模式色板并写入 CSS 变量
   * @param {number} hue - 色相 0-360
   */
  function applyHue(hue) {
    var root = document.documentElement;
    var isDark =
      root.getAttribute("data-theme") === "dark";

    if (isDark) {
      root.style.setProperty("--bg", hslToHex(hue, 14, 10));
      root.style.setProperty("--text", hslToHex(hue, 16, 85));
      root.style.setProperty("--muted", hslToHex(hue, 12, 52));
      root.style.setProperty("--ink", hslToHex(hue, 12, 78));
      root.style.setProperty(
        "--rule",
        hsla(hue, 12, 78, 0.12)
      );
      root.style.setProperty("--card", hslToHex(hue, 18, 14));
      root.style.setProperty(
        "--cardText",
        hslToHex(hue, 16, 85)
      );
      root.style.setProperty("--accent", hslToHex(hue, 62, 58));
      root.style.setProperty(
        "--shadow",
        "0 18px 60px rgba(0, 0, 0, 0.35)"
      );
      root.style.setProperty(
        "--shadowHover",
        "0 24px 80px rgba(0, 0, 0, 0.45)"
      );
      root.style.setProperty(
        "--codeBg",
        "rgba(255, 255, 255, 0.05)"
      );
      root.style.setProperty(
        "--codeBorder",
        "rgba(255, 255, 255, 0.07)"
      );
      root.style.setProperty(
        "--selectionBg",
        hsla(hue, 64, 62, 0.28)
      );
    } else {
      root.style.setProperty("--bg", hslToHex(hue, 14, 95));
      root.style.setProperty("--text", hslToHex(hue, 22, 9));
      root.style.setProperty("--muted", hslToHex(hue, 14, 40));
      root.style.setProperty("--ink", hslToHex(hue, 20, 15));
      root.style.setProperty(
        "--rule",
        hsla(hue, 20, 15, 0.15)
      );
      root.style.setProperty("--card", hslToHex(hue, 22, 9));
      root.style.setProperty("--cardText", hslToHex(hue, 14, 92));
      root.style.setProperty("--accent", hslToHex(hue, 62, 45));
      root.style.setProperty(
        "--shadow",
        "0 18px 60px " + hsla(hue, 18, 8, 0.14)
      );
      root.style.setProperty(
        "--shadowHover",
        "0 24px 80px " + hsla(hue, 18, 8, 0.22)
      );
      root.style.setProperty(
        "--codeBg",
        hsla(hue, 20, 10, 0.05)
      );
      root.style.setProperty(
        "--codeBorder",
        hsla(hue, 20, 10, 0.08)
      );
      root.style.setProperty(
        "--selectionBg",
        hsla(hue, 62, 45, 0.18)
      );
    }
  }

  /* 启动时恢复已存色相 */
  var savedHue = parseInt(localStorage.getItem(HUE_KEY), 10);
  var currentHue =
    isFinite(savedHue) && savedHue >= 0 && savedHue <= 360
      ? savedHue
      : DEFAULT_HUE;

  applyHue(currentHue);

  /* ═══════════════════════════════════════
     DOM 初始化（DOMContentLoaded 后执行）
     ═══════════════════════════════════════ */

  function initToggle() {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;

    /* ── 构建外层容器 ── */
    var wrap = document.createElement("div");
    wrap.className = "theme-wrap";
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);

    /* ── 构建色相面板 ── */
    var panel = document.createElement("div");
    panel.className = "hue-panel";

    var track = document.createElement("div");
    track.className = "hue-track";

    var thumb = document.createElement("div");
    thumb.className = "hue-thumb";

    var resetBtn = document.createElement("button");
    resetBtn.className = "hue-reset";
    resetBtn.type = "button";
    resetBtn.textContent = "reset";

    track.appendChild(thumb);
    panel.appendChild(track);
    panel.appendChild(resetBtn);
    wrap.appendChild(panel);

    /* ── 色相滑块位置同步 ── */
    function setThumbPosition(hue) {
      var pct = (hue / 360) * 100;
      thumb.style.left = pct + "%";
    }

    setThumbPosition(currentHue);

    /* ── 亮/暗切换 ── */
    btn.addEventListener("click", function () {
      var current =
        document.documentElement.getAttribute("data-theme") || "light";
      var next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
      /* 切换模式后用当前色相重新渲染色板 */
      applyHue(currentHue);
    });

    /* ── 色相拖动 ── */
    var dragging = false;

    function hueFromPointer(e) {
      var rect = track.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return Math.round((x / rect.width) * 360);
    }

    function onStart(e) {
      e.preventDefault();
      dragging = true;
      wrap.classList.add("is-dragging");
      update(e);
    }

    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      update(e);
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove("is-dragging");
      localStorage.setItem(HUE_KEY, String(currentHue));
    }

    function update(e) {
      currentHue = hueFromPointer(e);
      setThumbPosition(currentHue);
      applyHue(currentHue);
    }

    /* 鼠标事件 */
    track.addEventListener("mousedown", onStart);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);

    /* 触摸事件 */
    track.addEventListener("touchstart", onStart, { passive: false });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);

    /* ── 重置色相 ── */
    resetBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      currentHue = DEFAULT_HUE;
      setThumbPosition(currentHue);
      applyHue(currentHue);
      localStorage.setItem(HUE_KEY, String(currentHue));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initToggle);
  } else {
    initToggle();
  }
})();
