# 决策记录

## 目标

- 首屏：只在页面正中展示一行 `Venlacy's Blog`
- 向下滚动：从左侧“画出”一根横跨两侧的悬链线
- 然后：一个方块沿着线从右侧滑向页面正中，作为一篇博客入口

## 关键决策

- 技术栈：纯静态（HTML/CSS/JS），运行时零依赖；构建阶段用 npm 做 Markdown 静态渲染
- 悬链线表现：使用 SVG path（三次贝塞尔曲线）近似悬链线形态
- “从左侧出现”：用 `stroke-dasharray/stroke-dashoffset` 做路径绘制动画
- 方块沿线移动：用 `getPointAtLength()` 按路径长度取点，并随滚动更新位置
- 可访问性：支持 `prefers-reduced-motion`，减少动态效果
- 视觉约束：线条贯穿全宽，去掉两端圆点装饰
- 内容组织：博文使用 `posts/*.md`，通过 `npm run build` 生成同名 `posts/*.html`（支持 KaTeX 数学公式）

## 风险与约束

- 由于采用 `preserveAspectRatio="none"` 拉伸 SVG，在极端纵横比下曲线形态会有轻微变形
- 这是“原型发布”，后续如要做真实博客系统（文章列表、路由、构建、MDX），需要再引入内容管理与构建链
