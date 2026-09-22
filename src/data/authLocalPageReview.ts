import type { AuthPageSpec } from './authPageSpecs'

export const AUTH_LOCAL_REVIEW_PAGES: Array<AuthPageSpec & { screenName: string; referenceNote: string }> = [
  {
    nodeId: 'auth:register-verification', screenName: '注册手机号验证',
    referenceNote: 'Page7 当前未登记此注册验证弹窗的独立画板；此处展示现有业务交互说明。',
    summary: '密码登录发现手机号尚未注册时，通过短信验证完成注册并登录。',
    sections: [
      { title: '操作流程', items: ['展示脱敏手机号，获取验证码后显示重发倒计时。', '输入 6 位验证码并点击“注册并登录”；成功后使用登录页已输入的密码创建账号，显示成功提示并继续登录流程。'] },
      { title: '校验与退出', items: ['验证码缺失、格式不正确或服务返回失败时显示错误，保留当前输入。', '发送或提交期间防止重复操作；提交期间不能关闭。', '关闭按钮返回密码登录，点击“收不到验证码？”进入短信帮助页。'] },
    ],
  },
  {
    nodeId: 'auth:push-permission', screenName: '交易提醒授权',
    referenceNote: 'Page7 当前未登记交易提醒授权的独立画板，暂不提供未经核实的 Figma 链接。',
    summary: '登录后选择是否开启交易提醒；当前原型只保存本地偏好，不代表已取得系统通知权限。',
    sections: [
      { title: '主要操作', items: ['“暂不开启”保存关闭偏好，“开启提醒”保存开启偏好。', '保存期间禁用两个按钮，保存成功后返回指定页面，默认返回“我的”。'] },
      { title: '异常状态', items: ['保存失败时展示“设置保存失败，请重试”，留在当前页并恢复操作。'] },
    ],
  },
]
