import type { LinkedGoods, LinkedState } from '../../../双端演示/src/contract'

export type LinkedGoodsDraftBaseline =
  | { kind: 'create'; sessionId: string }
  | { kind: 'edit'; sessionId: string; goodsId: string; rowVersion: number; goods: LinkedGoods }
  | { kind: 'invalid'; sessionId: string; goodsId: string; reason: string }

export function createLinkedGoodsDraftBaseline(state: LinkedState, requestedGoodsId: string | null): LinkedGoodsDraftBaseline {
  if (!requestedGoodsId) return { kind: 'create', sessionId: state.sessionId }
  const goods = state.goods.find((item) => item.id === requestedGoodsId)
  if (!goods) return { kind: 'invalid', sessionId: state.sessionId, goodsId: requestedGoodsId, reason: '商品不存在或已被移除，不能按新商品提交' }
  if (goods.sellerId !== state.seller.id) return { kind: 'invalid', sessionId: state.sessionId, goodsId: requestedGoodsId, reason: '无权编辑其他卖家的商品' }
  return { kind: 'edit', sessionId: state.sessionId, goodsId: goods.id, rowVersion: goods.rowVersion, goods }
}

export function getLinkedGoodsDraftConflict(state: LinkedState, baseline: LinkedGoodsDraftBaseline): string {
  if (baseline.kind === 'invalid') return baseline.reason
  if (state.sessionId !== baseline.sessionId) return '演示会话已重置，当前草稿不会提交，请重新进入表单'
  if (baseline.kind === 'create') return ''
  const latest = state.goods.find((item) => item.id === baseline.goodsId)
  if (!latest) return '商品已被移除，当前草稿不会提交'
  if (latest.sellerId !== state.seller.id) return '商品归属已变化，当前草稿无权提交'
  if (latest.rowVersion !== baseline.rowVersion) return '商品已在另一端发生变化，当前草稿已保留；请返回后重新进入编辑页'
  return ''
}
