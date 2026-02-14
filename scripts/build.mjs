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
    '    <script src="../theme.js"><\/script>',
    "  </head>",
    '  <body class="post-page">',
    '    <button class="theme-toggle" type="button" aria-label="切换主题">',
    '      <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>',
    '      <svg class="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    "    </button>",
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
  // 归档区域：左侧标签筛选 + 右侧文章网格
  let archiveHtml = "";
  if (posts.length > 0) {
    const allTagLabel = "全部";
    const tagCountMap = new Map();

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
      `            <button class="archive-tag is-active" type="button" data-tag="${allTagLabel}" aria-pressed="true">`,
      `              <span class="archive-tag__name">${allTagLabel}</span>`,
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
      '      <section class="archive" aria-label="文章归档">',
      '        <h2 class="archive__heading">Archive</h2>',
      '        <div class="archive__layout">',
      '          <aside class="archive__sidebar" aria-label="标签筛选">',
      '            <h3 class="archive__sidebar-title">Tags</h3>',
      '            <div class="archive__tag-list" role="group" aria-label="按标签筛选文章">',
      tagButtons,
      "            </div>",
      "          </aside>",
      '          <div class="archive__content">',
      `            <p class="archive__status" aria-live="polite">显示${allTagLabel} · ${posts.length} 篇</p>`,
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
    '    <script src="theme.js"><\/script>',
    "  </head>",
    "  <body>",
    '    <button class="theme-toggle" type="button" aria-label="切换主题">',
    '      <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>',
    '      <svg class="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    "    </button>",
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
