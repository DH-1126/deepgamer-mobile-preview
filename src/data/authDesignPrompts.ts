export const AUTH_DESIGN_FILE_KEY = '6XRskiEZJiWX2IgDDP0JPA'
export const AUTH_DESIGN_PAGE_NAME = 'Page7'

const FIGMA_FILE_URL = `https://www.figma.com/design/${AUTH_DESIGN_FILE_KEY}/%E5%9B%A2%E9%98%9F-Draft--Copy-`

export type AuthDesignPrompt = {
  nodeId: string
  pageName: typeof AUTH_DESIGN_PAGE_NAME
  screenName: string
  figmaUrl: string
  prompt: string
}

const screenNames = {
  '7080:144': '一键登录',
  '7080:202': '验证码登录',
  '7080:274': '账号密码登录',
  '7081:303': '登录协议未勾选',
  '7081:385': '登录协议确认',
  '7081:485': '验证码已发送',
  '7082:485': '短信帮助',
  '7082:531': '隐私政策',
  '7082:626': '用户协议',
  '7087:620': '找回密码（初始）',
  '7087:716': '找回密码（已填写）',
  '7087:831': '找回密码（错误提示）',
  '7114:921': '启动协议确认',
  '7115:947': '启动协议二次确认',
  '7115:1006': '网络异常',
} as const

export type AuthDesignNodeId = keyof typeof screenNames

function createPrompt(nodeId: AuthDesignNodeId, screenName: string): AuthDesignPrompt {
  const figmaUrl = `${FIGMA_FILE_URL}?node-id=${nodeId.replace(':', '-')}&m=dev`
  return {
    nodeId,
    pageName: AUTH_DESIGN_PAGE_NAME,
    screenName,
    figmaUrl,
    prompt: `Implement this design from Figma.\n@${figmaUrl}`,
  }
}

export const AUTH_DESIGN_PROMPTS: readonly AuthDesignPrompt[] = Object.entries(screenNames).map(
  ([nodeId, screenName]) => createPrompt(nodeId as AuthDesignNodeId, screenName),
)

const promptByNodeId = new Map(AUTH_DESIGN_PROMPTS.map((entry) => [entry.nodeId, entry]))

export function getAuthDesignPrompt(nodeId: string): AuthDesignPrompt | undefined {
  return promptByNodeId.get(nodeId)
}
