import { describe, expect, it } from 'vitest'
import { createRecycleOrder } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import { createRecycleConversation, createRecyclePaidOrderRecord, filterRecycleConsultations, getRecyclePayableCents, getRecycleStatusLabel, validateRecycleOrderDraft } from './recycleModel'

describe('recycleModel', () => {
  const base = createRecycleOrder(recyclerFixtures[0], 2_000_000_000_000)

  it('按双角色展示回收单状态', () => {
    expect(getRecycleStatusLabel({ ...base, stage: 'formal' }, 'seller')).toBe('待你确认')
    expect(getRecycleStatusLabel({ ...base, stage: 'formal' }, 'recycler')).toBe('等待卖家确认')
    expect(getRecycleStatusLabel({ ...base, stage: 'submitted' }, 'recycler')).toBe('待你付款')
  })

  it('校验回收商发单信息且拦截敏感内容', () => {
    expect(validateRecycleOrderDraft({ quoteCents: 2200, server: 'QQ区', rank: '高段位', accountSummary: '皮肤较多，可二次实名' })).toEqual({})
    expect(validateRecycleOrderDraft({ quoteCents: 0, server: '', rank: '', accountSummary: '密码是 123456' })).toMatchObject({ quoteCents: expect.any(String), accountSummary: expect.any(String) })
    expect(validateRecycleOrderDraft({ quoteCents: 2200, server: 'QQ区', rank: '高段位', accountSummary: '联系 13800138000' }).accountSummary).toContain('个人信息')
  })

  it('计算回收商应付金额并筛选咨询', () => {
    expect(getRecyclePayableCents({ quoteCents: 2200 })).toBe(2420)
    expect(filterRecycleConsultations([{ ...base, stage: 'formal' }, { ...base, id: 'two', stage: 'completed' }], 'completed')).toHaveLength(1)
  })

  it('仅为已成交且具备关联字段的回收单生成交易群契约', () => {
    expect(createRecycleConversation({ ...base, stage: 'completed', conversationId: 'trade-recycle-1', orderId: 'OD-1', quoteCents: 2200 }, 10)).toMatchObject({ id: 'trade-recycle-1', kind: 'trade_group', workflowPhase: 'materials', viewerRole: 'seller', orderAmount: 22 })
    expect(createRecycleConversation(base, 10)).toBeNull()
  })

  it('为付款先生成与交易群稳定关联的订单记录', () => {
    expect(createRecyclePaidOrderRecord({ ...base, quoteCents: 2200, protectionFeeCents: 220 }, 10)).toMatchObject({ id: `OD-${base.id}`, role: 'seller', status: 'paid', productId: `recycle-${base.id}`, goodsAmountCents: 2200, serviceAmountCents: 220, totalAmountCents: 2420, conversationId: `trade-recycle-${base.id}` })
  })
})
