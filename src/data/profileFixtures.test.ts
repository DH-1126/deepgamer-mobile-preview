import { describe, expect, it } from 'vitest'
import { profileMoreEntries, profilePrimaryRoutes, profileRouteAliases, profileUser } from './profileFixtures'

describe('profileFixtures', () => {
  it('保留 HTML 用户字段并仅声明已登录', () => {
    expect(profileUser).toMatchObject({ name: '用户4761', managementId: '1114782432555352661', loginStatus: '已登录' })
  })

  it('更多功能的内容和顺序完整', () => {
    expect(profileMoreEntries).toHaveLength(5)
    expect(profileMoreEntries.every((entry) => Boolean(entry.route || entry.action))).toBe(true)
    expect(profileMoreEntries.map((entry) => entry.label)).toEqual(['卖家签约', '实名认证', '设置', '隐私与协议', '退出登录'])
    expect(profileMoreEntries.find((entry) => entry.label === '卖家签约')?.status).toBe('未签约')
    expect(profileMoreEntries.find((entry) => entry.label === '卖家签约')?.badge).toBe('减免手续费')
    expect(profilePrimaryRoutes).toContain('/settings')
  })

  it('消息/足迹别名与账号回收目标完整', () => {
    expect(profileRouteAliases).toEqual([{ route: '/message', alias: '/messages' }, { route: '/footprint', alias: '/footprints' }])
    expect(profilePrimaryRoutes).toContain('/sell')
  })
})
