/* 国际化：中/英切换，Google Translate 免费 API + localStorage 缓存 */
(function () {
  "use strict";

  var STORAGE_KEY = "venblog-lang";
  var CACHE_PRE = "venblog-t-";
  var API = "https://translate.googleapis.com/translate_a/single";

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || "zh";
  }

  /* FNV-1a 哈希 */
  function fnv(s) {
    for (var h = 0x811c9dc5, i = 0; i < s.length; i++)
      h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(36);
  }

  /* 调用翻译 API（带缓存 + 超时） */
  function translate(text, sl, tl) {
    if (!text.trim()) return Promise.resolve(text);
    var key = CACHE_PRE + fnv(sl + tl + text);
    var cached = localStorage.getItem(key);
    if (cached) return Promise.resolve(cached);

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 8000);
    var url = API + "?client=gtx&sl=" + sl + "&tl=" + tl +
      "&dt=t&q=" + encodeURIComponent(text);

    return fetch(url, { signal: ctrl.signal })
      .then(function (r) { clearTimeout(timer); return r.json(); })
      .then(function (d) {
        var out = "";
        if (d && d[0]) d[0].forEach(function (p) { if (p[0]) out += p[0]; });
        try { localStorage.setItem(key, out); } catch (_) {}
        return out;
      });
  }

  /* 保存原始内容用于切回中文 */
  var origMap = new Map();
  function saveOrig(el, id) { if (!origMap.has(id)) origMap.set(id, el.textContent); }
  function restoreOrig(el, id) { if (origMap.has(id)) el.textContent = origMap.get(id); }

  /* 收集需要翻译的元素（排除 code/pre） */
  function collectBlocks(root) {
    var out = [];
    root.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, td, th, dt, dd")
      .forEach(function (el) {
        if (el.closest("pre") || el.closest("code") || el.closest(".katex")) return;
        if (el.textContent.trim()) out.push(el);
      });
    return out;
  }

  /* 翻译页面到英文 */
  async function toEnglish() {
    var jobs = [];

    /* 文章正文 */
    var content = document.querySelector(".post__content");
    if (content) {
      collectBlocks(content).forEach(function (el, i) {
        var id = "c-" + i;
        saveOrig(el, id);
        jobs.push(translate(el.textContent, "zh-CN", "en").then(function (t) { el.textContent = t; }));
      });
    }

    /* 文章标题 */
    var title = document.querySelector(".post__title");
    if (title) { saveOrig(title, "title"); jobs.push(translate(title.textContent, "zh-CN", "en").then(function (t) { title.textContent = t; })); }

    /* 首页卡片标题 */
    document.querySelectorAll(".archive-card__title").forEach(function (el, i) {
      var id = "card-" + i;
      saveOrig(el, id);
      jobs.push(translate(el.textContent, "zh-CN", "en").then(function (t) { el.textContent = t; }));
    });

    /* 标签名 */
    document.querySelectorAll(".archive-tag__name, .archive-card__tag, .post__tag").forEach(function (el, i) {
      var id = "tag-" + i;
      saveOrig(el, id);
      jobs.push(translate(el.textContent, "zh-CN", "en").then(function (t) { el.textContent = t; }));
    });

    /* 返回首页链接（CSS ::before 已有箭头，只替换文字） */
    var back = document.querySelector(".post__back");
    if (back) { saveOrig(back, "back"); back.textContent = "Home"; }

    /* 阅读时间 */
    var rt = document.querySelector(".post__reading-time");
    if (rt) {
      saveOrig(rt, "rt");
      var mins = rt.textContent.match(/(\d+)/);
      if (mins) rt.textContent = mins[1] + " min read";
    }

    /* 文章日期：「2026 年 2 月 14 日」→「Feb 14, 2026」 */
    var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var dateEl = document.querySelector(".post__date");
    if (dateEl) {
      saveOrig(dateEl, "date");
      var dm = dateEl.textContent.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      if (dm) dateEl.textContent = MONTHS[+dm[2] - 1] + " " + +dm[3] + ", " + dm[1];
    }

    /* 归档状态文字 */
    var status = document.querySelector(".archive__status");
    if (status) { saveOrig(status, "status"); var m = status.textContent.match(/(\d+)/); if (m) status.textContent = "Showing all \xb7 " + m[1] + " articles"; }

    /* 归档标题 */
    var archiveH = document.querySelector(".archive__heading");
    if (archiveH) { saveOrig(archiveH, "archiveH"); }

    /* 侧栏标题 */
    var sidebarT = document.querySelector(".archive__sidebar-title");
    if (sidebarT) { saveOrig(sidebarT, "sidebarT"); }

    await Promise.all(jobs);
  }

  /* 恢复中文 */
  function toChinese() {
    origMap.forEach(function (text, id) {
      var el = null;
      if (id === "title") el = document.querySelector(".post__title");
      else if (id === "back") el = document.querySelector(".post__back");
      else if (id === "rt") el = document.querySelector(".post__reading-time");
      else if (id === "date") el = document.querySelector(".post__date");
      else if (id === "status") el = document.querySelector(".archive__status");
      else if (id === "archiveH") el = document.querySelector(".archive__heading");
      else if (id === "sidebarT") el = document.querySelector(".archive__sidebar-title");
      else if (id.startsWith("c-")) { var idx = +id.slice(2); var content = document.querySelector(".post__content"); if (content) el = collectBlocks(content)[idx]; }
      else if (id.startsWith("card-")) { el = document.querySelectorAll(".archive-card__title")[+id.slice(5)]; }
      else if (id.startsWith("tag-")) { el = document.querySelectorAll(".archive-tag__name, .archive-card__tag, .post__tag")[+id.slice(4)]; }
      if (el) el.textContent = text;
    });
  }

  /* ─── 初始化 ─── */
  function init() {
    var lang = getLang();
    var btn = document.querySelector(".lang-toggle");
    if (!btn) return;

    btn.textContent = lang === "zh" ? "En" : "\u4e2d";
    document.documentElement.setAttribute("data-lang", lang);

    btn.addEventListener("click", async function () {
      var cur = getLang();
      var next = cur === "zh" ? "en" : "zh";
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute("data-lang", next);
      btn.textContent = next === "zh" ? "En" : "\u4e2d";

      if (next === "en") {
        btn.classList.add("is-loading");
        try { await toEnglish(); } catch (e) { console.warn("i18n:", e); }
        btn.classList.remove("is-loading");
      } else {
        toChinese();
      }
    });

    if (lang === "en") {
      btn.classList.add("is-loading");
      toEnglish().catch(function (e) { console.warn("i18n:", e); })
        .finally(function () { btn.classList.remove("is-loading"); });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
