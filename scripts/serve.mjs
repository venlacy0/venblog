import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

/* ─── MIME 类型映射 ─── */

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
]);

/* ─── 安全路径解析 ─── */

function safePathFromUrl(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const cleaned = decoded.split("?")[0].split("#")[0];
  const normalized = path.posix
    .normalize(cleaned.replace(/\\/g, "/"))
    .replace(/^(\.\.(\/|\\|$))+/, "");

  if (normalized === "/" || normalized === ".") return "index.html";
  return normalized.replace(/^\//, "");
}

/* ─── 静态服务器核心 ─── */

/**
 * 启动静态文件服务器
 * @param {string} rootDir - 静态文件根目录
 * @param {number} port - 监听端口
 * @returns {http.Server} 服务器实例
 */
export function startServer(rootDir, port = 5173) {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = req.url || "/";
      const rel = safePathFromUrl(urlPath);
      const abs = path.join(rootDir, rel);

      const stat = await fs.stat(abs).catch(() => null);
      if (!stat) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
        return;
      }

      if (stat.isDirectory()) {
        const indexAbs = path.join(abs, "index.html");
        const indexStat = await fs.stat(indexAbs).catch(() => null);
        if (!indexStat || !indexStat.isFile()) {
          res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
          res.end("403 Forbidden");
          return;
        }
        const buf = await fs.readFile(indexAbs);
        res.writeHead(200, { "content-type": mime.get(".html") });
        res.end(buf);
        return;
      }

      const ext = path.extname(abs).toLowerCase();
      const type = mime.get(ext) || "application/octet-stream";
      const buf = await fs.readFile(abs);
      res.writeHead(200, { "content-type": type });
      res.end(buf);
    } catch {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("500 Server Error");
    }
  });

  server.listen(port, "127.0.0.1");
  return server;
}

/**
 * 启动开发服务器（带文件监听 + 自动重建）
 * @param {string} rootDir - 项目根目录
 * @param {object} options - 配置项
 * @param {number} options.port - 监听端口（默认 5173）
 * @param {boolean} options.open - 是否自动打开浏览器（默认 true）
 * @param {boolean} options.initialBuild - 是否先执行一次构建（默认 true）
 * @param {function} options.onBuild - 构建回调
 * @param {function} options.onLog - 日志回调
 */
export async function startDevServer(rootDir, options = {}) {
  const {
    port = 5173,
    open = true,
    initialBuild = true,
    onBuild,
    onLog,
  } = options;

  const log = onLog || console.log;

  // 初始构建
  if (initialBuild && onBuild) {
    await onBuild();
  }

  // 启动静态服务器
  const server = startServer(rootDir, port);
  const url = `http://127.0.0.1:${port}/`;

  server.on("listening", () => {
    log(`服务器已启动: ${url}`);

    // 自动打开浏览器
    if (open) {
      openBrowser(url);
    }
  });

  // 文件监听（动态导入 chokidar，仅在 serve 时使用）
  const { watch } = await import("chokidar");

  const watchPaths = [
    path.join(rootDir, "posts", "*.md"),
    path.join(rootDir, "styles.css"),
    path.join(rootDir, "main.js"),
    path.join(rootDir, "post.js"),
    path.join(rootDir, "theme.js"),
  ];

  let building = false;
  let pendingBuild = false;

  async function rebuild(changedPath) {
    if (building) {
      pendingBuild = true;
      return;
    }
    building = true;

    const rel = path.relative(rootDir, changedPath);
    log(`文件变更: ${rel}`);

    try {
      if (onBuild) await onBuild();
      log("重新构建完成");
    } catch (err) {
      log(`构建出错: ${err.message}`);
    }

    building = false;
    if (pendingBuild) {
      pendingBuild = false;
      await rebuild(changedPath);
    }
  }

  const watcher = watch(watchPaths, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  watcher.on("change", rebuild);
  watcher.on("add", rebuild);
  watcher.on("unlink", rebuild);

  return { server, watcher, url };
}

/* ─── 打开浏览器（跨平台） ─── */

function openBrowser(url) {
  const platform = process.platform;

  let cmd;
  if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, () => {
    /* 忽略错误，浏览器打不开不影响服务器 */
  });
}

/* ─── 直接运行兼容 ─── */

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] === thisFile) {
  const port = Number.parseInt(process.env.PORT || "5173", 10);
  const rootDir = process.cwd();
  const server = startServer(rootDir, port);
  server.on("listening", () => {
    console.log(`Serving ${rootDir} at http://127.0.0.1:${port}/`);
  });
}
