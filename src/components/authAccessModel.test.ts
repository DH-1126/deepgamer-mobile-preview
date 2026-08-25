import { describe, expect, it } from 'vitest'
import { getAuthRequirement, isGuestAccessiblePath } from './authAccessModel'

describe('authAccessModel', () => {
  it('uses scene-specific copy for private routes', () => {
    expect(getAuthRequirement('/message').title).toBe('登录后查看消息')
    expect(getAuthRequirement('/orders/OD-1').title).toBe('登录后查看订单')
    expect(getAuthRequirement('/favorites').title).toBe('登录后查看收藏')
    expect(getAuthRequirement('/appraisal/fill').title).toBe('登录后继续卖号')
  })

  it('falls back to the generic login requirement', () => {
    expect(getAuthRequirement('/settings')).toEqual({ title: '登录后继续', description: '登录后即可使用完整的交易服务。' })
  })

  it('distinguishes guest pages from private pages', () => {
    expect(isGuestAccessiblePath('/game?gameCode=wzry')).toBe(true)
    expect(isGuestAccessiblePath('/goods/wzry-001')).toBe(true)
    expect(isGuestAccessiblePath('/message')).toBe(false)
    expect(isGuestAccessiblePath('/orders/preview')).toBe(false)
  })
})
