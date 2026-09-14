import type { LinkedState } from '../../../双端演示/src/contract'

export function findLinkedGoodsForDetail(state: Pick<LinkedState, 'goods'>, goodsId: string) {
  return state.goods.find((goods) => goods.id === goodsId)
}
