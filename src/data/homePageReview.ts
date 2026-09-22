export type HomeReviewSpecSection = {
  title: string
  items: string[]
}

export type HomeReviewPage = {
  nodeId: string
  screenName: string
  summary: string
  sections: HomeReviewSpecSection[]
}

export type HomeReviewState = {
  authenticated: boolean
  showFootprints: boolean
  downloadOpen: boolean
  followOpen: boolean
  readingSection?: 'top' | 'content' | 'feedback'
}

const prototypeBoundary: HomeReviewSpecSection = {
  title: '原型边界',
  items: ['APP 下载地址、公众号二维码和正式接口仍以业务配置为准；原型只展示明确的待配置反馈，不伪造下载、保存或接口成功。'],
}

export const HOME_REVIEW_PAGES: readonly HomeReviewPage[] = [
  {
    nodeId: '7144:1039',
    screenName: '首页 · 游客',
    summary: '游客首页默认状态，提供游戏浏览和平台介绍；需要账户能力的入口统一进入登录流程。',
    sections: [
      { title: '展示状态', items: ['不展示最近看过、消息数和交易待办数。', '页面底部显示登录浮条，首页导航保持选中。'] },
      { title: '主要操作', items: ['热门游戏、全部游戏和搜索进入公开浏览页面。', '客服、卖号、消息、我的、回收询价等受保护入口先进入登录页，关闭登录后回到首页。'] },
      { title: '页面对照', items: ['点击顶部状态栏任意位置，打开含 Figma 提示词和元素 Spec 的右侧页面说明。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '7146:1316',
    screenName: '首页 · 已登录',
    summary: '已登录且存在浏览足迹的首页顶部状态，显示最近看过和账户相关导航状态。',
    sections: [
      { title: '展示状态', items: ['顶部展示最近看过及全部足迹入口；不显示游客登录浮条。', '消息和交易入口可展示业务数量，具体数值由实际数据决定。'] },
      { title: '主要操作', items: ['最近看过条目进入对应游戏，全部足迹进入足迹列表。', '客服、卖号、回收询价、消息和我的直接进入登录后的业务页面。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '7146:1627',
    screenName: '首页 · 已登录无足迹',
    summary: '已登录但没有有效浏览足迹的首页状态，热门游戏区域自然上移。',
    sections: [
      { title: '展示状态', items: ['隐藏最近看过标题、卡片和全部足迹入口。', '保留已登录导航状态，不显示游客登录浮条。'] },
      { title: '数据规则', items: ['足迹为空、无可展示记录或联调数据尚未返回有效足迹时使用该状态。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '7146:1913',
    screenName: '首页 · APP 下载引导',
    summary: '游客点击首页品牌后展开 APP 下载引导，再次点击品牌可收起。',
    sections: [
      { title: '进入与离开', items: ['点击品牌区域展开；再次点击同一区域收起。', '展开与收起不改变游客身份和当前首页滚动位置。'] },
      { title: '主要操作', items: ['当前原型点击“立即下载”显示“APP下载地址暂未开放，请继续使用网页版”，提示约 2.5 秒后消失；正式下载需后续接入实际地址。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '7146:2213',
    screenName: '首页 · 完整内容',
    summary: '首页长内容阅读状态，包含平台主张、交易特点、吐槽广场与共创入口。',
    sections: [
      { title: '内容结构', items: ['“关于深度玩家”以下依次展示品牌主张、为什么做、交易特点、许愿共创和品牌收尾。', '页面内容保持单列阅读节奏，底部导航不遮挡最后内容。'] },
      { title: '主要操作', items: ['吐槽广场整卡及三项共创服务打开同一微信服务号引导。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '7149:2434',
    screenName: '首页 · 吐槽广场',
    summary: '滚动至吐槽广场后的对照状态，重点说明反馈卡片和共创入口。',
    sections: [
      { title: '主要操作', items: ['点击吐槽广场卡片任意有效区域打开微信服务号引导。', '吐槽服务、产品建议、社区共建使用同一引导流程。'] },
      { title: '可访问性', items: ['入口使用真实按钮，键盘可聚焦并触发；卡片文案和右侧说明保持对齐。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '7150:2655',
    screenName: '首页 · 微信服务号引导',
    summary: '从吐槽广场或共创入口打开的底部引导层，背景首页保持当前状态。',
    sections: [
      { title: '进入与离开', items: ['点击吐槽广场或三项共创入口打开。', '点击关闭按钮、遮罩或按 Escape 返回原首页位置，并把焦点还给触发入口。'] },
      { title: '主要操作', items: ['展示公众号说明、二维码区域和保存操作。', '二维码未配置时使用明确占位；点击保存显示不可保存提示。'] },
      { title: '交互约束', items: ['引导层打开时背景内容不可操作；页面说明面板仍可独立查看。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '7152:2932',
    screenName: '首页 · 已登录 · 下载引导',
    summary: '已登录且有足迹时展开 APP 下载引导，保留最近看过与登录态。',
    sections: [
      { title: '状态保持', items: ['展开下载引导不改变登录态、最近看过数据和导航数量。', '收起后恢复已登录首页顶部布局。'] },
      { title: '主要操作', items: ['“立即下载”遵循真实下载配置；未配置时只展示待开放提示。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '7152:3256',
    screenName: '首页 · 无足迹 · 下载引导',
    summary: '已登录无足迹时展开 APP 下载引导，热门游戏继续作为主要内容入口。',
    sections: [
      { title: '状态保持', items: ['下载引导展开期间仍隐藏最近看过，不生成演示足迹。', '收起后恢复已登录无足迹首页。'] },
      { title: '主要操作', items: ['“立即下载”遵循真实下载配置；未配置时只展示待开放提示。'] },
      prototypeBoundary,
    ],
  },
]

export function resolveHomeReviewNodeId(state: HomeReviewState): string {
  if (state.followOpen) return '7150:2655'
  if (state.downloadOpen) {
    if (!state.authenticated) return '7146:1913'
    return state.showFootprints ? '7152:2932' : '7152:3256'
  }
  if (state.readingSection === 'feedback') return '7149:2434'
  if (state.readingSection === 'content') return '7146:2213'
  if (!state.authenticated) return '7144:1039'
  return state.showFootprints ? '7146:1316' : '7146:1627'
}
