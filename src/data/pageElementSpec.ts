/** Static implementation notes; never interpolate live form values into documentation. */
export type PageElementSpec = {
  name: string
  component: string
  visual: string
  dimensions: string
  typography: string
  interaction: string
  ui: string
  dataSource: string
  dataContent: string
  evidence: string[]
}

export const REVIEW_STATUS_ELEMENT: PageElementSpec = {
  name: '顶部状态栏与页面说明入口',
  component: 'StatusBar + DesignPromptTrigger（整栏原生按钮）',
  visual: '时间居左，信号、Wi-Fi 与电量居右；整条状态栏共享一个点击区域。',
  dimensions: '宽度跟随原型，最大 393px；高度 44px；左右内边距 16px。',
  typography: '时间 15px，字重 700；默认行高 20px，登录状态栏 18px、断网页 15px；字体继承页面。',
  interaction: '点击任意位置或键盘 Enter / Space 打开同一份右侧页面说明；关闭或 Escape 返回入口。',
  ui: '保持当前页面状态栏配色；宽屏说明位于原型右侧，窄屏使用下方独立阅读区。',
  dataSource: 'pageReviewRegistry.ts 的静态页面登记；状态栏为原型示意。',
  dataContent: '固定时间 9:41、静态信号和电量图标；当前页面 Figma 来源、元素 Spec 和流程说明。不读取真实设备电量或表单内容。',
  evidence: ['src/components/DesignPromptTrigger.tsx', 'src/components/ui/layoutPrimitives.tsx', 'src/styles/design-prompt.css'],
}
