This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# 前端核心功能
❯ 1

✻ Sautéed for 52m 57s

❯ 如何运行看效果？

  Thought for 5s

两步搞定：

1. 进入前端目录，启动 mock 模式（无需后端）：

cd /Users/tongqianwen/ExpProjects/learn/good-sit/frontend
NEXT_PUBLIC_USE_MOCK=true npm run dev

2. 打开浏览器访问：

┌──────────┬───────────────────────────────┐
│   页面   │             地址              │
├──────────┼───────────────────────────────┤
│ 落地页   │ http://localhost:3000         │
├──────────┼───────────────────────────────┤
│ 检测主页 │ http://localhost:3000/app     │
├──────────┼───────────────────────────────┤
│ 定价页   │ http://localhost:3000/pricing │
└──────────┴───────────────────────────────┘

---
在 /app 页面可以验证：
- 进入页面后显示「正在加载模型…」（按钮禁用）
- 模型加载完成后「开始检测」变为可点击
- 允许摄像头权限后，画面出现 + 骨架线叠加
- 故意弓腰 3 秒 → 红色文字警告出现
- 弓腰 5 秒 → 播放语音提示（需替换 public/audio/posture-alert.mp3 为真实录音）
- 环形图和时间轴实时更新
- 点击「停止检测」→ 弹出本次统计报表