import type { AuthPageSpec } from './authPageSpecs'

export const STARTUP_REVIEW_PAGES: Array<AuthPageSpec & { screenName: string; referenceNote: string }> = [
  {
    nodeId: 'startup:splash', screenName: '启动页',
    summary: '展示平台品牌，随后进入启动协议确认。',
    referenceNote: 'Page7 当前没有独立启动画板。旧启动画板已无法访问，暂不生成不准确的 Figma 复刻链接；页面沿用当前品牌设计。',
    sections: [
      { title: '进入与跳转', items: ['重新启动原型时先展示品牌页，约 2 秒后显示协议确认。', '此阶段不会创建登录会话，也不会直接进入受保护页面。'] },
      { title: '页面对照', items: ['点击顶部状态栏任意位置，查看包含 Figma 来源的页面说明。', '阅读说明时暂停自动跳转，关闭页面说明后继续启动。'] },
    ],
  },
  {
    nodeId: 'startup:loading', screenName: '加载页',
    summary: '同意启动协议后展示品牌 Logo 脉搏动效，加载完成进入游客首页。',
    referenceNote: 'Page7 当前没有独立的品牌加载画板。此页沿用用户已确认的 Logo 脉搏动效；暂不使用协议弹窗或通用加载组件的链接代替整页设计。',
    sections: [
      { title: '进入条件', items: ['用户同意启动协议且同意状态保存成功后进入。', '加载期间不自动登录，不创建认证会话。'] },
      { title: '动效与完成', items: ['品牌 Logo 循环进行两次轻微放大后回落，模拟脉搏节奏。', '当前原型约 2 秒后完成启动并进入首页；正式加载结果应由真实初始化流程决定。', '系统开启减少动态效果时，取消脉搏动画。'] },
      { title: '页面对照', items: ['打开页面说明后暂停自动跳转，关闭后继续。', '说明仅展示交互规则，不读取账号或验证码。'] },
    ],
  },
  {
    nodeId: 'startup:error', screenName: '启动失败',
    summary: '协议同意状态保存失败时显示重试入口。',
    referenceNote: 'Page7 尚未提供这一异常状态的独立画板。',
    sections: [{ title: '异常与恢复', items: ['显示“协议状态保存失败”，不完成启动。', '点击“重试”返回协议确认，用户可再次尝试。'] }],
  },
]
