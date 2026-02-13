# Venblog

轻量级静态博客 CLI —— Markdown 驱动，零框架，编辑杂志风格。

## 特性

- **Markdown 驱动** — 写 `.md`，构建时渲染为静态 HTML，零运行时依赖
- **数学公式** — 支持 `$...$` 行内与 `$$...$$` 块级 KaTeX 渲染
- **GFM 扩展** — 表格、任务列表、删除线等 GitHub Flavored Markdown 语法
- **滚动与交互** — 首页视差、叙事时间轴切换、键盘导航，尊重 `prefers-reduced-motion`
- **阅读增强** — 文章页进度条、代码语言标签、滚动揭示动画
- **开发服务器** — 文件监听 + 自动重建，改完即见
- **一键部署** — `venblog deploy` 自动构建并推送到 Git 远程仓库

## 快速开始

```bash
npm install
npm run build
npm run serve
```

打开 `http://127.0.0.1:5173/` 预览。

## 运行方式（推荐）

不依赖全局安装，克隆到任意设备都能直接跑：

```bash
npm run build
npm run serve
npm run new -- "文章标题"
```

也可以直接用 Node 调 CLI（等价）：

```bash
node cli.mjs build
node cli.mjs serve
node cli.mjs new "文章标题"
```

## 安装 venblog 命令（可选）

如果你希望在终端里直接用 `venblog ...`（不通过 `npm run`），需要全局安装/链接：

```bash
# 从源码全局安装（常用；如果你移动/删除源码目录，重新装一次即可）
npm install -g .
```

开发调试可用：

```bash
# 从当前目录创建全局软链接（移动/删除目录会导致链接失效）
npm link
```

如果你想让全局安装与源码目录完全解耦，可以先打包再安装：

```bash
npm pack
# 用上一步输出的 .tgz 文件名替换这里
npm install -g ./venblog-<version>.tgz
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `venblog new <title>` | 创建新博文（支持 `--tags`、`--date`） |
| `venblog build` | 编译所有 `posts/*.md` 为 HTML 并生成首页 |
| `venblog serve` | 启动开发服务器（支持 `--port`、`--no-open`） |
| `venblog list` | 列出所有博文（支持 `--json`） |
| `venblog clean` | 清理所有生成文件 |
| `venblog deploy` | 构建并推送到远程仓库（支持 `-m` 自定义提交信息） |
| `venblog init [dir]` | 初始化新博客项目 |

也可通过 npm scripts 使用：`npm run build`、`npm run serve`、`npm run new`、`npm run list`、`npm run clean`。

## 常见问题

### PowerShell 报错：Cannot find module ...\npm\node_modules\venblog\cli.mjs

这是典型的“全局 venblog 链接失效”（常见于之前 `npm link` 过，但后来移动/删除了原目录）。修复方式：

```bash
npm unlink -g venblog
npm install -g .
```

如果你不想动全局环境，直接在项目目录用 `npm run build/serve` 或 `node cli.mjs ...` 即可。

### PowerShell 报错：venblog.ps1 无法加载，因为禁止运行脚本

这是 PowerShell 的执行策略限制。你有三种选择：

```bash
# 1) 直接调用 .cmd shim（不依赖 PowerShell 脚本执行权限）
venblog.cmd build
```

```powershell
# 2) 仅对当前用户放开脚本执行（会修改本机设置）
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

```bash
# 3) 不使用全局 venblog，改用项目内命令（最稳）
npm run build
```

### 终端提示：venblog 不是命令 / 找不到命令

说明你没有全局安装 venblog。直接用项目内命令即可，或者按上面的“安装 venblog 命令（可选）”安装。

### Node 版本过低

本项目要求 Node.js `>= 18`。升级 Node 后重新执行 `npm install`。

## 写博文

1. 创建文章：`npm run new -- "文章标题"`（或手动在 `posts/` 下新建 `.md` 文件）
2. 支持 YAML frontmatter：

```markdown
---
title: 文章标题
date: 2026-02-08
tags: 技术, 随笔
---

正文内容...
```

3. 运行 `npm run build`，文章会编译为同名 `.html` 文件，首页自动更新

## 项目结构

```
├── cli.mjs              # CLI 入口
├── main.js              # 首页滚动动效
├── post.js              # 文章页增强（进度条、揭示动画）
├── styles.css           # 全局样式（杂志风格）
├── lib/
│   ├── log.mjs          # 日志工具
│   └── commands/        # CLI 子命令实现
├── scripts/
│   ├── build.mjs        # 构建脚本（Markdown → HTML）
│   └── serve.mjs        # 开发服务器
├── posts/               # 博文源文件（.md）及编译产物（.html）
├── vendor/katex/        # KaTeX 资源（构建时生成）
└── index.html           # 首页（构建时生成）
```

## 技术栈

- **Markdown 处理**：unified + remark + rehype 管道
- **数学公式**：KaTeX（构建时渲染，非客户端）
- **CLI 框架**：Commander.js
- **文件监听**：chokidar
- **排版**：Libre Baskerville + Cormorant Garamond
- **色彩**：米黄底（#f3f1ea）+ 铁红强调（#c1542c）

## License

MIT
