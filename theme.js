/* 主题切换：亮色 / 暗色，localStorage 持久化，尊重系统偏好 */

(function () {
  "use strict";

  var STORAGE_KEY = "venblog-theme";

  function getPreferred() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  /* 初始化（尽早执行，避免闪烁） */
  apply(getPreferred());

  function initToggle() {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;

    btn.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme") || "light";
      var next = current === "dark" ? "light" : "dark";
      apply(next);
      localStorage.setItem(STORAGE_KEY, next);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initToggle);
  } else {
    initToggle();
  }
})();
