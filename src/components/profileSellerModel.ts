export type ProfileSellerState = 'buyer' | 'signing' | 'review' | 'rejected' | 'seller'

export type ProfileSellerCard = {
  title: string
  badge: string
  description: string
  action: string
  tone: ProfileSellerState
  /** Existing SellerCenterPage prototype scenario; omitted for the opening guide. */
  scenario?: 'review' | 'rejected' | 'approved' | 'complete'
}

export const profileSellerCards: Record<ProfileSellerState, ProfileSellerCard> = {
  buyer: { title: '成为卖家', badge: '未签约', description: '完成卖家签约后即可发布账号并收款', action: '去开通', tone: 'buyer' },
  signing: { title: '卖家签约', badge: '待签署', description: '审核已通过，请签署协议以启用卖家身份', action: '去签署', tone: 'signing', scenario: 'approved' },
  review: { title: '卖家认证', badge: '审核中', description: '平台正在核验主体与证件信息', action: '查看进度', tone: 'review', scenario: 'review' },
  rejected: { title: '卖家认证', badge: '未通过', description: '请查看审核意见并修改后重新提交', action: '去修改', tone: 'rejected', scenario: 'rejected' },
  seller: { title: '卖家中心', badge: '已开通', description: '管理商品、履约订单与结算收入', action: '查看卖家中心', tone: 'seller', scenario: 'complete' },
}

const stateCycle: readonly ProfileSellerState[] = ['buyer', 'signing', 'review', 'rejected', 'seller']

export function parseProfileSellerState(value: string | null | undefined): ProfileSellerState {
  return stateCycle.includes(value as ProfileSellerState) ? value as ProfileSellerState : 'buyer'
}

export function nextProfileSellerState(current: ProfileSellerState): ProfileSellerState {
  return stateCycle[(stateCycle.indexOf(current) + 1) % stateCycle.length]
}

/** Linked data is authoritative, so the prototype scenario is intentionally never appended there. */
export function getProfileSellerRoute(state: ProfileSellerState, linked = false) {
  const scenario = profileSellerCards[state].scenario
  return linked ? '/seller/center' : `/seller/center?scenario=${scenario ?? 'buyer'}`
}

export function getLinkedProfileSellerState(status?: string, contractStatus?: string): ProfileSellerState {
  if (status === 'REJECTED') return 'rejected'
  if (status === 'PENDING') return 'review'
  if (status === 'APPROVED' && contractStatus === 'UNSIGNED') return 'signing'
  return status === 'APPROVED' ? 'seller' : 'buyer'
}
