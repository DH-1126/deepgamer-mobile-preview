export type AuthRequirement = {
  title: string
  description: string
}

export function isGuestAccessiblePath(value: string) {
  const pathname = value.split(/[?#]/, 1)[0]
  return pathname === '/'
    || pathname === '/search'
    || pathname === '/buy/game-zone'
    || pathname === '/buy/list'
    || pathname === '/game'
    || pathname === '/game/select'
    || pathname === '/feedback'
    || pathname === '/profile'
    || pathname.startsWith('/goods/')
}

export function getAuthRequirement(pathname: string): AuthRequirement {
  if (pathname === '/message' || pathname === '/messages' || pathname === '/support' || pathname.startsWith('/im/') || pathname.startsWith('/message/groups/')) {
    return { title: '登录后查看消息', description: '登录后可查看交易消息、交易群和客服回复。' }
  }
  if (pathname.startsWith('/orders') || pathname.startsWith('/payment') || pathname.startsWith('/fulfillment/contracts/')) {
    return { title: '登录后查看订单', description: '登录后可继续下单、支付并查看交易进度。' }
  }
  if (pathname === '/favorites') return { title: '登录后查看收藏', description: '登录后可收藏喜欢的商品并统一管理。' }
  if (pathname === '/sell' || pathname.startsWith('/sell/') || pathname.startsWith('/appraisal')) {
    return { title: '登录后继续卖号', description: '登录后可发布或回收游戏账号，并查看处理进度。' }
  }
  if (pathname === '/wallet') return { title: '登录后查看钱包', description: '登录后可查看余额、资金记录和结算信息。' }
  if (pathname === '/footprint' || pathname === '/footprints') return { title: '登录后查看足迹', description: '登录后可查看完整的商品浏览记录。' }
  return { title: '登录后继续', description: '登录后即可使用完整的交易服务。' }
}
