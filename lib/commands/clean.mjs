/**
 * venblog clean — 清理生成文件
 */

import fs from "node:fs/promises";
import path from "node:path";
import log from "../log.mjs";

/**
 * 清理所有构建生成的文件
 */
export async function clean() {
  const rootDir = process.cwd();
  const postsDir = path.join(rootDir, "posts");
  let count = 0;

  // 1. 清理 posts/*.html
  try {
    const entries = await fs.readdir(postsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
        const abs = path.join(postsDir, entry.name);
        await fs.unlink(abs);
        log.dim(`删除 posts/${entry.name}`);
        count++;
      }
    }
  } catch {
    /* posts 目录不存在则跳过 */
  }

  // 2. 清理根目录 index.html
  const indexPath = path.join(rootDir, "index.html");
  const indexExists = await fs.stat(indexPath).catch(() => null);
  if (indexExists) {
    await fs.unlink(indexPath);
    log.dim("删除 index.html");
    count++;
  }

  // 3. 清理 vendor/ 目录
  const vendorDir = path.join(rootDir, "vendor");
  const vendorExists = await fs.stat(vendorDir).catch(() => null);
  if (vendorExists) {
    await fs.rm(vendorDir, { recursive: true });
    log.dim("删除 vendor/");
    count++;
  }

  if (count > 0) {
    log.success(`清理完成，共删除 ${count} 个文件/目录`);
  } else {
    log.info("没有需要清理的文件");
  }
}
