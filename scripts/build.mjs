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
