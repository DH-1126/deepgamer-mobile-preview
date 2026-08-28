export type WalletTransactionDirection = 'income' | 'expense'
export type WalletTransactionStatus = 'completed' | 'pending' | 'frozen' | 'failed'
export type WalletTransactionKind = 'settlement' | 'withdrawal' | 'refund' | 'adjustment'
export type WalletTransactionFilter = 'all' | 'income' | 'expense' | 'pending'
export type WalletOverviewState = 'active' | 'empty' | 'contract_required'
export type WalletEarningStatus = 'contract_required' | 'processing' | 'completed'

export interface WalletCompletedOrderEarning {
  orderId: string
  amountCents: number
  status: WalletEarningStatus
}

export interface WalletTransaction {
  id: string
  kind: WalletTransactionKind
  direction: WalletTransactionDirection
  status: WalletTransactionStatus
  title: string
  description: string
  amountCents: number
  occurredAt: string
  availableAfterCents: number
  orderId?: string
  channel?: string
}

export interface WalletSnapshot {
  availableCents: number
  pendingCents: number
  frozenCents: number
  withdrawnCents: number
  completedOrderEarnings: WalletCompletedOrderEarning[]
  transactions: WalletTransaction[]
}

export type WalletWithdrawalResult = { ok: true; transactionId: string } | { ok: false; error: string }
