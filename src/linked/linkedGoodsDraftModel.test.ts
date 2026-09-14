import { describe, expect, it } from 'vitest'
import type { LinkedGoods, LinkedState } from '../../../双端演示/src/contract'
import { createLinkedGoodsDraftBaseline, getLinkedGoodsDraftConflict } from './linkedGoodsDraftModel'

const goods = { id: 'goods-1', sellerId: 'seller-1', rowVersion: 4 } as LinkedGoods
const state = { sessionId: 'session-1', seller: { id: 'seller-1' }, goods: [goods] } as LinkedState

describe('linked goods draft baseline', () => {
  it('pins the initial session and row version instead of following live state', () => {
    const baseline = createLinkedGoodsDraftBaseline(state, goods.id)
    expect(baseline).toMatchObject({ kind: 'edit', sessionId: 'session-1', goodsId: 'goods-1', rowVersion: 4 })
    expect(getLinkedGoodsDraftConflict({ ...state, goods: [{ ...goods, rowVersion: 5 }] }, baseline)).toContain('另一端发生变化')
    expect(baseline).toMatchObject({ rowVersion: 4 })
  })

  it('does not downgrade a missing or foreign edit target into create mode', () => {
    expect(createLinkedGoodsDraftBaseline(state, 'missing')).toMatchObject({ kind: 'invalid', goodsId: 'missing' })
    expect(createLinkedGoodsDraftBaseline({ ...state, goods: [{ ...goods, sellerId: 'seller-2' }] }, goods.id)).toMatchObject({ kind: 'invalid', goodsId: goods.id })
  })

  it('blocks stale drafts after a session reset', () => {
    const baseline = createLinkedGoodsDraftBaseline(state, goods.id)
    expect(getLinkedGoodsDraftConflict({ ...state, sessionId: 'session-2' }, baseline)).toContain('会话已重置')
  })
})
