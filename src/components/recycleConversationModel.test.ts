import { describe, expect, it } from 'vitest'
import { createRecycleOrder } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import { getRecycleConversationName, getRecycleConversationStatus, getRecycleUnreadCount } from './recycleConversationModel'

describe('recycleConversationModel', () => {
  const base = createRecycleOrder(recyclerFixtures[0], 2_000_000_000_000)

  it('优先展示去除空白的咨询昵称，并兼容旧数据', () => {
    expect(getRecycleConversationName({ ...base, contactName: '  买家1  ' })).toBe('买家1')
    expect(getRecycleConversationName({ ...base, contactName: '   ' })).toBe(base.recyclerName)
    expect(getRecycleConversationName(base)).toBe(base.recyclerName)
  })

  it('将业务阶段收敛为两种列表状态', () => {
    expect(getRecycleConversationStatus({ ...base, stage: 'consulting' })).toBe('沟通中')
    expect(getRecycleConversationStatus({ ...base, stage: 'offered' })).toBe('沟通中')
    expect(getRecycleConversationStatus({ ...base, stage: 'materials' })).toBe('沟通中')
    expect(getRecycleConversationStatus({ ...base, stage: 'rejected' })).toBe('沟通中')
    for (const stage of ['formal', 'submitted', 'inspecting', 'completed'] as const) {
      expect(getRecycleConversationStatus({ ...base, stage })).toBe('已下单')
    }
  })

  it('安全归一化旧数据或异常未读数', () => {
    expect(getRecycleUnreadCount(base)).toBe(0)
    expect(getRecycleUnreadCount({ unreadCount: 3.9 })).toBe(3)
    expect(getRecycleUnreadCount({ unreadCount: -1 })).toBe(0)
    expect(getRecycleUnreadCount({ unreadCount: Number.NaN })).toBe(0)
    expect(getRecycleUnreadCount({ unreadCount: Number.POSITIVE_INFINITY })).toBe(0)
  })
})
