/**
 * 统一日志输出工具
 * 封装 picocolors，提供带前缀和颜色的日志方法
 */

import pc from "picocolors";

const BRAND = pc.bold("venblog");

/** 普通信息 */
export function info(...args) {
  console.log(pc.cyan(BRAND), ...args);
}

/** 成功 */
export function success(...args) {
  console.log(pc.green(BRAND), pc.green("✓"), ...args);
}

/** 警告 */
export function warn(...args) {
  console.log(pc.yellow(BRAND), pc.yellow("!"), ...args);
}

/** 错误 */
export function error(...args) {
  console.error(pc.red(BRAND), pc.red("✗"), ...args);
}

/** 调试（灰色，安静信息） */
export function dim(...args) {
  console.log(pc.dim(BRAND), pc.dim(...args));
}

/** 空行 */
export function blank() {
  console.log();
}

export default { info, success, warn, error, dim, blank };
