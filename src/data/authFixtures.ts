import type { AuthUser, PolicySection } from '../types/auth'

export const DEMO_MASKED_PHONE = '187 **** 0033'
export const DEMO_CODE = '246810'
export const DEMO_PASSWORD = 'deepgamer'
export const AUTH_POLICY_UPDATED_AT = '2026-08-18'

export const demoAuthUser: AuthUser = {
  id: 'local-demo-player',
  displayName: '玩家_8471',
  verified: true,
}

export const privacySections: PolicySection[] = [
  {
    id: 'preface',
    title: '前言',
    paragraphs: [
      '你在使用深度玩家提供的账号交易服务时，我们可能会收集和使用与服务相关的个人信息。我们将按照法律法规要求采取相应的安全保护措施。',
    ],
  },
  {
    id: 'notice',
    title: '提示条款',
    paragraphs: [
      '本政策仅适用于深度玩家提供的产品与服务，不适用于第三方另行向你提供的服务。',
      '首次启动时，为让产品正常运行与保障基础安全，我们会按本政策获取设备标识、设备型号与网络状态等必要信息。',
      '定位、相册、相机等设备权限不会默认开启。涉及重要或敏感权限时，我们会在你使用相关功能时再次向你申请，开启后仍可随时在系统设置中关闭。',
    ],
  },
  {
    id: 'collect',
    title: '收集与使用',
    paragraphs: [
      '手机号仅用于登录验证、账号安全和交易通知。演示环境不会保存你输入的手机号、验证码或密码。',
      '下单、发布商品和快速回收等交易功能，需要在登录后按平台规则完成实名认证。',
    ],
  },
  {
    id: 'device',
    title: '设备权限',
    paragraphs: [
      '推送权限只会在需要交易提醒时申请。拒绝授权不会影响浏览和登录，你仍可在消息中心查看交易进度。',
    ],
  },
  {
    id: 'rights',
    title: '你的权利',
    paragraphs: ['你可以依法访问、更正、删除个人信息，或撤回已经授权的权限。'],
  },
  {
    id: 'contact',
    title: '联系我们',
    paragraphs: ['如对本政策有疑问，可通过深度玩家客服与我们联系。'],
  },
]

export const agreementSections: PolicySection[] = [
  {
    id: 'scope',
    title: '一 · 协议范围',
    paragraphs: ['本协议内容包括协议正文、附件，以及平台已经发布或将来可能发布的各类规则与声明。所有附件、规则与声明均为本协议不可分割的一部分，与正文具有同等效力。'],
  },
  {
    id: 'account',
    title: '二 · 账号与实名',
    paragraphs: ['未注册的手机号在登录成功后将自动创建深度玩家账号。使用本机号码一键登录时，运营商会向平台提供本机号码用于登录验证。下单、发布商品、快速回收等交易功能需要先完成实名认证。'],
  },
  {
    id: 'trade',
    title: '三 · 交易与资金',
    paragraphs: ['平台为账号交易提供资金托管、换绑交付、验号与客服介入服务。具体流程、时限与责任划分以平台交易规则为准。'],
  },
  {
    id: 'risk',
    title: '四 · 风险与责任',
    paragraphs: ['请勿绕过平台私下交易或泄露验证码、支付密码等敏感信息。因用户自行操作产生的风险，依本协议和适用法律处理。'],
  },
]
