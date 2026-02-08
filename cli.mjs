#!/usr/bin/env node

/**
 * venblog — 轻量级静态博客 CLI
 *
 * 命令:
 *   new <title>   创建新博文
 *   build         构建站点
 *   serve         启动开发服务器（带文件监听）
 *   clean         清理生成文件
 *   list          列出所有博文
 *   deploy        部署到远程仓库
 *   init [dir]    初始化新博客
 */

import { Command } from "commander";
import pc from "picocolors";
import log from "./lib/log.mjs";

const program = new Command();

program
  .name("venblog")
  .description("轻量级静态博客 CLI —— thoughts, craft & code")
  .version("0.1.0");

/* ─── new ─── */

program
  .command("new")
  .argument("<title>", "博文标题")
  .option("-t, --tags <tags>", "标签（逗号分隔）", "")
  .option("-d, --date <date>", "指定日期（YYYY-MM-DD）")
  .description("创建新博文")
  .action(async (title, opts) => {
    const { newPost } = await import("./lib/commands/new-post.mjs");
    await newPost(title, opts);
  });

/* ─── build ─── */

program
  .command("build")
  .option("--clean", "构建前先清理生成文件")
  .description("构建站点（Markdown → HTML）")
  .action(async (opts) => {
    if (opts.clean) {
      const { clean } = await import("./lib/commands/clean.mjs");
      await clean();
      log.blank();
    }

    const { build } = await import("./scripts/build.mjs");
    const rootDir = process.cwd();

    log.info("开始构建...");
    try {
      const { posts, duration } = await build(rootDir);
      if (posts.length === 0) {
        log.warn("posts/ 目录下没有 .md 文件");
        return;
      }
      for (const p of posts) {
        log.dim(`  ${p.slug}.md → ${p.slug}.html`);
      }
      log.success(`构建完成：${posts.length} 篇博文，${Math.round(duration)}ms`);
    } catch (err) {
      log.error(`构建失败: ${err.message}`);
      process.exitCode = 1;
    }
  });

/* ─── serve ─── */

program
  .command("serve")
  .option("-p, --port <port>", "服务器端口", "5173")
  .option("--no-open", "不自动打开浏览器")
  .option("--no-build", "跳过初始构建")
  .description("启动开发服务器（带文件监听 + 自动重建）")
  .action(async (opts) => {
    const { startDevServer } = await import("./scripts/serve.mjs");
    const { build } = await import("./scripts/build.mjs");
    const rootDir = process.cwd();
    const port = Number.parseInt(opts.port, 10);

    try {
      await startDevServer(rootDir, {
        port,
        open: opts.open,
        initialBuild: opts.build,
        onBuild: async () => {
          const { posts, duration } = await build(rootDir);
          log.success(`构建完成：${posts.length} 篇博文，${Math.round(duration)}ms`);
        },
        onLog: (msg) => log.info(msg),
      });

      log.blank();
      log.info("监听文件变更中... 按 Ctrl+C 停止");
    } catch (err) {
      log.error(`启动失败: ${err.message}`);
      process.exitCode = 1;
    }
  });

/* ─── clean ─── */

program
  .command("clean")
  .description("清理所有生成的文件")
  .action(async () => {
    const { clean } = await import("./lib/commands/clean.mjs");
    await clean();
  });

/* ─── list ─── */

program
  .command("list")
  .option("--json", "输出 JSON 格式")
  .description("列出所有博文")
  .action(async (opts) => {
    const { list } = await import("./lib/commands/list.mjs");
    await list(opts);
  });

/* ─── deploy ─── */

program
  .command("deploy")
  .option("-m, --message <msg>", "自定义 commit message")
  .description("构建并部署到远程仓库")
  .action(async (opts) => {
    const { deploy } = await import("./lib/commands/deploy.mjs");
    const { build } = await import("./scripts/build.mjs");
    const rootDir = process.cwd();

    await deploy({
      message: opts.message,
      onBuild: async () => {
        const { posts, duration } = await build(rootDir);
        log.success(`构建完成：${posts.length} 篇博文，${Math.round(duration)}ms`);
      },
    });
  });

/* ─── init ─── */

program
  .command("init")
  .argument("[dir]", "目标目录（默认当前目录）")
  .description("初始化新博客")
  .action(async (dir) => {
    const { initBlog } = await import("./lib/commands/init-blog.mjs");
    await initBlog(dir);
  });

/* ─── 无参数时显示帮助 ─── */

if (process.argv.length <= 2) {
  log.blank();
  console.log(pc.bold("  venblog") + pc.dim("  —  轻量级静态博客 CLI"));
  log.blank();
  program.outputHelp();
  log.blank();
} else {
  program.parseAsync(process.argv);
}
