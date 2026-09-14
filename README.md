# 深度玩家移动端前台（本地版）

这是基于 React 18、TypeScript、Vite、React Router 与 Lucide 构建的移动端 SPA。页面数据和图片均为本地 fixture，断网后仍可完成浏览、筛选、收藏、消息、订单和回收流程演示。

认证、支付、合同签署、账号资料、估价与验号均为本地演示，不会发送短信、连接真实账号、扣款或生成具有法律效力的合同。

原型数据和登录状态仅在当前页面会话内有效，刷新后恢复初始演示状态。每次重新打开或刷新页面，依次展示启动页 2 秒 → 隐私协议弹窗（等待用户操作）→ 同意后加载 2 秒 → 登录页；不因之前同意过协议而跳过弹窗。一键登录、验证码登录和密码登录均不校验输入内容，仅用于体验协议确认、验证码倒计时、成功反馈和原页面回跳。

## 在线预览

[GitHub Pages 公开预览](https://dh-1126.github.io/deepgamer-mobile-preview/)

在完整本地工程中执行 `pnpm release:prepare`，会强制完成类型检查、全部测试和生产构建，再生成 `release/site/` 与 SHA-256 校验清单。将用户端源码和 `release/` 一起提交并推送到 `main` 后，GitHub Actions 校验源码与产物一致性并发布；源码修改但未重新构建时会拒绝发布。

本地联动依赖相邻工程的共享协议、组件与测试夹具，因此当前采用本地验证构建、GitHub 托管部署的模式，不将后台工程或后台采集资料复制进公开仓库。完整测试和源代码构建需在原本地工程中运行。线上固定使用本地演示数据，不请求本机后台的标题配置接口；仍属于交互原型，没有接入真实支付、短信或交易服务。

发布子路径为 `/deepgamer-mobile-preview/`，包含 SPA 路由回退。后续发布命令：

```bash
pnpm release:prepare
pnpm release:verify
# 检查改动后，将用户端源码和 release/ 一起提交并推送 main。
```

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
