import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

const DEFAULT_SITE_CONFIG = {
  site: {
    lang: "zh-CN",
    title: "Venlacy's Blog",
    description: "Venlacy's Blog. Motion-driven editorial blog experience.",
    postDescription: "Venlacy's Blog post.",
  },
  hero: {
    ariaLabel: "首页",
    issue: "Issue 001",
    title: "Venlacy's Blog",
    tagline: "thoughts, craft & code",
  },
  buttons: {
    langToggleAriaLabel: "切换语言",
    langToggleTextZh: "En",
    langToggleTextEn: "中",
    themeToggleAriaLabel: "切换主题",
  },
  archive: {
    sectionAriaLabel: "文章归档",
    heading: "Archive",
    sidebarAriaLabel: "标签筛选",
    sidebarTitle: "Tags",
    tagListAriaLabel: "按标签筛选文章",
    allTagLabelZh: "全部",
    allTagLabelEn: "all",
    statusTemplateZh: "显示{tag} · {count} 篇",
    statusTemplateEn: "Showing {tag} · {count} {noun}",
    viewSwitchLabelZh: "切换文章视图",
    viewSwitchLabelEn: "Switch archive view",
    gridViewLabelZh: "瀑布视图",
    gridViewLabelEn: "Masonry view",
    listViewLabelZh: "平铺视图",
    listViewLabelEn: "List view",
  },
  post: {
    articleAriaLabel: "博客文章",
    backText: "返回",
    backAriaLabel: "返回首页",
    readingTimeTextZh: "分钟阅读",
    endMarkText: "fin",
  },
};

/* ─── 工具函数 ─── */

export function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 简易 YAML frontmatter 解析
 * 支持: title, date, tags (数组)
 * 不引入外部 YAML 库，手动解析简单字段
 */
export function parseFrontmatter(markdown) {
  const normalized = String(markdown).replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { meta: {}, body: normalized };
  }
  const endIdx = normalized.indexOf("\n---\n", 4);
  if (endIdx === -1) {
    return { meta: {}, body: normalized };
  }

  const yamlBlock = normalized.slice(4, endIdx);
  const body = normalized.slice(endIdx + "\n---\n".length);
  const meta = {};

  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();

    if (key === "tags") {
      // 解析 [tag1, tag2] 格式
      const match = val.match(/^\[(.+)]$/);
      if (match) {
        meta.tags = match[1].split(",").map((t) => t.trim()).filter(Boolean);
      } else {
        meta.tags = val ? [val] : [];
      }
    } else {
      meta[key] = val;
    }
  }

  return { meta, body };
}

/**
 * 去掉正文开头的 # 标题行（避免和 frontmatter title 重复）
 */
function stripLeadingH1(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i += 1;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    i += 1;
    while (i < lines.length && lines[i].trim() === "") i += 1;
    return lines.slice(i).join("\n");
  }
  return lines.join("\n");
}

/**
 * 估算中文+英文混合文本的阅读时间（分钟）
 * 中文按 300 字/分钟，英文按 200 词/分钟
 */
export function estimateReadingTime(text) {
  const clean = text.replace(/<[^>]+>/g, "").replace(/\$\$[\s\S]*?\$\$/g, "").replace(/\$[^$]+\$/g, "");
  const cjk = (clean.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const words = clean.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ").split(/\s+/).filter(Boolean).length;
  const minutes = cjk / 300 + words / 200;
  return Math.max(1, Math.round(minutes));
}

/**
 * 格式化日期：2025-07-02 → 2025 年 7 月 2 日
 */
function formatDate(dateStr) {
  if (!dateStr) return "";
  const m = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return String(dateStr);
  return `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`;
}

/**
 * 格式化日期（短格式，用于首页卡片）：2025-07-02 → 2025.07.02
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const m = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return String(dateStr);
  return `${m[1]}.${m[2].padStart(2, "0")}.${m[3].padStart(2, "0")}`;
}

function normalizeTags(tags) {
  const normalized = [];
  const seen = new Set();

  for (const rawTag of Array.isArray(tags) ? tags : []) {
    const tag = String(rawTag || "").trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }

  if (normalized.length === 0) {
    normalized.push("未分类");
  }

  return normalized;
}

function cloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeConfig(base, override) {
  if (!isPlainObject(base)) {
    return isPlainObject(override) ? cloneConfig(override) : override;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (isPlainObject(merged[key]) && isPlainObject(value)) {
      merged[key] = mergeConfig(merged[key], value);
      continue;
    }
    merged[key] = value;
  }

  return merged;
}

function formatTemplate(template, variables) {
  const source = String(template || "");
  return source.replace(/\{(\w+)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key]);
    }
    return "";
  });
}

async function loadSiteConfig(rootDir) {
  const configPath = path.join(rootDir, "venblog.config.json");
  const fallback = cloneConfig(DEFAULT_SITE_CONFIG);

  const raw = await fs.readFile(configPath, "utf8").catch(() => null);
  if (!raw) return fallback;

  let userConfig;
  try {
    userConfig = JSON.parse(raw);
  } catch (err) {
    throw new Error(`配置文件 venblog.config.json 解析失败: ${err.message}`);
  }

  if (!isPlainObject(userConfig)) {
    throw new Error("配置文件 venblog.config.json 顶层必须是 JSON 对象");
  }

  return mergeConfig(fallback, userConfig);
}

/* ─── 页面模板 ─── */

/* 构建时间戳，用于缓存破坏 */
const CACHE_VER = Date.now().toString(36);

function renderPostPage({ title, date, tags, readingTime, contentHtml, siteConfig }) {
  const siteCfg = siteConfig.site;
  const postCfg = siteConfig.post;
  const buttonCfg = siteConfig.buttons;

  const pageLang = siteCfg.lang;
  const siteTitle = siteCfg.title;
  const postDescription = siteCfg.postDescription;
  const langToggleAria = buttonCfg.langToggleAriaLabel;
  const langToggleTextZh = buttonCfg.langToggleTextZh;
  const langToggleTextEn = buttonCfg.langToggleTextEn;
  const themeToggleAria = buttonCfg.themeToggleAriaLabel;
  const articleAria = postCfg.articleAriaLabel;
  const backText = postCfg.backText;
  const backAria = postCfg.backAriaLabel;
  const readingTimeTextZh = postCfg.readingTimeTextZh;
  const endMarkText = postCfg.endMarkText;

  const safeTitle = escapeHtml(String(title));
  const dateFmt = formatDate(date);

  const metaParts = [];
  if (dateFmt) metaParts.push(`<time class="post__date">${escapeHtml(dateFmt)}</time>`);
  if (readingTime) {
    metaParts.push(
      `<span class="post__reading-time">${readingTime} ${escapeHtml(readingTimeTextZh)}</span>`,
    );
  }
  const metaHtml = metaParts.join('<span class="post__meta-sep"></span>');

  let tagsHtml = "";
  if (tags && tags.length > 0) {
    const tagItems = tags.map((t) => `<li class="post__tag">${escapeHtml(t)}</li>`).join("");
    tagsHtml = `\n      <ul class="post__tags">${tagItems}</ul>`;
  }

  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(pageLang)}">`,
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${safeTitle} · ${escapeHtml(siteTitle)}</title>`,
    `    <meta name="description" content="${escapeHtml(postDescription)}" />`,
    `    <link rel="stylesheet" href="../styles.css?v=${CACHE_VER}" />`,
    `    <link rel="stylesheet" href="../vendor/katex/katex.min.css?v=${CACHE_VER}" />`,
    `    <script src="../theme.js?v=${CACHE_VER}"><\/script>`,
    `    <script src="../i18n.js?v=${CACHE_VER}" defer><\/script>`,
  "  </head>",
  '  <body class="post-page">',
    `    <button class="lang-toggle" type="button" aria-label="${escapeHtml(langToggleAria)}" data-zh-text="${escapeHtml(langToggleTextZh)}" data-en-text="${escapeHtml(langToggleTextEn)}">${escapeHtml(langToggleTextZh)}</button>`,
    `    <button class="theme-toggle" type="button" aria-label="${escapeHtml(themeToggleAria)}">`,
    '      <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>',
    '      <svg class="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    "    </button>",
    '    <div class="progress-bar" aria-hidden="true"></div>',
    `    <article class="post" aria-label="${escapeHtml(articleAria)}">`,
    `      <a class="post__back" href="../index.html" aria-label="${escapeHtml(backAria)}">${escapeHtml(backText)}</a>`,
    `      <h1 class="post__title">${safeTitle}</h1>`,
    `      <div class="post__meta">${metaHtml}</div>`,
    tagsHtml,
    '      <div class="post__content md">',
    contentHtml,
    "      </div>",
    '      <footer class="post__end">',
    '        <span class="post__end-mark"></span>',
    `        ${escapeHtml(endMarkText)}`,
    "      </footer>",
    "    </article>",
    `    <script src="../post.js?v=${CACHE_VER}" defer><\/script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

function renderIndexPage(posts, siteConfig) {
  const siteCfg = siteConfig.site;
  const heroCfg = siteConfig.hero;
  const buttonCfg = siteConfig.buttons;
  const archiveCfg = siteConfig.archive;

  const pageLang = siteCfg.lang;
  const siteTitle = siteCfg.title;
  const siteDescription = siteCfg.description;
  const langToggleAria = buttonCfg.langToggleAriaLabel;
  const langToggleTextZh = buttonCfg.langToggleTextZh;
  const langToggleTextEn = buttonCfg.langToggleTextEn;
  const themeToggleAria = buttonCfg.themeToggleAriaLabel;

  // 归档区域：左侧标签筛选 + 右侧文章网格
  let archiveHtml = "";
  if (posts.length > 0) {
    const allTagLabel = archiveCfg.allTagLabelZh;
    const tagCountMap = new Map();

    const statusTextZh = formatTemplate(archiveCfg.statusTemplateZh, {
      tag: allTagLabel,
      count: posts.length,
      noun: posts.length === 1 ? "article" : "articles",
    });

    const cards = posts
      .map((p) => {
        const href = `posts/${encodeURIComponent(p.slug)}.html`;
        const dateFmt = formatDateShort(p.date);
        const normalizedTags = normalizeTags(p.tags);
        for (const tag of normalizedTags) {
          tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
        }

        const tagList = normalizedTags
          .map((t) => `<span class="archive-card__tag">${escapeHtml(t)}</span>`)
          .join("");
        const serializedTags = escapeHtml(JSON.stringify(normalizedTags));

        return [
          `              <a class="archive-card" href="${escapeHtml(href)}" data-tags="${serializedTags}">`,
          `                <div class="archive-card__tags">${tagList}</div>`,
          `                <h3 class="archive-card__title">${escapeHtml(p.title)}</h3>`,
          `                <div class="archive-card__footer">`,
          `                  <time class="archive-card__date">${escapeHtml(dateFmt)}</time>`,
          `                  <span class="archive-card__arrow">&rarr;</span>`,
          `                </div>`,
          `              </a>`,
        ].join("\n");
      })
      .join("\n");

    const allTags = [...tagCountMap.keys()].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

    const tagButtons = [
      `            <button class="archive-tag is-active" type="button" data-tag="${escapeHtml(allTagLabel)}" data-is-all="true" aria-pressed="true">`,
      `              <span class="archive-tag__name">${escapeHtml(allTagLabel)}</span>`,
      `              <span class="archive-tag__count">${posts.length}</span>`,
      "            </button>",
      ...allTags.map((tag) => {
        const count = tagCountMap.get(tag) || 0;
        return [
          `            <button class="archive-tag" type="button" data-tag="${escapeHtml(tag)}" aria-pressed="false">`,
          `              <span class="archive-tag__name">${escapeHtml(tag)}</span>`,
          `              <span class="archive-tag__count">${count}</span>`,
          "            </button>",
        ].join("\n");
      }),
    ].join("\n");

    archiveHtml = [
      "",
      `      <section class="archive" aria-label="${escapeHtml(archiveCfg.sectionAriaLabel)}" data-all-tag-zh="${escapeHtml(archiveCfg.allTagLabelZh)}" data-all-tag-en="${escapeHtml(archiveCfg.allTagLabelEn)}" data-status-template-zh="${escapeHtml(archiveCfg.statusTemplateZh)}" data-status-template-en="${escapeHtml(archiveCfg.statusTemplateEn)}">`,
      `        <h2 class="archive__heading">${escapeHtml(archiveCfg.heading)}</h2>`,
      '        <div class="archive__layout">',
      `          <aside class="archive__sidebar" aria-label="${escapeHtml(archiveCfg.sidebarAriaLabel)}">`,
      `            <h3 class="archive__sidebar-title">${escapeHtml(archiveCfg.sidebarTitle)}</h3>`,
      `            <div class="archive__tag-list" role="group" aria-label="${escapeHtml(archiveCfg.tagListAriaLabel)}">`,
      tagButtons,
      "            </div>",
      "          </aside>",
      '          <div class="archive__content">',
      '            <div class="archive__status-row">',
      `              <p class="archive__status" aria-live="polite">${escapeHtml(statusTextZh)}</p>`,
      `              <div class="archive__view-switch" role="group" aria-label="${escapeHtml(archiveCfg.viewSwitchLabelZh)}" data-label-zh="${escapeHtml(archiveCfg.viewSwitchLabelZh)}" data-label-en="${escapeHtml(archiveCfg.viewSwitchLabelEn)}">`,
      `                <button class="archive-view-btn is-active" type="button" data-view="grid" data-label-zh="${escapeHtml(archiveCfg.gridViewLabelZh)}" data-label-en="${escapeHtml(archiveCfg.gridViewLabelEn)}" aria-pressed="true" aria-label="${escapeHtml(archiveCfg.gridViewLabelZh)}" title="${escapeHtml(archiveCfg.gridViewLabelZh)}">`,
      '                  <svg class="archive-view-btn__icon" viewBox="0 0 24 24" aria-hidden="true">',
      '                    <rect x="3.5" y="4" width="7" height="6.5" rx="1.2"></rect>',
      '                    <rect x="13.5" y="4" width="7" height="10.5" rx="1.2"></rect>',
      '                    <rect x="3.5" y="12.5" width="7" height="7.5" rx="1.2"></rect>',
      '                    <rect x="13.5" y="16.5" width="7" height="3.5" rx="1.2"></rect>',
      '                  </svg>',
      '                </button>',
      `                <button class="archive-view-btn" type="button" data-view="list" data-label-zh="${escapeHtml(archiveCfg.listViewLabelZh)}" data-label-en="${escapeHtml(archiveCfg.listViewLabelEn)}" aria-pressed="false" aria-label="${escapeHtml(archiveCfg.listViewLabelZh)}" title="${escapeHtml(archiveCfg.listViewLabelZh)}">`,
      '                  <svg class="archive-view-btn__icon" viewBox="0 0 24 24" aria-hidden="true">',
      '                    <rect x="3.5" y="5.5" width="3" height="3" rx="0.8"></rect>',
      '                    <line x1="9.5" y1="7" x2="20.5" y2="7"></line>',
      '                    <rect x="3.5" y="10.5" width="3" height="3" rx="0.8"></rect>',
      '                    <line x1="9.5" y1="12" x2="20.5" y2="12"></line>',
      '                    <rect x="3.5" y="15.5" width="3" height="3" rx="0.8"></rect>',
      '                    <line x1="9.5" y1="17" x2="20.5" y2="17"></line>',
      '                  </svg>',
      '                </button>',
      '              </div>',
      '            </div>',
      '            <div class="archive__grid">',
      cards,
      "            </div>",
      "          </div>",
      "        </div>",
      "      </section>",
    ].join("\n");
  }

  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(pageLang)}">`,
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${escapeHtml(siteTitle)}</title>`,
    "    <meta",
    '      name="description"',
    `      content="${escapeHtml(siteDescription)}"`,
    "    />",
    `    <link rel="stylesheet" href="styles.css?v=${CACHE_VER}" />`,
    `    <script src="theme.js?v=${CACHE_VER}"><\/script>`,
    `    <script src="i18n.js?v=${CACHE_VER}" defer><\/script>`,
  "  </head>",
  "  <body>",
    `    <button class="lang-toggle" type="button" aria-label="${escapeHtml(langToggleAria)}" data-zh-text="${escapeHtml(langToggleTextZh)}" data-en-text="${escapeHtml(langToggleTextEn)}">${escapeHtml(langToggleTextZh)}</button>`,
    `    <button class="theme-toggle" type="button" aria-label="${escapeHtml(themeToggleAria)}">`,
    '      <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>',
    '      <svg class="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    "    </button>",
    "    <main>",
    `      <section class="hero" aria-label="${escapeHtml(heroCfg.ariaLabel)}">`,
    '        <div class="hero__inner">',
    `          <p class="hero__issue">${escapeHtml(heroCfg.issue)}</p>`,
    `          <h1 class="hero__title">${escapeHtml(heroCfg.title)}</h1>`,
    '          <hr class="hero__rule" />',
    `          <p class="hero__tagline">${escapeHtml(heroCfg.tagline)}</p>`,
    "        </div>",
    "      </section>",
    "",
    archiveHtml,
    "    </main>",
    "",
    `    <script src="main.js?v=${CACHE_VER}" defer></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

/* ─── KaTeX 资源 ─── */

async function copyKatexAssets(rootDir) {
  const katexDist = path.join(rootDir, "node_modules", "katex", "dist");
  const katexLicense = path.join(rootDir, "node_modules", "katex", "LICENSE");
  const outDir = path.join(rootDir, "vendor", "katex");

  await fs.mkdir(outDir, { recursive: true });
  await fs.copyFile(
    path.join(katexDist, "katex.min.css"),
    path.join(outDir, "katex.min.css"),
  );
  await fs.copyFile(katexLicense, path.join(outDir, "LICENSE"));
  await fs.cp(path.join(katexDist, "fonts"), path.join(outDir, "fonts"), {
    recursive: true,
    force: true,
  });
}

/* ─── 核心构建函数（供 CLI 调用） ─── */

/**
 * 构建整个博客站点
 * @param {string} rootDir - 项目根目录
 * @returns {{ posts: Array, duration: number }} 构建结果
 */
export async function build(rootDir) {
  const start = performance.now();
  const postsDir = path.join(rootDir, "posts");
  const siteConfig = await loadSiteConfig(rootDir);

  await copyKatexAssets(rootDir);

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, { throwOnError: false, strict: false })
    .use(rehypeStringify);

  const entries = await fs.readdir(postsDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".md"))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  if (mdFiles.length === 0) {
    return { posts: [], duration: performance.now() - start };
  }

  const allPosts = [];

  for (const fileName of mdFiles) {
    const mdAbs = path.join(postsDir, fileName);
    const slug = fileName.replace(/\.md$/i, "");
    const outAbs = path.join(postsDir, `${slug}.html`);

    const raw = await fs.readFile(mdAbs, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const cleaned = stripLeadingH1(body);
    const contentHtml = String(await processor.process(cleaned));

    const title = meta.title || slug;
    const date = meta.date || "";
    const tags = meta.tags || [];
    const readingTime = estimateReadingTime(cleaned);

    const pageHtml = renderPostPage({
      title,
      date,
      tags,
      readingTime,
      contentHtml,
      siteConfig,
    });
    await fs.writeFile(outAbs, pageHtml, "utf8");

    allPosts.push({ slug, title, date, tags, readingTime });
  }

  // 按日期降序排列（最新在前）
  allPosts.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  // 生成首页
  const indexHtml = renderIndexPage(allPosts, siteConfig);
  await fs.writeFile(path.join(rootDir, "index.html"), indexHtml, "utf8");

  return { posts: allPosts, duration: performance.now() - start };
}

/* ─── 直接运行兼容 ─── */

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] === thisFile) {
  build(process.cwd())
    .then(({ posts, duration }) => {
      for (const p of posts) {
        console.log(`Rendered posts/${p.slug}.md -> posts/${p.slug}.html`);
      }
      console.log(`Generated index.html (${posts.length} posts) in ${Math.round(duration)}ms`);
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
