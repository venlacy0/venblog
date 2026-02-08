# Venlacy's Blog

这是一个纯静态站点，用 `index.html + styles.css + main.js` 实现首屏极简与滚动动效；文章内容用 Markdown 驱动并通过 npm 在构建阶段静态渲染成 HTML。

## 本地预览

安装依赖并构建：

```powershell
npm install
npm run build
```

启动本地静态服务器：

```powershell
npm run serve
```

打开 `http://127.0.0.1:5173/`。

## Markdown 博文（静态渲染）

- 把文章放在 `posts/`，扩展名必须是 `.md`
- 文章标题：默认使用文件名（去掉 `.md`）
- 文章正文：`npm run build` 会把 `posts/*.md` 编译为同名 `posts/*.html`
- 数学公式：支持 `$...$`（行内）与 `$$...$$`（块级），渲染为 KaTeX

首页的动效卡片链接在 `index.html` 里，默认指向 `posts/从零开始.html`。

构建脚本：`scripts/build.mjs`。
