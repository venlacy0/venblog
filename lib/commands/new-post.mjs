/**
 * venblog new <title> — 创建新博文
 */

import fs from "node:fs/promises";
import path from "node:path";
import log from "../log.mjs";

/**
 * 创建新博文
 * @param {string} title - 文章标题
 * @param {object} options - 选项
 * @param {string} options.tags - 逗号分隔的标签
 * @param {string} options.date - 指定日期（YYYY-MM-DD）
 */
export async function newPost(title, options = {}) {
  const rootDir = process.cwd();
  const postsDir = path.join(rootDir, "posts");

  // 确保 posts 目录存在
  await fs.mkdir(postsDir, { recursive: true });

  const fileName = `${title}.md`;
  const filePath = path.join(postsDir, fileName);

  // 检查是否已存在
  const exists = await fs.stat(filePath).catch(() => null);
  if (exists) {
    log.error(`文件已存在: posts/${fileName}`);
    log.dim("如需覆盖，请先手动删除已有文件");
    process.exitCode = 1;
    return;
  }

  // 日期处理
  const date = options.date || todayStr();

  // 标签处理
  let tags = [];
  if (options.tags) {
    tags = options.tags.split(",").map((t) => t.trim()).filter(Boolean);
  }
  const tagsStr = tags.length > 0 ? `[${tags.join(", ")}]` : "[]";

  // 生成 frontmatter
  const content = [
    "---",
    `title: ${title}`,
    `date: ${date}`,
    `tags: ${tagsStr}`,
    "---",
    "",
    `# ${title}`,
    "",
    "",
  ].join("\n");

  await fs.writeFile(filePath, content, "utf8");

  log.success(`新博文已创建`);
  log.info(`路径: posts/${fileName}`);
  log.dim(`日期: ${date} | 标签: ${tagsStr}`);
}

/** 获取今天的日期字符串 YYYY-MM-DD */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
