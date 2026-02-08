/* 博文页增强：阅读进度条、代码语言标签、内容滚动揭示 */

(function () {
  "use strict";

  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  /* ─── 阅读进度条 ─── */
  function initProgressBar() {
    const bar = document.querySelector(".progress-bar");
    if (!bar) return;

    function update() {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH <= 0) {
        bar.style.width = "0%";
        return;
      }
      const pct = Math.min((window.scrollY / docH) * 100, 100);
      bar.style.width = pct + "%";
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ─── 代码块语言标签 ─── */
  function initCodeLabels() {
    const pres = document.querySelectorAll(".md pre");
    pres.forEach(function (pre) {
      const code = pre.querySelector("code");
      if (!code) return;
      // 从 class="language-xxx" 提取语言名
      const cls = Array.from(code.classList).find(function (c) {
        return c.startsWith("language-");
      });
      if (cls) {
        pre.setAttribute("data-lang", cls.replace("language-", ""));
      }
    });
  }

  /* ─── 滚动揭示（IntersectionObserver） ─── */
  function initReveal() {
    if (reducedMotion) return;

    // 给文章内容中的主要块级元素加上 reveal 类
    var content = document.querySelector(".post__content");
    if (!content) return;

    var targets = content.querySelectorAll(
      "h2, h3, blockquote, pre, .katex-display, img",
    );
    targets.forEach(function (el) {
      el.classList.add("reveal");
    });

    if (!("IntersectionObserver" in window)) {
      // 不支持则直接全部显示
      targets.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });
  }

  function init() {
    initProgressBar();
    initCodeLabels();
    initReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
