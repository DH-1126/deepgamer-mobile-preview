import { describe, expect, it } from 'vitest'
import { createInitialWalletSnapshot } from '../data/walletFixtures'
import { filterWalletTransactions, formatWalletMoney, formatWalletTime, formatWalletTransactionAmount, getWalletOverviewState, getWalletStatusLabel, getWalletTotalCents, parseWithdrawalCents, validateWithdrawal } from './walletModel'

describe('walletModel', () => {
  it('使用整数分格式化余额与流水方向', () => {
    const snapshot = createInitialWalletSnapshot()
    expect(formatWalletMoney(268_600)).toBe('¥2,686.00')
    expect(formatWalletTransactionAmount(snapshot.transactions[1])).toBe('+¥2,000.00')
    expect(formatWalletTransactionAmount(snapshot.transactions[2])).toBe('-¥60.00')
    expect(getWalletTotalCents(snapshot)).toBe(348_000)
  })

  it('严格解析两位小数并校验提现范围', () => {
    expect(parseWithdrawalCents('100.25')).toBe(10_025)
    expect(parseWithdrawalCents('1.234')).toBeUndefined()
    expect(parseWithdrawalCents('-1')).toBeUndefined()
    expect(validateWithdrawal('0.50', 100_000)).toEqual({ ok: false, error: '最低提现金额为 ¥1.00' })
    expect(validateWithdrawal('1000.01', 100_000)).toEqual({ ok: false, error: '提现金额不能超过可用余额' })
    expect(validateWithdrawal('1000', 100_000)).toEqual({ ok: true, cents: 100_000 })
  })

  it('按收入、支出和处理中筛选同一份流水', () => {
    const transactions = createInitialWalletSnapshot().transactions
    expect(filterWalletTransactions(transactions, 'income')).toHaveLength(3)
    expect(filterWalletTransactions(transactions, 'expense')).toHaveLength(3)
    expect(filterWalletTransactions(transactions, 'pending').map((item) => item.id)).toEqual(['WT20260826001'])
  })

  it('流水状态仅展示已完成或处理中，并保留完整时间', () => {
    expect(getWalletStatusLabel('completed')).toBe('已完成')
    expect(getWalletStatusLabel('pending')).toBe('处理中')
    expect(getWalletStatusLabel('frozen')).toBe('处理中')
    expect(getWalletStatusLabel('failed')).toBe('处理中')
    expect(formatWalletTime('2026-08-26T09:26:00.123+08:00', true)).toBe('2026-08-26 09:26:00.123')
  })

  it('区分有明细、纯空钱包和待签约钱包', () => {
    const active = createInitialWalletSnapshot()
    const empty = { ...active, availableCents: 0, pendingCents: 0, frozenCents: 0, transactions: [] }
    expect(getWalletOverviewState(active, false, false)).toBe('active')
    expect(getWalletOverviewState(empty, false, false)).toBe('empty')
    expect(getWalletOverviewState(empty, true, false)).toBe('contract_required')
    expect(getWalletOverviewState(empty, true, true)).toBe('empty')
  })
})
