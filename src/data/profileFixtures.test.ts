import { describe, expect, it } from 'vitest'
import { profileMoreEntries, profilePrimaryRoutes, profileRouteAliases, profileUser } from './profileFixtures'

describe('profileFixtures', () => {
  it('保留 HTML 用户字段并仅声明已登录', () => {
    expect(profileUser).toMatchObject({ name: '玩家_8471', managementId: '20260803', loginStatus: '已登录' })
  })

  it('更多功能的内容和顺序完整', () => {
    expect(profileMoreEntries).toHaveLength(4)
    expect(profileMoreEntries.every((entry) => Boolean(entry.route || entry.action))).toBe(true)
    expect(profileMoreEntries.map((entry) => entry.label)).toEqual(['实名认证', '隐私与协议', '账号与安全', '设置'])
    expect(profilePrimaryRoutes).toContain('/settings')
    expect(profileMoreEntries.find(entry => entry.label === '账号与安全')?.route).toBe('/account-security')
    expect(profilePrimaryRoutes).toContain('/account-security')
  })

  it('消息/足迹别名与账号回收目标完整', () => {
    expect(profileRouteAliases).toEqual([{ route: '/message', alias: '/messages' }, { route: '/footprint', alias: '/footprints' }])
    expect(profilePrimaryRoutes).toContain('/sell')
  })
})
