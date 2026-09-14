import type { WalletSnapshot } from '../types/wallet'

export const WALLET_STORAGE_KEY = 'deepgamer.wallet.v4'

export function createInitialWalletSnapshot(): WalletSnapshot {
  return {
    availableCents: 268_600,
    pendingCents: 153_600,
    frozenCents: 0,
    withdrawnCents: 62_000,
    completedOrderEarnings: [
      { orderId: 'OD20260910001', amountCents: 153_600, status: 'completed' },
    ],
    transactions: [
      { id: 'WT20260910001', kind: 'adjustment', direction: 'expense', status: 'frozen', title: '购买支付 · 王者荣耀', description: '平台交易资金托管', amountCents: 153_600, occurredAt: '2026-09-10T15:12:00+08:00', availableAfterCents: 0 },
      { id: 'WT20260909002', kind: 'settlement', direction: 'income', status: 'completed', title: '卖号收入 · 原神', description: '交易完成，收入已入账', amountCents: 62_000, occurredAt: '2026-09-09T18:40:00+08:00', availableAfterCents: 62_000 },
      { id: 'WT20260909001', kind: 'withdrawal', direction: 'expense', status: 'completed', title: '提现到支付宝', description: '支付宝（尾号0033）', amountCents: 62_000, occurredAt: '2026-09-09T16:08:00+08:00', availableAfterCents: 0, channel: '支付宝（尾号0033）' },
      { id: 'WT20260908001', kind: 'refund', direction: 'income', status: 'completed', title: '售后退款 · 和平精英', description: '售后退款已入账', amountCents: 12_000, occurredAt: '2026-09-08T10:26:00+08:00', availableAfterCents: 12_000 },
    ],
  }
}
