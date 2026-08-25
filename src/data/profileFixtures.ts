import type { ProfileEntry, ProfileOrder, ProfileUser } from '../types/profile'
import { SUPPORT_CONVERSATION_ROUTE } from './messageFixtures'

export const profileUser: ProfileUser = {
  name: '用户4761',
  managementId: '1114782432555352661',
  loginStatus: '已登录',
  balanceCents: 0,
  favoriteCount: 2,
}

export function createProfileOrders(now: number): ProfileOrder[] {
  return [
    { id: 'buyer-pending-1', role: 'buyer', status: 'pending', expiresAt: now + 24 * 60_000 + 12_000 },
    { id: 'buyer-binding-1', role: 'buyer', status: 'binding' },
    { id: 'buyer-confirm-1', role: 'buyer', status: 'bind_success', expiresAt: now + 61 * 3_600_000 + 4 * 60_000 + 22_000 },
    { id: 'seller-on-sale-1', role: 'seller', status: 'on_sale' },
  ]
}

export const profileMoreEntries: ProfileEntry[] = [
  { label: '我发布的', route: '/sell/goods' },
  { label: '我的售后', route: '/aftersales' },
  { label: '卖家签约', route: '/seller/center', badge: '减免手续费' },
  { label: '回收', action: 'recycle' },
  { label: '推送', route: '/message', dot: true },
  { label: '足迹', route: '/footprint' },
  { label: '实名', route: '/realname' },
  { label: '客服', route: SUPPORT_CONVERSATION_ROUTE },
  { label: '设置', route: '/settings' },
]

export const recycleChoices = [
  { label: '卖号变现', route: '/sell', detail: '发布账号，与买家完成平台交易' },
  { label: '平台回收', route: '/appraisal', detail: '选择回收商，先沟通确认报价' },
] as const

export const profilePrimaryRoutes = ['/settings', '/wallet', '/favorites', '/orders', '/sell/goods', '/aftersales', '/seller/center', '/realname', SUPPORT_CONVERSATION_ROUTE, '/appraisal'] as const
export const profileRouteAliases = [{ route: '/message', alias: '/messages' }, { route: '/footprint', alias: '/footprints' }] as const
