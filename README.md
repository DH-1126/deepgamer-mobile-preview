# 深度玩家移动端前台（本地版）

这是基于 React 18、TypeScript、Vite、React Router 与 Lucide 构建的移动端 SPA。页面数据和图片均为本地 fixture，断网后仍可完成浏览、筛选、收藏、消息、订单和回收流程演示。

认证、支付、合同签署、账号资料、估价与验号均为本地演示，不会发送短信、连接真实账号、扣款或生成具有法律效力的合同。

登录状态仅在当前页面会话内有效：每次刷新都会依次展示启动页、加载页，再进入登录流程。一键登录、验证码登录和密码登录均不校验输入内容，仅用于体验协议确认、验证码倒计时、成功反馈和原页面回跳。

## 在线预览

[GitHub Pages 公开预览](https://dh-1126.github.io/deepgamer-mobile-preview/)

推送到 `main` 分支后，GitHub Actions 会自动完成类型检查、构建并发布。线上构建使用 `/deepgamer-mobile-preview/` 子路径，站内路由和静态资源均已适配。

## 运行

```bash
cd 代码/前端
pnpm install --offline
pnpm dev
```

默认地址：`http://localhost:5174/`。

无需修改 hosts，可直接使用 `http://m.deepgamer.localhost:5174/`。如需使用 `m.deepgamer.local`，可自行在 hosts 中添加：

```text
127.0.0.1 m.deepgamer.local
```

## 路由

- `/`、`/search`：首页与搜索
- `/game?gameCode=wzry`：指定游戏商品列表；游戏选择位于首页 `/#game-selection`，`/buy/game-zone` 保留为兼容入口
- `/goods/:id`、`/favorites`：商品详情与收藏管理
- `/welcome`、`/login`、`/privacy-policy`、`/user-agreement`、`/push-permission`：启动、登录、协议和推送引导
- `/orders`、`/orders/checkout`、`/orders/:id`、`/payment/cancel`、`/payment/success`：订单与本地支付状态
- `/message`、`/im/:conversationId`、`/fulfillment/contracts/:contractId`：消息、交易群与合同履约
- `/profile`：我的
- `/sell`、`/appraisal`、`/appraisal/detail`、`/appraisal/fill`、`/appraisal/loading`、`/sell/goods`：平台回收完整演示流程

以上路由由 Vite 的 SPA fallback 支持，开发服务下可直接刷新。

## 扩展页面

页面组件放在 `src/pages/`，通用组件放在 `src/components/`，在 `src/app/App.tsx` 注册新路由。领域类型、演示数据和数据适配器分别位于 `src/types/`、`src/data/`、`src/repository/`。接入真实 API 时应保持 repository 接口不变，逐个替换本地适配器。

## 校验

```bash
pnpm typecheck
pnpm build
pnpm test
```
