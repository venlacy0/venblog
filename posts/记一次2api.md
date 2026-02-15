---
title: 记一次2api
date: 2026-02-15
tags: [2api,网络,技术]
---

# 记一次2api

那天在cc中用anyrouter，然后突发奇想，寻思为什么不能在其他客户端使用anyrouter呢？

然后尝试了一下，发现会报错显示缺少claude code的请求头。

这简单呀！打开Reqable的终端，抓了一下cc的包，把请求头复制粘贴一下。重新请求了一边。

结果发现还是没法请求。然后在莹酱的指导下，发现请求头中需要一段系统提示词。

```
You are Claude Code, Anthropic's official CLI for Claude.
```

填上！搞定！

非常非常简单的2api，不过算是这辈子第一次2api！
