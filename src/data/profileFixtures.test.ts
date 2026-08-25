import { describe, expect, it } from 'vitest'
import { SUPPORT_CONVERSATION_ROUTE } from './messageFixtures'
import { profileMoreEntries, profilePrimaryRoutes, profileRouteAliases, profileUser, recycleChoices } from './profileFixtures'

describe('profileFixtures', () => {
  it('保留 HTML 用户字段并仅声明已登录', () => {
    expect(profileUser).toMatchObject({ name: '用户4761', managementId: '1114782432555352661', loginStatus: '已登录' })
  })

  it('更多入口均具有安全路由或本地回收动作', () => {
    expect(profileMoreEntries).toHaveLength(9)
    expect(profileMoreEntries.every((entry) => Boolean(entry.route || entry.action))).toBe(true)
    expect(profileMoreEntries.find((entry) => entry.label === '卖家签约')?.badge).toBe('减免手续费')
    expect(profileMoreEntries.find((entry) => entry.label === '推送')?.route).toBe('/message')
    expect(profileMoreEntries.find((entry) => entry.label === '足迹')?.route).toBe('/footprint')
    expect(profileMoreEntries.find((entry) => entry.label === '客服')?.route).toBe(SUPPORT_CONVERSATION_ROUTE)
    expect(profilePrimaryRoutes).toContain('/settings')
  })

  it('消息/足迹别名与回收弹窗目标完整', () => {
    expect(profileRouteAliases).toEqual([{ route: '/message', alias: '/messages' }, { route: '/footprint', alias: '/footprints' }])
    expect(recycleChoices.map((choice) => choice.route)).toEqual(['/sell', '/appraisal'])
  })
})
