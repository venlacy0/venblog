/**
 * venblog init [dir] — 初始化新博客
 *
 * 无论是从源码运行还是全局安装后运行，
 * 都通过 import.meta.url 定位包内的模板文件。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import log from "../log.mjs";

/* 包根目录（通过 import.meta.url 推导，不依赖 cwd） */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..", "..");

/** 需要从包中复制到新博客的模板文件 */
const TEMPLATE_FILES = [
  "styles.css",
  "main.js",
  "post.js",
  "theme.js",
  "scripts/build.mjs",
  "scripts/serve.mjs",
  "cli.mjs",
  "lib/log.mjs",
  "lib/commands/new-post.mjs",
  "lib/commands/clean.mjs",
  "lib/commands/list.mjs",
  "lib/commands/deploy.mjs",
  "lib/commands/init-blog.mjs",
];

/** 默认的 .gitignore */
const GITIGNORE = `node_modules/
npm-debug.log*
.DS_Store
`;

/** 新博客的 package.json 模板 */
const PKG_TEMPLATE = {
  name: "my-venblog",
  private: true,
  version: "0.1.0",
  type: "module",
  engines: { node: ">=18.0.0" },
  bin: { venblog: "./cli.mjs" },
  scripts: {
    build: "node cli.mjs build",
    serve: "node cli.mjs serve",
    new: "node cli.mjs new",
    clean: "node cli.mjs clean",
    list: "node cli.mjs list",
  },
  dependencies: {
    chokidar: "^5.0.0",
    commander: "^14.0.3",
    katex: "0.16.28",
    picocolors: "^1.1.1",
    "rehype-katex": "7.0.1",
    "rehype-stringify": "10.0.1",
    "remark-gfm": "4.0.1",
    "remark-math": "6.0.0",
    "remark-parse": "11.0.0",
    "remark-rehype": "11.1.2",
    unified: "11.0.5",
  },
};

/**
 * 生成示例博文（日期在运行时确定）
 */
function samplePost() {
  return `---
title: 你好世界
date: ${todayStr()}
tags: [入门]
---

# 你好世界

这是你的第一篇博文，用 Markdown 写作，venblog 会帮你渲染成漂亮的 HTML 页面。

## 开始写作

在 \`posts/\` 目录下创建 \`.md\` 文件，然后运行：

\`\`\`bash
npm run build
\`\`\`

## 支持的语法

- **Markdown**：标题、列表、引用、代码块、图片、链接
- **GFM**：表格、任务列表、删除线
- **数学公式**：行内 \`$E=mc^2$\`，块级 \`$$\\int_0^1 x^2 dx$$\`

> 开始你的写作之旅吧！
`;
}

/**
 * 初始化新博客
 * @param {string} dir - 目标目录（默认当前目录）
 */
export async function initBlog(dir) {
  const targetDir = dir ? path.resolve(dir) : process.cwd();
  const dirName = path.basename(targetDir);

  // 检查目标目录是否存在
  try {
    const entries = await fs.readdir(targetDir);
    const visibleEntries = entries.filter((e) => !e.startsWith("."));
    if (visibleEntries.length > 0) {
      // 检查是否已经是一个 venblog 项目
      const hasPkg = entries.includes("package.json");
      if (hasPkg) {
        try {
          const pkg = JSON.parse(await fs.readFile(path.join(targetDir, "package.json"), "utf8"));
          if (pkg.bin?.venblog && entries.includes("posts")) {
            log.warn("当前目录已经是一个 venblog 项目");
            log.dim("如需重新初始化，请先清空目录");
            return;
          }
        } catch { /* 解析失败则继续 */ }
      }

      log.warn(`目标目录 ${dirName}/ 非空（${visibleEntries.length} 个文件）`);
      log.dim("将跳过已存在的文件");
    }
  } catch {
    // 目录不存在，创建它
    await fs.mkdir(targetDir, { recursive: true });
    log.info(`创建目录: ${dirName}/`);
  }

  // 创建目录结构
  await fs.mkdir(path.join(targetDir, "posts"), { recursive: true });
  await fs.mkdir(path.join(targetDir, "scripts"), { recursive: true });
  await fs.mkdir(path.join(targetDir, "lib", "commands"), { recursive: true });

  // 写入生成的文件
  await writeIfNotExists(path.join(targetDir, "posts", "你好世界.md"), samplePost());
  await writeIfNotExists(path.join(targetDir, ".gitignore"), GITIGNORE);

  // 从包目录复制模板文件
  for (const file of TEMPLATE_FILES) {
    const src = path.join(PKG_ROOT, file);
    const dest = path.join(targetDir, file);

    const srcExists = await fs.stat(src).catch(() => null);
    if (!srcExists) {
      log.dim(`跳过（源不存在）: ${file}`);
      continue;
    }

    const destExists = await fs.stat(dest).catch(() => null);
    if (destExists) {
      log.dim(`跳过已存在: ${file}`);
      continue;
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    log.dim(`复制 ${file}`);
  }

  // 生成 package.json
  const pkgPath = path.join(targetDir, "package.json");
  const pkgExists = await fs.stat(pkgPath).catch(() => null);
  if (!pkgExists) {
    const pkg = { ...PKG_TEMPLATE, name: dirName || "my-venblog" };
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    log.dim("创建 package.json");
  }

  // 安装依赖
  log.info("安装依赖...");
  try {
    execSync("npm install", { cwd: targetDir, stdio: "inherit" });
  } catch {
    log.warn("依赖安装失败，请稍后手动运行 npm install");
  }

  log.blank();
  log.success("博客初始化完成");
  log.blank();
  log.info("接下来你可以：");
  if (dir) {
    log.dim(`  cd ${dirName}`);
  }
  log.dim("  npm run build                 构建站点");
  log.dim("  npm run serve                 启动开发服务器");
  log.dim("  npm run new -- \"标题\"          创建新博文");
  log.blank();
}

/** 文件不存在时写入 */
async function writeIfNotExists(filePath, content) {
  const exists = await fs.stat(filePath).catch(() => null);
  if (exists) {
    log.dim(`跳过已存在: ${path.basename(filePath)}`);
    return;
  }
  await fs.writeFile(filePath, content, "utf8");
  log.dim(`创建 ${path.basename(filePath)}`);
}

/** 获取今天的日期字符串 */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
