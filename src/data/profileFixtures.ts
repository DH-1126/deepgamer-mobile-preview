import type { ProfileEntry, ProfileOrder, ProfileUser } from '../types/profile'
import { SUPPORT_CONVERSATION_ROUTE } from './messageFixtures'

export const profileUser: ProfileUser = {
  name: '玩家_8471',
  managementId: '20260803',
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
  { label: '实名认证', route: '/realname', status: '已认证' },
  { label: '隐私与协议', route: '/privacy-and-agreements' },
  { label: '账号与安全', route: '/account-security' },
  { label: '设置', route: '/settings' },
]

export const profilePrimaryRoutes = ['/account-security', '/account-security/profile', '/account-security/phone', '/settings', '/settings/password', '/settings/bindings', '/settings/cancellation', '/privacy-and-agreements', '/about-us', '/wallet', '/favorites', '/orders', '/sell', '/sell/goods', '/aftersales', '/aftersales/AS202608270001', '/seller/center', '/seller/apply/personal', '/seller/apply/business', '/realname', '/privacy-policy', '/user-agreement', SUPPORT_CONVERSATION_ROUTE] as const
export const profileRouteAliases = [{ route: '/message', alias: '/messages' }, { route: '/footprint', alias: '/footprints' }] as const
