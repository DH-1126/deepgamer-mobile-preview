import type { WalletOverviewState, WalletSnapshot, WalletTransaction, WalletTransactionFilter, WalletTransactionStatus } from '../types/wallet'

const moneyFormatter = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatWalletMoney(cents: number) {
  return `¥${moneyFormatter.format(Math.abs(cents) / 100)}`
}

export function formatWalletTransactionAmount(transaction: WalletTransaction) {
  return `${transaction.direction === 'income' ? '+' : '-'}${formatWalletMoney(transaction.amountCents)}`
}

export function getWalletStatusLabel(status: WalletTransactionStatus) {
  return status === 'completed' ? '已完成' : '处理中'
}

export function filterWalletTransactions(transactions: WalletTransaction[], filter: WalletTransactionFilter) {
  if (filter === 'all') return transactions
  if (filter === 'pending') return transactions.filter((item) => item.status === 'pending' || item.status === 'frozen')
  return transactions.filter((item) => item.direction === filter)
}

export function getWalletTotalCents(snapshot: WalletSnapshot) {
  return snapshot.completedOrderEarnings.reduce((total, earning) => total + earning.amountCents, 0)
}

export function getWalletOverviewState(snapshot: WalletSnapshot, hasCompletedOrder: boolean, contractSigned: boolean): WalletOverviewState {
  if (snapshot.availableCents > 0 || snapshot.pendingCents > 0 || snapshot.frozenCents > 0 || snapshot.transactions.length > 0) return 'active'
  if (hasCompletedOrder && !contractSigned) return 'contract_required'
  return 'empty'
}

export function parseWithdrawalCents(value: string) {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return undefined
  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) ? cents : undefined
}

export function validateWithdrawal(value: string, availableCents: number) {
  const cents = parseWithdrawalCents(value)
  if (cents === undefined || cents <= 0) return { ok: false as const, error: '请输入正确的提现金额' }
  if (cents < 100) return { ok: false as const, error: '最低提现金额为 ¥1.00' }
  if (cents > availableCents) return { ok: false as const, error: '提现金额不能超过可用余额' }
  return { ok: true as const, cents }
}

export function formatWalletTime(value: string, detail = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  const millisecond = String(date.getMilliseconds()).padStart(3, '0')
  return detail ? `${date.getFullYear()}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}` : `${month}-${day} ${hour}:${minute}`
}
