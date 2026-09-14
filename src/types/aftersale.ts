export type AfterSaleStatus = 'pending_review' | 'supplement' | 'refunding' | 'platform_processing' | 'rejected' | 'completed' | 'withdrawn'
export type AfterSaleKind = 'negotiated_refund' | 'account_issue' | 'account_recovery'

export type AfterSaleSupplement = {
  note: string
  materialNames: string[]
  submittedAt: string
}

export type AfterSaleRecord = {
  id: string
  orderId: string
  productId: string
  productTitle: string
  gameName: string
  server: string
  thumbnail: string
  status: AfterSaleStatus
  kind?: AfterSaleKind
  reason: string
  description: string
  statusMessage: string
  refundAmountCents: number
  materialNames?: string[]
  supplements?: AfterSaleSupplement[]
  reviewStage?: 'initial' | 'resubmitted'
  resultLabel?: string
  refundMethod?: string
  createdAt: string
  updatedAt: string
}

export type AfterSaleApplicationInput = {
  kind: AfterSaleKind
  reason: string
  description: string
  materialNames: string[]
}
