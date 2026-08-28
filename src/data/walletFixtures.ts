import type { WalletSnapshot } from '../types/wallet'

export const WALLET_STORAGE_KEY = 'deepgamer.wallet.v3'

export function createInitialWalletSnapshot(): WalletSnapshot {
  return {
    availableCents: 268_600,
    pendingCents: 128_000,
    frozenCents: 71_940,
    withdrawnCents: 300_000,
    completedOrderEarnings: [
      { orderId: 'RC-2608-4471', amountCents: 20_000, status: 'contract_required' },
      { orderId: 'OD3014653017123329564', amountCents: 128_000, status: 'processing' },
      { orderId: 'OD3014647559752705663', amountCents: 200_000, status: 'completed' },
    ],
    transactions: [
      { id: 'WT20260826001', kind: 'settlement', direction: 'income', status: 'pending', title: '货款结算 OD3014653017123329564', description: '王者荣耀 · 安卓QQ · 王者50★', amountCents: 128_000, occurredAt: '2026-08-26T09:26:00+08:00', availableAfterCents: 268_600, orderId: 'OD3014653017123329564' },
      { id: 'WT20260825002', kind: 'settlement', direction: 'income', status: 'completed', title: '货款结算 OD3014647559752705663', description: '原神 · 天空岛 · 五星角色8', amountCents: 200_000, occurredAt: '2026-08-25T18:40:00+08:00', availableAfterCents: 268_600, orderId: 'OD3014647559752705663' },
      { id: 'WT20260825001', kind: 'adjustment', direction: 'expense', status: 'completed', title: '提现申请扣款', description: '提现申请已受理', amountCents: 6_000, occurredAt: '2026-08-25T18:40:00+08:00', availableAfterCents: 68_600 },
      { id: 'WT20260823001', kind: 'refund', direction: 'income', status: 'completed', title: '提现退款', description: '提现申请退回余额', amountCents: 71_940, occurredAt: '2026-08-23T14:12:00+08:00', availableAfterCents: 74_600 },
      { id: 'WT20260820001', kind: 'withdrawal', direction: 'expense', status: 'completed', title: '提现申请扣款', description: '提现至支付宝账户', amountCents: 50_000, occurredAt: '2026-08-20T11:06:00+08:00', availableAfterCents: 2_660, channel: '支付宝（尾号0033）' },
      { id: 'WT20260816001', kind: 'withdrawal', direction: 'expense', status: 'completed', title: '提现申请扣款', description: '提现至支付宝账户', amountCents: 250_000, occurredAt: '2026-08-16T16:25:00+08:00', availableAfterCents: 52_660, channel: '支付宝（尾号0033）' },
    ],
  }
}
