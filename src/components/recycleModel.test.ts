import { describe, expect, it } from 'vitest'
import { createRecycleOrder } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import { createRecycleConversation, createRecyclePaidOrderRecord, filterRecycleConsultations, getRecycleDraftSummary, getRecyclePayableCents, getRecycleStatusLabel, validateRecycleOrderDraft } from './recycleModel'

describe('recycleModel', () => {
  const base = createRecycleOrder(recyclerFixtures[0], 2_000_000_000_000)

  it('按双角色展示回收单状态', () => {
    expect(getRecycleStatusLabel({ ...base, stage: 'formal' }, 'seller')).toBe('待你确认')
    expect(getRecycleStatusLabel({ ...base, stage: 'formal' }, 'recycler')).toBe('等待卖家确认')
    expect(getRecycleStatusLabel({ ...base, stage: 'submitted' }, 'recycler')).toBe('待你付款')
  })

  it('校验回收商发单信息且拦截敏感内容', () => {
    const valid = { loginAccount: 'player_2026', realnameStatus: '包人脸' as const, nobleLevel: 'V8' as const, antiAddiction: '有防沉迷' as const, quoteCents: 2200, screenshots: [], note: '皮肤较多，高段位' }
    expect(validateRecycleOrderDraft(valid)).toEqual({})
    expect(getRecycleDraftSummary(valid)).toBe('包人脸 · V8 · 有防沉迷')
    expect(validateRecycleOrderDraft({ ...valid, quoteCents: 0, loginAccount: '', realnameStatus: '', nobleLevel: '', antiAddiction: '', note: '密码是 123456' })).toMatchObject({ quoteCents: expect.any(String), loginAccount: expect.any(String), realnameStatus: expect.any(String), nobleLevel: expect.any(String), antiAddiction: expect.any(String), note: expect.any(String) })
    expect(validateRecycleOrderDraft({ ...valid, note: '联系 13800138000' }).note).toContain('个人信息')
    expect(validateRecycleOrderDraft({ ...valid, screenshots: [{ id: 'bad', name: 'bad.gif', mimeType: 'image/gif' as 'image/jpeg', size: 100 }] }).screenshots).toContain('JPG')
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
