# Venblog

轻量级静态博客 CLI —— Markdown 驱动，零框架，编辑杂志风格。

## 特性

- **Markdown 驱动** — 写 `.md`，构建时渲染为静态 HTML，零运行时依赖
- **数学公式** — 支持 `$...$` 行内与 `$$...$$` 块级 KaTeX 渲染
- **GFM 扩展** — 表格、任务列表、删除线等 GitHub Flavored Markdown 语法
- **滚动动效** — 首页视差、卡片轨道、路径绘制，尊重 `prefers-reduced-motion`
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

## 写博文

1. 创建文章：`venblog new "文章标题"` 或手动在 `posts/` 下新建 `.md` 文件
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
