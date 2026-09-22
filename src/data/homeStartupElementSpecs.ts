import type { PageElementSpec } from './pageElementSpec'
import { STARTUP_REVIEW_PAGES } from './startupPageReview'

const homeShell: PageElementSpec = {
  name: '首页品牌头部与客服入口',
  component: 'HomePage 的 home-v2-top、home-draft3-brand-button 与客服原生按钮',
  visual: '黄色品牌头部内左侧为平台品牌标记、平台名和副标题，右侧为黑色圆形客服图标按钮。',
  dimensions: '页面最大宽度 393px；默认头部高 160px并含顶部 44px 状态区；内容左右内边距 16px；品牌按钮高 40px、标记 29×30px；客服按钮 38×38px、图标 17×17px。',
  typography: '页面字体继承 Noto Sans SC、PingFang SC、Microsoft YaHei；品牌名 16px、字重 900、高 22px；副标题 12px、字重 700、高 18px。',
  interaction: '品牌按钮切换 APP 下载条并通过 aria-expanded、aria-controls 暴露状态；客服入口未登录时触发登录要求，已登录时进入客服推荐会话。键盘焦点使用首页统一可见轮廓。',
  ui: '品牌文本单行省略，按钮占据客服按钮之外的剩余宽度；黄色、黑色和白色形成首页主视觉。',
  dataSource: 'HomePage.tsx 的 downloadOpen 本地状态、useAuthPrompt 与 SUPPORT_RECOMMENDATION_ROUTE；品牌和客服图标来自 public/assets/home-draft3 与 public/assets/home-v2。',
  dataContent: '固定展示“深度玩家”“玩家自己的游戏交易平台”；客服跳转是否直接放行由当前认证状态决定，不在组件内伪造客服数据。',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/global.css', 'src/styles/home-draft3.css'],
}

const homeSearch: PageElementSpec = {
  name: '首页搜索入口',
  component: 'HomePage 的 home-v2-search 原生按钮',
  visual: '白色圆角搜索条置于黄色头部下方，左侧搜索图标，右侧显示一行示例搜索词。',
  dimensions: '宽度 100%，高度 46px，水平内边距 16px，图文间距 10px，圆角 14px；图标 19×19px。',
  typography: '示例搜索词 14px / 17px、字重 400；字体继承首页字体栈，超长内容单行省略。',
  interaction: '点击或键盘激活后导航到 /search；整个搜索条都是按钮点击区域。',
  ui: '白底、#a5a5a4 辅助文字及轻阴影，使搜索入口从黄色品牌区中浮起。',
  dataSource: 'HomePage.tsx 的 navigate("/search")；图标来自 public/assets/home-v2/search.svg。',
  dataContent: '当前静态占位词为“王者 108英雄 王者段位 500-1500”；本入口不发起搜索请求。',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/global.css'],
}

const popularGames: PageElementSpec = {
  name: '热门游戏宫格',
  component: 'HomePage 的 home-v2-block-title 与 home-v2-games 按钮宫格',
  visual: '“热门游戏”标题与“全部游戏”入口同排，下方为四列两行游戏封面和名称。',
  dimensions: '标题行高 53px；宫格高 228px，4 列、2 行，每行 110px，列间距 8px、行间距 8px；封面宽度 min(84px, 100%)、1:1、圆角 14px。',
  typography: '标题 17px / 20px、字重 800；全部游戏 12px / 14px；游戏名 12px / 14px、字重 700并单行省略。',
  interaction: '游戏按钮进入 /game?gameCode=对应代码；“全部游戏”进入 /game/select?current=wzry。所有项目使用真实 button。',
  ui: '封面保持正方形裁切；窄屏仍维持四列，项目名和按钮宽度允许收缩，避免横向滚动。',
  dataSource: '非联调模式读取 homeData.ts 的 homeGames；联调模式读取 useLinkedState().games，筛选 ACTIVE、按 sortOrder 排序并由 toCatalogGame 转换。',
  dataContent: '本地原型共 8 项：王者荣耀、和平精英、三角洲、原神、第五人格、超自然行动组、和平精英重复展示项、英雄联盟；联调模式以有效游戏列表为准。',
  evidence: ['src/pages/HomePage.tsx', 'src/data/homeData.ts', 'src/linked/linkedData.ts', 'src/styles/global.css'],
}

const inquiry: PageElementSpec = {
  name: '回收商询价行动卡',
  component: 'HomePage 的 home-v2-inquiry 原生按钮',
  visual: '深黑色横向行动卡，左侧为两行利益点，右侧为描边“立即询价”按钮式区域，“直接卖给回收商”使用黄色强调。',
  dimensions: '宽度 100%，高度 64px，上外边距 16px，左右内边距 16px/14px，圆角 14px；右侧行动区 82×34px、圆角 8px。小于 350px 时左右内边距 12px、行动区宽 76px。',
  typography: '主文案 15px / 18px、字重 800；说明 11px / 13px；行动文字 13px / 16px、字重 800；小于 350px 时主文案 13px、说明 9px。',
  interaction: '整卡点击后请求进入 /sell；未登录显示“登录后继续卖号”的认证提示，已登录直接进入卖号流程。',
  ui: '黑底白字承担主要转化，黄色只强调直接回收利益点，右侧描边区域不创建嵌套按钮。',
  dataSource: 'HomePage.tsx 的 openProtected、useAuthPrompt 与固定 /sell 路由。',
  dataContent: '固定展示“不想等买家？直接卖给回收商”“多家回收商报价，先询价再决定”“立即询价”；真实报价不在首页加载。',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/global.css', 'src/styles/home-draft3.css'],
}

const bottomNav: PageElementSpec = {
  name: '首页底部主导航',
  component: '共享 BottomNav / BottomNavView，variant="home"、fixed 布局',
  visual: '白色固定底栏分为首页、买号、黄色圆形“卖”、消息、我的五等分入口；首页使用深色选中态。',
  dimensions: '底栏宽度 min(393px, 100%)、高度 66px、五等分；普通入口高 48px、顶部内边距 8px；图标 23×23px；卖号圆形按钮 46×46px。',
  typography: '普通标签 10px / 12px、字重 500，选中态 700；“卖”17px / 17px、字重 900；字体继承共享导航字体栈。',
  interaction: '首页和买号可直接导航；卖、消息、我的需要认证。键盘焦点显示 2px 轮廓，当前首页通过 aria-current="page" 标识。',
  ui: '顶部 0.631px 分隔线与轻阴影区分内容；消息和我的仅在计数大于 0 时显示徽标。',
  dataSource: 'BottomNav.tsx 组装路由；useMessageUnreadCount 提供消息未读数，usePendingOrderSummary.totalPendingCount 提供个人中心待办数，useAuthStatus/useAuthPrompt 控制权限。',
  dataContent: '固定五个导航标签与路由；游客不显示业务计数，登录态计数以共享 hooks 当前数据为准。',
  evidence: ['src/components/BottomNav.tsx', 'src/components/bottom-nav.css'],
}

const guestLoginBar: PageElementSpec = {
  name: '游客登录浮条',
  component: '共享 LoginFloatingBar，home-draft3-login-bar--dark',
  visual: '底部导航上方的半透明黑色浮条，左侧红包符号，中间单行权益文案，右侧黄色登录按钮。',
  dimensions: '固定宽度 min(361px, 视口宽度减 32px)、高度 50px、底部距导航 74px加安全区；内边距 7px 12px、间距 8px、圆角 14px；登录按钮 68×36px。',
  typography: '权益文案 12px / 15px、字重 700、单行省略；登录按钮 14px / 17px、字重 800；继承 Noto Sans SC 等共享字体。',
  interaction: '仅游客显示；点击登录构造 one_tap 登录路由，并把当前 pathname、search、hash 同时作为返回页和关闭页。',
  ui: '浮条 z-index 49、底栏 z-index 50；首页为它把尾部滚动占位从 66px 增至 124px，避免遮挡长内容。',
  dataSource: 'HomePage.tsx 的 useAuthStatus 与 currentPath；LoginFloatingBar.tsx 的 buildLoginRoute。',
  dataContent: '固定展示“人人都是深度玩家，登陆领取更多优惠”和“登录”；不展示虚构优惠金额。',
  evidence: ['src/pages/HomePage.tsx', 'src/components/LoginFloatingBar.tsx', 'src/styles/login-floating-bar.css', 'src/styles/global.css'],
}

const footprints: PageElementSpec = {
  name: '最近看过足迹区',
  component: 'HomePage 的 home-v2-recent 与“全部足迹”按钮',
  visual: '“最近看过”标题下为两列横向小卡，卡内含 36px 游戏封面、名称和浏览数量。',
  dimensions: '标题行高 51px；足迹区高 56px、两列、间距 5px；卡片高 56px、水平内边距 11px、间距 10px、圆角 14px；封面 36×36px、圆角 8px。小于 350px 时封面 32×32px。',
  typography: '名称 14px / 17px、字重 700；足迹说明 11px / 14px、上间距 3px；两者均单行省略，小于 350px 时说明为 9px。',
  interaction: '足迹卡进入对应游戏；“全部足迹”通过受保护入口进入 /footprints。',
  ui: '只在已登录、本地数据模式、有 recentGames 且查询参数 footprints 不等于 empty 时显示；隐藏后发现区高度由 484px 收为 382px，热门游戏自然上移。',
  dataSource: 'HomePage.tsx 的 showFootprints 条件与 openZone/openProtected；原型内容来自 homeData.ts 的 recentGames。联调模式当前明确隐藏本地足迹，等待真实足迹契约。',
  dataContent: '本地证据 C 展示王者荣耀“看过 12 个”和和平精英“看过 3 个”；无足迹节点不得生成演示记录。',
  evidence: ['src/pages/HomePage.tsx', 'src/data/homeData.ts', 'src/styles/global.css', 'src/styles/home-draft3.css'],
}

const noFootprints: PageElementSpec = {
  name: '无足迹内容编排',
  component: 'HomePage 的 home-v2-discovery--empty 状态类',
  visual: '不渲染“最近看过”标题、全部足迹入口和足迹卡，热门游戏标题紧接头部后的发现区顶部。',
  dimensions: '发现区高度从有足迹时的 484px 收为 382px；仍保留左右 16px内边距，热门标题 53px、宫格 228px和询价卡 64px。',
  typography: '没有额外空状态文字；热门游戏和询价区继续使用其各自字号，页面字体继承首页字体栈。',
  interaction: '不存在不可用的足迹按钮；用户仍可使用热门游戏、全部游戏和询价入口。',
  ui: '这是内容缺省编排而非空白占位卡，减少无数据时的无效高度，也不伪造最近浏览。',
  dataSource: 'HomePage.tsx 的 showFootprints=false 分支；条件来自认证状态、dataMode、recentGames 长度及 footprints=empty 预览参数。',
  dataContent: '该状态明确无可展示足迹；其余热门游戏数据仍按本地或联调模式规则读取。',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/home-draft3.css'],
}

const downloadBanner: PageElementSpec = {
  name: 'APP 下载展开条与反馈',
  component: 'HomePage 的 home-draft3-download aside、下载按钮与 role="status" 消息',
  visual: '品牌头部内展开浅黄色横条，依次显示 APP 图标、体验提示和黄色“立即下载”按钮；点击后在条下显示深色状态消息。',
  dimensions: '展开后头部高 216px；下载条高 40px、上下外边距 8px、左右延伸 16px、内边距 8px 12px、间距 10px；图标 23×24px；按钮高 24px、水平内边距 8px、圆角 6px。',
  typography: '体验提示 12px / 16px、字重 700；下载按钮 12px / 14px、字重 700；反馈消息 12px / 18px并居中，字体继承首页字体栈。',
  interaction: '点击品牌切换展开/收起并清空旧消息；点击立即下载只显示待开放提示，消息约 2.5 秒后自动清除。role="status" 向辅助技术播报。',
  ui: '当前没有正式下载地址，使用明确反馈而非伪造成功；收起保持登录身份、足迹和滚动位置。',
  dataSource: 'HomePage.tsx 的 downloadOpen、downloadMessage 本地状态和 2500ms 清理 effect；资源来自 public/assets/home-draft3/download-brand.svg。',
  dataContent: '固定展示“深度玩家APP体验更好”“立即下载”；当前反馈为“APP下载地址暂未开放，请继续使用网页版”，正式地址待业务配置。',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/home-draft3.css'],
}

const manifesto: PageElementSpec = {
  name: '品牌主张与平台介绍',
  component: 'home-v2-about-divider、home-v2-manifesto 与 Heading hero',
  visual: '分隔线引出“关于深度玩家”，浅灰内容块内依次为 DeepGamer、黄色高亮主标题、品牌说明、共建主张和羊驼形象。',
  dimensions: '分隔区高 39px；主张区高 433px、顶部/水平内边距 32px/20px；标题高 85px；底部图文区高 159px；羊驼容器 151×151px，图片 149×149px。小于 350px 时横向内边距 16px、图片 136×136px。',
  typography: 'DeepGamer 11px / 13px、字重 700、字距 3px；主标题 34px / 42.5px、字重 900；正文 14px / 25.9px；共建文案 12px / 20.4px。',
  interaction: '纯阅读内容，无独立点击行为；IntersectionObserver 进入该区域后把说明节点切换为“首页 · 完整内容”。',
  ui: '单列大字叙事，关键词以 #ffe62a 高亮；羊驼图按 cover 裁切，并保留替代文本“深度玩家羊驼形象”。',
  dataSource: 'HomePage.tsx 内固定品牌文案与 public/assets/home-draft3/manifesto-mascot.png；readingSection 由 aboutRef 的 IntersectionObserver 更新。',
  dataContent: '展示“属于玩家自己的交易平台”、平台缘起和“玩家不是用户，是共建者”；当前为产品品牌静态内容。',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/global.css', 'src/styles/home-draft3.css'],
}

const principleCards: PageElementSpec = {
  name: '为什么做深度玩家',
  component: 'SectionHeading 与 home-v2-principle-list 文章列表',
  visual: '编号 01 与标题共用下分隔线，副标题下排列三张白色描边原则卡；标题前有黄色圆点。',
  dimensions: '区块高 419px、顶部内边距 34px、左右 16px；标题主行高 39px，副标题区高 50px；卡片最小高 82px，末卡最小高 105px，内边距 14px 16px，卡间距 10px、圆角 12px。',
  typography: '编号 22.4px / 28px、Inter/Arial、字重 900；区标题 18px / 22px、字重 800；副标题 14px / 25.2px；卡题 16px / 19px、字重 800；详情 13px / 23px。',
  interaction: '纯阅读卡片，无点击或网络请求；语义上使用 section、article、h2、h3。',
  ui: '白卡与浅灰页面背景形成层级，黄色圆点统一品牌强调；窄于 350px 时区标题降为 16px。',
  dataSource: 'HomePage.tsx 映射 homeData.ts 的 principles 静态数组。',
  dataContent: '三项原则为“不割韭菜”“站玩家这边”“跟玩家一起做”及对应说明。',
  evidence: ['src/pages/HomePage.tsx', 'src/data/homeData.ts', 'src/styles/global.css'],
}

const featureCards: PageElementSpec = {
  name: '交易特点卡片网格',
  component: 'SectionHeading 与 home-v2-feature-grid 文章网格',
  visual: '编号 02 标题下以两列白色描边卡展示六项交易能力。',
  dimensions: '区块高 417px、顶部内边距 34px、左右 16px；两列网格，列间距 10px、行间距 12px；前两卡最小高 74px，后四卡最小高 94px；内边距 14px、圆角 12px。',
  typography: '编号与章节标题沿用 SectionHeading；卡题 14px / 17px、字重 700；详情 12px / 20.4px。',
  interaction: '纯阅读卡片，无点击行为；页面滚动保留底部导航避让空间。',
  ui: '两列等宽网格压缩长内容；小于 350px 时卡片水平内边距降到 10px。',
  dataSource: 'HomePage.tsx 映射 homeData.ts 的 tradeFeatures 静态数组。',
  dataContent: '六项为极速售后、7×24 玩家客服、找回/人脸保障、更合理的手续费、帮买家压价、打击黑号。',
  evidence: ['src/pages/HomePage.tsx', 'src/data/homeData.ts', 'src/styles/global.css'],
}

const feedbackCard: PageElementSpec = {
  name: '吐槽广场整卡入口',
  component: 'home-v2-feedback、共享 Button secondary sm 与 home-draft3-feedback-trigger',
  visual: '编号 03 区域内的黄色反馈卡包含标题、问题引导、72px 羊驼形象、深色“去吐槽”按钮和辅助文案。',
  dimensions: '许愿区最小高 495px；反馈卡内边距 16px，两列为剩余宽度与 72px，间距 12px、圆角 16px；羊驼框 72×72px；小号按钮高 36px、水平内边距 14px。',
  typography: '卡题 17px / 24px、字重 700；正文 14px / 22px；辅助文案 12px / 18px；按钮 13px并继承共享按钮字重 600。',
  interaction: '按钮的 ::after 点击层覆盖整张卡，点击或键盘激活打开微信服务号引导；aria-haspopup="dialog" 标明结果。active 时禁用缩放以保持覆盖层坐标。',
  ui: '品牌黄色作为高关注反馈入口；羊驼图片容器隐藏溢出，图片 64×96px并向右留 8px；装饰图使用空替代文本。',
  dataSource: 'HomePage.tsx 的 openFollow、followOpen 与触发器引用；图像来自 public/assets/home-draft3/feedback-mascot.png。',
  dataContent: '固定展示“吐槽广场”、难用/客服/新功能问题提示和“不满意？羊驼已经准备好替你吐口水了。”',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/global.css', 'src/styles/home-draft3.css', 'src/components/ui/components.css'],
}

const coCreationList: PageElementSpec = {
  name: '共创服务列表',
  component: 'home-v2-services 的三项原生按钮列表',
  visual: '白色描边圆角容器内纵向三行服务，每行左侧标题和说明，右侧箭头。',
  dimensions: '列表高 189px、上外边距 10px、边框 1px、圆角 12px；每行高 63px、水平内边距 16px；箭头 14×14px。',
  typography: '标题 14px / 17px、字重 700；说明 12px / 14px、上间距 3px；字体继承首页字体栈。',
  interaction: '每行都是 button，点击或键盘激活均调用 openFollow 打开同一服务号引导，并通过 aria-haspopup="dialog" 描述弹层结果。',
  ui: '行间使用 1px 分隔线，末行无分隔；点击目标占满整行。',
  dataSource: 'HomePage.tsx 映射 homeData.ts 的 coCreationServices，并共用 followOpen 本地状态。',
  dataContent: '三项固定内容为“吐槽服务 / 不满意？欢迎说。”“产品建议 / 好点子被采纳，有机会得到奖励。”“社区共建 / 平台文化，玩家一起定义。”',
  evidence: ['src/pages/HomePage.tsx', 'src/data/homeData.ts', 'src/styles/global.css'],
}

const closing: PageElementSpec = {
  name: '品牌收尾与底部避让',
  component: 'home-v2-closing 与 home-v2-nav-spacer',
  visual: '深黑色收尾区以白色三行主张、黄色分隔线和黄色大字结束长内容，下方白色占位保证固定导航不遮挡内容。',
  dimensions: '收尾区高 317px、上外边距 30px、顶部/水平内边距 34px/20px；黄色线 40×3px、上下外边距 24px；默认导航占位 66px，游客有浮条时增至 124px。',
  typography: '白色文案 22px / 38.5px、字重 700；黄色结语 26px / 37.7px、字重 900；继承首页字体栈。',
  interaction: '纯阅读区；继续向下滚动不会被固定底栏或游客浮条遮挡。',
  ui: '黑黄对比完成品牌叙事闭环，尾部间距根据游客浮条自动调整。',
  dataSource: 'HomePage.tsx 的固定品牌文案；global.css 的 home-v2-closing 和 :has(.guest-login-bar-home) 规则。',
  dataContent: '固定展示“我们来自玩家，依靠玩家，也为了玩家。每一个人，都可以成为深度玩家。”',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/global.css'],
}

const followSheet: PageElementSpec = {
  name: '微信服务号底部引导层',
  component: 'home-draft3-follow-layer、遮罩与 role="dialog" 的 section',
  visual: '半透明深色遮罩覆盖首页，白色圆角底部面板从下方进入；右上为关闭按钮，中间排列标题、说明、二维码占位、保存指引和黄色按钮。',
  dimensions: '图层限定在居中的 min(393px, 100%) 原型宽度内；面板最大高 100dvh、内边距 22px 24px及底部 30px加安全区、顶部圆角 22px；关闭按钮 24×24px。窄屏打开页面说明时，图层仅占上方 58dvh，面板最大高为 58dvh 减 44px。',
  typography: '标题 18px / 24px、字重 900；说明 13px / 16px；指引 12.5px / 22px；窄于 350px 标题降至 16px；字体继承首页字体栈。',
  interaction: '关闭按钮、遮罩或 Escape 关闭；打开时锁定 body 滚动并令背景 inert/aria-hidden，首个按钮自动获焦，Tab/Shift+Tab 在弹层内循环，关闭后焦点回到触发按钮。',
  ui: '面板使用 .24s ease-out 上移动画；系统 prefers-reduced-motion: reduce 时取消动画。背景页面保持原滚动和内容状态。',
  dataSource: 'HomePage.tsx 的 followOpen、followDialogRef、followTriggerRef 与键盘 effect；样式来自 home-draft3.css。',
  dataContent: '标题为“关注「深度玩家」微信服务号”，说明用于微信交易通知；当前二维码和保存能力均为明确占位。',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/home-draft3.css', 'src/components/ui/components.css', 'src/styles/design-prompt.css'],
}

const qrPlaceholder: PageElementSpec = {
  name: '公众号二维码占位与保存反馈',
  component: 'home-draft3-qr-placeholder、home-draft3-save-qr 与 role="status"',
  visual: '213px 白色描边二维码容器内为 180px 浅灰占位块；下方是识别指引和全宽黄色保存按钮，触发后显示灰色状态文字。',
  dimensions: '外框 213×213px、上外边距 20px、圆角 14px；内框 180×180px、圆角 6px；占位图标 34×34px；保存按钮宽 100%、高 48px、上外边距 20px、胶囊圆角。',
  typography: '占位说明 11.5px / 14px；保存按钮 15.5px、字重 900、字距 .4px；保存反馈 11px。',
  interaction: '点击“保存二维码到相册”不伪造保存，设置 followMessage 并由 role="status" 播报；关闭弹层时该消息随下一次 openFollow 被清空。',
  ui: '占位区域通过文字直接说明未配置，按钮保留最终能力的位置和触达尺寸。',
  dataSource: 'HomePage.tsx 的 followMessage 本地状态；占位图来自 public/assets/home-draft3/follow-qr-placeholder.svg。',
  dataContent: '当前提示为“公众号二维码占位”和“当前为设计稿二维码占位，暂不可保存”；正式二维码及下载文件待业务配置。',
  evidence: ['src/pages/HomePage.tsx', 'src/styles/home-draft3.css'],
}

const startupReference = (nodeId: string) => STARTUP_REVIEW_PAGES.find((page) => page.nodeId === nodeId)?.referenceNote
  ?? '当前启动状态没有独立 Figma 画板，沿用本地实现证据。'

const startupBrand = (nodeId: string): PageElementSpec => ({
  name: '启动品牌主体',
  component: 'WelcomePage 内共享 Brand 组件（auth-v2-brand）',
  visual: '全屏品牌黄色背景中央垂直排列平台品牌标记、深度玩家名称和平台副标题。',
  dimensions: '页面宽度 100%、最大 393px，最小高度 max(100dvh, 680px)；品牌容器铺满页面并居中，元素间距 16px；标记容器 82×82px，图片 78×82px。',
  typography: '页面继承 Noto Sans SC、PingFang SC、Microsoft YaHei；品牌名 30px、行高 1、字重 900、字距 2.5px；副标题 14px / 17px、字距 .8px。',
  interaction: '品牌主体本身无点击；启动页的计时逻辑在打开页面说明时暂停，关闭说明后由 WelcomePage effect 继续。',
  ui: `以当前品牌资产为实现证据 C；${startupReference(nodeId)}`,
  dataSource: 'AuthPage.tsx 的 Brand/WelcomePage；品牌图来自 public/assets/auth-draft3/brand-mark.svg；设计来源说明来自 startupPageReview.ts 的 referenceNote。',
  dataContent: '固定展示“深度玩家”和“一亿玩家自己的游戏平台”，不读取账号、设备或认证信息。',
  evidence: ['src/pages/AuthPage.tsx', 'src/styles/auth-v2.css', 'src/data/startupPageReview.ts'],
})

const startupFoot = (nodeId: string): PageElementSpec => ({
  name: '启动页底部品牌标语',
  component: 'WelcomePage 的 auth-v2-welcome-foot 段落',
  visual: '品牌黄色背景底部居中显示一行低对比度平台定位文案。',
  dimensions: '左右贴齐页面，底部距离为 37px加 env(safe-area-inset-bottom)；文本行高 14px。',
  typography: '11px / 14px、字重 400、字距 .4px；字体继承启动页字体栈。',
  interaction: '纯展示，不响应点击，也不影响启动计时。',
  ui: `颜色 #7d6c1e，在黄色背景上保持次级层级；${startupReference(nodeId)}`,
  dataSource: 'AuthPage.tsx WelcomePage 内的静态文案；定位和字号来自 auth-v2.css。',
  dataContent: '固定展示“深度玩家 · 玩家自己的交易平台”。',
  evidence: ['src/pages/AuthPage.tsx', 'src/styles/auth-v2.css', 'src/data/startupPageReview.ts'],
})

const startupSplashTransition: PageElementSpec = {
  name: '启动静态阶段与协议切换',
  component: 'WelcomePage 的 phase="splash" 状态及 useEffect 计时器',
  visual: '仅显示静态品牌主体和底部标语，不显示进度条、登录控件或错误提示。',
  dimensions: '静态阶段沿用最大 393px、最小高 max(100dvh, 680px) 的欢迎页容器；无额外布局盒。',
  typography: '只使用品牌主体 30px 标题、14px 副标题与底部 11px 标语，字体继承启动页。',
  interaction: 'phase 为 splash 且说明面板未打开时启动 2000ms 计时，结束后切换到 agreement；清理 effect 会取消旧计时器。',
  ui: `不创建独立加载视觉；${startupReference('startup:splash')}`,
  dataSource: 'AuthPage.tsx WelcomePage 的 phase/reviewOpen 本地状态、setTimeout 与 getWelcomeFigmaNodeId；referenceNote 来自 startupPageReview.ts。',
  dataContent: '此阶段不写入协议、不创建登录会话，也不读取真实启动进度。',
  evidence: ['src/pages/AuthPage.tsx', 'src/components/authModel.ts', 'src/data/startupPageReview.ts'],
}

const startupLoading: PageElementSpec = {
  name: '品牌 Logo 脉搏加载状态',
  component: 'WelcomePage 的 is-loading 状态、auth-v2-brand-mark 与视觉隐藏 Spinner',
  visual: '品牌页保持原布局，中央 Logo 每秒循环两次轻微放大后回落；没有可见的通用转圈图形。',
  dimensions: 'Logo 视觉仍为 78×82px；动画以中心为变换原点，关键帧最大 scale(1.12)，第二次 scale(1.06)，周期 1s。',
  typography: '可见品牌文字沿用 30px 标题和 14px 副标题；加载文本只供辅助技术读取，不参与视觉排版。',
  interaction: '进入 loading 且说明面板关闭时启动 2000ms 计时；完成后 authRepository.completeLaunch() 并 replace 导航到 /。prefers-reduced-motion: reduce 时取消脉搏动画。',
  ui: `通过品牌 Logo 动效表达加载，同时设置页面 aria-busy=true；${startupReference('startup:loading')}`,
  dataSource: 'AuthPage.tsx 的 phase/loading effect 与 authRepository.completeLaunch；Spinner 的可访问名称为“正在加载安全交易环境”；referenceNote 来自 startupPageReview.ts。',
  dataContent: '加载结束开放游客首页，不创建认证会话；当前 2 秒仅为原型计时，正式完成条件应由真实初始化流程决定。',
  evidence: ['src/pages/AuthPage.tsx', 'src/repository/authRepository.ts', 'src/styles/auth-v2.css', 'src/data/startupPageReview.ts'],
}

const startupError: PageElementSpec = {
  name: '协议状态保存失败与重试',
  component: 'WelcomePage 的 auth-v2-load-error role="alert" 与重试按钮',
  visual: '品牌黄色全屏错误层覆盖欢迎内容，中央垂直排列错误文字和黑底黄字重试按钮，按钮含 RotateCw 图标。',
  dimensions: '错误层绝对定位 inset: 0，内容居中、间距 14px；重试按钮高 40px、水平内边距 16px、图文间距 7px、圆角 12px；图标 15px。',
  typography: '错误区 14px、字重 700；按钮继承该字体设置和页面 Noto Sans SC 等字体栈。',
  interaction: 'authRepository.acceptInitialAgreement() 返回 false 时进入；role="alert" 立即播报错误。点击重试只把 phase 返回 agreement，让用户重新确认，不绕过协议完成启动。',
  ui: `错误层保持品牌黄色并使用高对比黑色行动按钮；${startupReference('startup:error')}`,
  dataSource: 'AuthPage.tsx 的 agree/error 分支；authRepository.acceptInitialAgreement 将同意记录写入配置的 storage；referenceNote 来自 startupPageReview.ts。',
  dataContent: '固定展示“协议状态保存失败”和“重试”；不显示存储异常详情、令牌或用户数据。',
  evidence: ['src/pages/AuthPage.tsx', 'src/repository/authRepository.ts', 'src/styles/auth-v2.css', 'src/data/startupPageReview.ts'],
}

const specsByNodeId: Record<string, PageElementSpec[]> = {
  '7144:1039': [homeShell, homeSearch, popularGames, inquiry, guestLoginBar, bottomNav],
  '7146:1316': [homeShell, homeSearch, footprints, popularGames, inquiry, bottomNav],
  '7146:1627': [homeShell, homeSearch, noFootprints, popularGames, inquiry, bottomNav],
  '7146:1913': [downloadBanner, homeShell, homeSearch, popularGames, inquiry, guestLoginBar, bottomNav],
  '7146:2213': [manifesto, principleCards, featureCards, feedbackCard, coCreationList, closing, bottomNav],
  '7149:2434': [feedbackCard, coCreationList, closing, bottomNav],
  '7150:2655': [followSheet, qrPlaceholder],
  '7152:2932': [downloadBanner, homeShell, homeSearch, footprints, popularGames, inquiry, bottomNav],
  '7152:3256': [downloadBanner, homeShell, homeSearch, noFootprints, popularGames, inquiry, bottomNav],
  'startup:splash': [startupBrand('startup:splash'), startupSplashTransition, startupFoot('startup:splash')],
  'startup:loading': [startupBrand('startup:loading'), startupLoading, startupFoot('startup:loading')],
  'startup:error': [startupError],
}

export function getHomeStartupElementSpecs(nodeId: string): PageElementSpec[] | undefined {
  return specsByNodeId[nodeId]
}
