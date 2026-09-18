import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'

export type SupportEntry = 'faq' | 'account' | 'product'

export function buildSupportEntryRoute(entry: SupportEntry, gameCode = 'wzry') {
  const params = new URLSearchParams({
    scenario: entry === 'product' ? 'recommend' : entry,
    gameCode,
  })
  return `${SUPPORT_CONVERSATION_ROUTE}?${params.toString()}`
}

export function buildProductConsultationRoute(productId: string, gameCode?: string) {
  const params = new URLSearchParams({ scenario: 'product', productId })
  if (gameCode) params.set('gameCode', gameCode)
  return `${SUPPORT_CONVERSATION_ROUTE}?${params.toString()}`
}
