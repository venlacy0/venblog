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

/* ─── 页面模板 ─── */

function renderPostPage({ title, date, tags, readingTime, contentHtml }) {
  const safeTitle = escapeHtml(String(title));
  const dateFmt = formatDate(date);

  const metaParts = [];
  if (dateFmt) metaParts.push(`<time class="post__date">${escapeHtml(dateFmt)}</time>`);
  if (readingTime) metaParts.push(`<span class="post__reading-time">${readingTime} 分钟阅读</span>`);
  const metaHtml = metaParts.join('<span class="post__meta-sep"></span>');

  let tagsHtml = "";
  if (tags && tags.length > 0) {
    const tagItems = tags.map((t) => `<li class="post__tag">${escapeHtml(t)}</li>`).join("");
    tagsHtml = `\n      <ul class="post__tags">${tagItems}</ul>`;
  }

  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${safeTitle} · Venlacy's Blog</title>`,
    '    <meta name="description" content="Venlacy\'s Blog post." />',
    '    <link rel="stylesheet" href="../styles.css" />',
    '    <link rel="stylesheet" href="../vendor/katex/katex.min.css" />',
    "  </head>",
    '  <body class="post-page">',
    '    <div class="progress-bar" aria-hidden="true"></div>',
    '    <article class="post" aria-label="博客文章">',
    '      <a class="post__back" href="../index.html" aria-label="返回首页">返回</a>',
    `      <h1 class="post__title">${safeTitle}</h1>`,
    `      <div class="post__meta">${metaHtml}</div>`,
    tagsHtml,
    '      <div class="post__content md">',
    contentHtml,
    "      </div>",
    '      <footer class="post__end">',
    '        <span class="post__end-mark"></span>',
    "        fin",
    "      </footer>",
    "    </article>",
    '    <script src="../post.js" defer><\/script>',
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

function renderIndexPage(posts) {
  // 中间展示区：叙事时间轴 + 聚焦面板
  let showcaseHtml = "";
  if (posts.length > 0) {
    const total = String(posts.length).padStart(2, "0");

    const timelineHtml = posts
      .map((p, i) => {
        const href = `posts/${encodeURIComponent(p.slug)}.html`;
        const num = String(i + 1).padStart(2, "0");
        const dateFmt = formatDateShort(p.date) || "未标注日期";
        const active = i === 0;
        return [
          '              <li class="showcase__timeline-item">',
          `                <button class="showcase__tab${active ? " is-active" : ""}" type="button" id="showcase-tab-${i}" role="tab" aria-selected="${active ? "true" : "false"}" aria-controls="showcase-panel-${i}" tabindex="${active ? "0" : "-1"}" data-showcase-index="${i}" data-showcase-href="${escapeHtml(href)}">`,
          `                  <span class="showcase__tab-num">${num}</span>`,
          `                  <span class="showcase__tab-title">${escapeHtml(p.title)}</span>`,
          `                  <span class="showcase__tab-date">${escapeHtml(dateFmt)}</span>`,
          "                </button>",
          "              </li>",
        ].join("\n");
      })
      .join("\n");

    const panelsHtml = posts
      .map((p, i) => {
        const href = `posts/${encodeURIComponent(p.slug)}.html`;
        const num = String(i + 1).padStart(2, "0");
        const dateFmt = formatDateShort(p.date) || "未标注日期";
        const reading = p.readingTime ? `${p.readingTime} 分钟` : "约 1 分钟";
        const tags = p.tags && p.tags.length > 0 ? p.tags.slice(0, 3).join(" · ") : "未分类";
        const active = i === 0;
        return [
          `            <article class="showcase__panel${active ? " is-active" : ""}" id="showcase-panel-${i}" role="tabpanel" aria-labelledby="showcase-tab-${i}" aria-hidden="${active ? "false" : "true"}" data-showcase-index="${i}">`,
          `              <p class="showcase__panel-index">${num} / ${total}</p>`,
          `              <h3 class="showcase__panel-title">${escapeHtml(p.title)}</h3>`,
          '              <p class="showcase__panel-lead">沿着时间轴阅读这篇文章，查看完整正文与上下文。</p>',
          '              <div class="showcase__facts">',
          '                <div class="showcase__fact">',
          '                  <span class="showcase__fact-label">发布日期</span>',
          `                  <time class="showcase__fact-value">${escapeHtml(dateFmt)}</time>`,
          "                </div>",
          '                <div class="showcase__fact">',
          '                  <span class="showcase__fact-label">预计阅读</span>',
          `                  <span class="showcase__fact-value">${escapeHtml(reading)}</span>`,
          "                </div>",
          '                <div class="showcase__fact">',
          '                  <span class="showcase__fact-label">文章标签</span>',
          `                  <span class="showcase__fact-value">${escapeHtml(tags)}</span>`,
          "                </div>",
          "              </div>",
          `              <a class="showcase__read" href="${escapeHtml(href)}" aria-label="阅读全文：${escapeHtml(p.title)}">`,
          "                阅读全文",
          '                <svg class="showcase__read-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 10H15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10.5 5L15.5 10L10.5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
          "              </a>",
          "            </article>",
        ].join("\n");
      })
      .join("\n");

    showcaseHtml = [
      "",
      '      <section class="showcase" aria-label="叙事时间轴">',
      '        <div class="showcase__inner">',
      '          <header class="showcase__head">',
      '            <p class="showcase__kicker">Narrative Timeline</p>',
      '            <h2 class="showcase__heading">中间叙事展示</h2>',
      '            <p class="showcase__summary">从最新文章开始，按时间线浏览每篇内容并直接进入全文。</p>',
      "          </header>",
      '          <div class="showcase__body">',
      '            <ol class="showcase__timeline" role="tablist" aria-label="文章时间轴">',
      timelineHtml,
      "            </ol>",
      '            <div class="showcase__panels">',
      panelsHtml,
      "            </div>",
      "          </div>",
      '          <div class="showcase__controls">',
      '            <button class="showcase__nav showcase__nav--prev" type="button" aria-label="查看上一篇">',
      '              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      "            </button>",
      '            <button class="showcase__nav showcase__nav--next" type="button" aria-label="查看下一篇">',
      '              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      "            </button>",
      `            <p class="showcase__status" aria-live="polite">第 <span data-showcase-current>1</span> / <span data-showcase-total>${posts.length}</span> 篇</p>`,
      "          </div>",
      "        </div>",
      "      </section>",
    ].join("\n");
  }

  // 归档区域：网格卡片布局，一行 3 个
  let archiveHtml = "";
  if (posts.length > 0) {
    const cards = posts
      .map((p) => {
        const href = `posts/${encodeURIComponent(p.slug)}.html`;
        const dateFmt = formatDateShort(p.date);
        const tagList = (p.tags || [])
          .map((t) => `<span class="archive-card__tag">${escapeHtml(t)}</span>`)
          .join("");
        return [
          `          <a class="archive-card" href="${escapeHtml(href)}">`,
          `            <div class="archive-card__tags">${tagList}</div>`,
          `            <h3 class="archive-card__title">${escapeHtml(p.title)}</h3>`,
          `            <div class="archive-card__footer">`,
          `              <time class="archive-card__date">${escapeHtml(dateFmt)}</time>`,
          `              <span class="archive-card__arrow">&rarr;</span>`,
          `            </div>`,
          `          </a>`,
        ].join("\n");
      })
      .join("\n");

    archiveHtml = [
      "",
      '      <section class="archive" aria-label="文章归档">',
      '        <h2 class="archive__heading">Archive</h2>',
      '        <div class="archive__grid">',
      cards,
      "        </div>",
      "      </section>",
    ].join("\n");
  }

  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "    <title>Venlacy's Blog</title>",
    "    <meta",
    '      name="description"',
    '      content="Venlacy\'s Blog. Motion-driven editorial blog experience."',
    "    />",
    '    <link rel="stylesheet" href="styles.css" />',
    "  </head>",
    "  <body>",
    "    <main>",
    '      <section class="hero" aria-label="首页">',
    '        <div class="hero__inner">',
    '          <p class="hero__issue">Issue 001</p>',
    "          <h1 class=\"hero__title\">Venlacy's Blog</h1>",
    '          <hr class="hero__rule" />',
    '          <p class="hero__tagline">thoughts, craft &amp; code</p>',
    "        </div>",
    "      </section>",
    "",
    showcaseHtml,
    archiveHtml,
    "    </main>",
    "",
    '    <script src="main.js" defer></script>',
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

    const pageHtml = renderPostPage({ title, date, tags, readingTime, contentHtml });
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
  const indexHtml = renderIndexPage(allPosts);
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
