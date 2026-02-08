/**
 * venblog list — 列出所有博文
 */

import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { parseFrontmatter, estimateReadingTime, formatDateShort } from "../../scripts/build.mjs";
import log from "../log.mjs";

/**
 * 列出所有博文
 * @param {object} options - 选项
 * @param {boolean} options.json - 是否输出 JSON 格式
 */
export async function list(options = {}) {
  const rootDir = process.cwd();
  const postsDir = path.join(rootDir, "posts");

  let entries;
  try {
    entries = await fs.readdir(postsDir, { withFileTypes: true });
  } catch {
    log.warn("posts/ 目录不存在");
    return;
  }

  const mdFiles = entries
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".md"))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  if (mdFiles.length === 0) {
    log.info("暂无博文");
    return;
  }

  const posts = [];

  for (const fileName of mdFiles) {
    const raw = await fs.readFile(path.join(postsDir, fileName), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const slug = fileName.replace(/\.md$/i, "");
    const title = meta.title || slug;
    const date = meta.date || "";
    const tags = meta.tags || [];
    const readingTime = estimateReadingTime(body);

    posts.push({ slug, title, date, tags, readingTime });
  }

  // 按日期降序
  posts.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  // JSON 输出模式
  if (options.json) {
    console.log(JSON.stringify(posts, null, 2));
    return;
  }

  // 表格输出
  log.blank();
  log.info(`共 ${posts.length} 篇博文`);
  log.blank();

  // 表头
  const header = `  ${pad("#", 4)}${pad("标题", 28)}${pad("日期", 14)}${pad("阅读", 8)}标签`;
  console.log(pc.dim(header));
  console.log(pc.dim("  " + "─".repeat(76)));

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const num = pc.dim(pad(String(i + 1), 4));
    const title = pad(truncate(p.title, 26), 28);
    const date = pc.dim(pad(formatDateShort(p.date) || "—", 14));
    const time = pc.dim(pad(`${p.readingTime}min`, 8));
    const tags = p.tags.length > 0 ? pc.dim(p.tags.join(", ")) : "";

    console.log(`  ${num}${title}${date}${time}${tags}`);
  }

  log.blank();
}

/** 右填充字符串到指定宽度 */
function pad(str, width) {
  // 简单处理：中文字符算 2 宽度
  let visualLen = 0;
  for (const ch of str) {
    visualLen += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  }
  const padding = Math.max(0, width - visualLen);
  return str + " ".repeat(padding);
}

/** 截断字符串 */
function truncate(str, maxVisualWidth) {
  let visualLen = 0;
  let i = 0;
  for (const ch of str) {
    const w = ch.charCodeAt(0) > 0x7f ? 2 : 1;
    if (visualLen + w > maxVisualWidth - 1) {
      return str.slice(0, i) + "…";
    }
    visualLen += w;
    i += ch.length;
  }
  return str;
}
