export type ContractStatus = 'pending' | 'signed'

export type FulfillmentContract = {
  id: string
  conversationId: string
  orderId: string
  orderNo: string
  gameName: string
  serverName: string
  recyclerName: string
  amountCents: number
  signerMasked: string
  identityMasked: string
  signature?: string
  status: ContractStatus
  signedAt?: number
}
