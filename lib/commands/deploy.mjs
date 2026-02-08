/**
 * venblog deploy — 部署到 GitHub Pages
 */

import { execSync } from "node:child_process";
import log from "../log.mjs";

/**
 * 部署博客到远程仓库
 * @param {object} options - 选项
 * @param {string} options.message - 自定义 commit message
 * @param {function} options.onBuild - 构建回调
 */
export async function deploy(options = {}) {
  const { message, onBuild } = options;

  // 1. 检查 git 是否已初始化
  if (!isGitRepo()) {
    log.error("当前目录不是 Git 仓库");
    log.dim("请先运行: git init && git remote add origin <url>");
    process.exitCode = 1;
    return;
  }

  // 2. 检查是否有 remote
  if (!hasRemote()) {
    log.error("未配置远程仓库");
    log.dim("请先运行: git remote add origin <url>");
    process.exitCode = 1;
    return;
  }

  // 3. 构建
  log.info("开始构建...");
  if (onBuild) {
    await onBuild();
  }

  // 4. Git 操作
  const commitMsg = message || `deploy: ${new Date().toISOString().slice(0, 10)}`;

  try {
    // 检查是否有变更
    const status = git("status --porcelain");
    if (!status.trim()) {
      log.info("没有需要提交的变更");
      return;
    }

    git("add -A");
    git(`commit -m "${commitMsg}"`);

    log.info("推送到远程仓库...");
    git("push");

    log.success("部署完成");
  } catch (err) {
    log.error(`Git 操作失败: ${err.message}`);
    process.exitCode = 1;
  }
}

/** 执行 git 命令 */
function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8", stdio: "pipe" });
}

/** 检查是否是 git 仓库 */
function isGitRepo() {
  try {
    git("rev-parse --git-dir");
    return true;
  } catch {
    return false;
  }
}

/** 检查是否配置了 remote */
function hasRemote() {
  try {
    const remotes = git("remote");
    return remotes.trim().length > 0;
  } catch {
    return false;
  }
}
