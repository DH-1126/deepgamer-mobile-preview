import { useEffect, useState } from 'react'
import { ChevronLeft, CircleCheck, FileSignature, LockKeyhole, WalletCards } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, ChoiceChip, Heading, IconButton, PageHeader, SelectField, StatusBar, TextField } from '../components/ui'
import { filterWalletTransactions, formatWalletMoney, formatWalletTime, formatWalletTransactionAmount, getWalletOverviewState, getWalletStatusLabel, getWalletTotalCents, validateWithdrawal } from '../components/walletModel'
import { walletRepository } from '../repository/walletRepository'
import type { WalletSnapshot, WalletTransaction, WalletTransactionFilter } from '../types/wallet'
import '../styles/wallet-v2.css'

function WalletTopBar({ title, help = false, overview = false }: { title: string; help?: boolean; overview?: boolean }) {
  const navigate = useNavigate()
  return <><StatusBar tone={overview ? 'inverse' : 'default'} /><PageHeader tone={overview ? 'dark' : 'surface'} className={`wallet-v2-topbar${overview ? ' overview' : ''}`} title={title} left={<IconButton label="返回" onClick={() => navigate(-1)}><ChevronLeft size={25} strokeWidth={2} aria-hidden="true" /></IconButton>} right={overview ? <span className="wallet-v2-detail-label">明细</span> : help ? <Link to="/support">客服</Link> : undefined} /></>
}

function useWalletSnapshot() {
  const [snapshot, setSnapshot] = useState<WalletSnapshot>(() => walletRepository.getSnapshot())
  useEffect(() => walletRepository.subscribe(() => setSnapshot(walletRepository.getSnapshot())), [])
  return [snapshot, () => setSnapshot(walletRepository.getSnapshot())] as const
}

function WalletTransactionRow({ transaction }: { transaction: WalletTransaction }) {
  const isIncome = transaction.direction === 'income'
  return <div className="wallet-v2-transaction" aria-label={`${transaction.title}，${formatWalletTransactionAmount(transaction)}，${getWalletStatusLabel(transaction.status, transaction.kind)}`}>
    <span className="wallet-v2-transaction-copy"><b>{transaction.title}</b><small>{formatWalletTime(transaction.occurredAt, true)}</small></span>
    <span className={`wallet-v2-transaction-amount ${isIncome ? 'income' : ''}`}><b>{formatWalletTransactionAmount(transaction)}</b><small>{getWalletStatusLabel(transaction.status, transaction.kind)}</small></span>
  </div>
}

export function WalletOverviewPage() {
  const [snapshot] = useWalletSnapshot()
  const [filter, setFilter] = useState<WalletTransactionFilter>('all')
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  const previewState = params.get('scenario') ?? params.get('state')
  const zeroBalancePreview = previewState === 'empty' || previewState === 'contract'
  const displayedSnapshot = zeroBalancePreview
    ? { ...snapshot, availableCents: 0, pendingCents: 0, frozenCents: 0, completedOrderEarnings: previewState === 'contract' ? [{ orderId: 'RC-2608-4471', amountCents: 20_000, status: 'contract_required' as const }] : [], transactions: [] }
    : previewState === 'funded' ? snapshot : { ...snapshot, availableCents: 0 }
  const overviewState = getWalletOverviewState(displayedSnapshot, previewState === 'contract', false)
  const filteredTransactions = filterWalletTransactions(displayedSnapshot.transactions, filter)
  return <main className="wallet-v2-page wallet-v2-overview" data-node-id="3681:28588" data-scenario={previewState ?? 'active'}>
    <section className="wallet-v2-overview-hero">
      <WalletTopBar title="" overview />
      <section className="wallet-v2-balance-card" aria-labelledby="wallet-balance-title">
        <p id="wallet-balance-title">可用余额</p><strong>{formatWalletMoney(displayedSnapshot.availableCents)}</strong>
        <small>累计收入 {formatWalletMoney(getWalletTotalCents(displayedSnapshot)).replace('.00', '')}</small>
        <div>{overviewState === 'active' ? <Link to="/wallet/withdraw">提现</Link> : overviewState === 'contract_required' ? <Link to="/fulfillment/contracts/RC-2608-4471">卖家签约</Link> : <button type="button" disabled>提现</button>}</div>
      </section>
    </section>
    <div className="wallet-v2-scroll">
      {overviewState === 'active' && <><aside className="wallet-v2-hold-note"><span aria-hidden="true">ⓘ</span><p>交易中的资金由平台托管，显示为「交易冻结」，完成后自动转入可用余额。</p></aside><section className="wallet-v2-recent" aria-labelledby="wallet-recent-title"><header><Heading id="wallet-recent-title" variant="section">资金记录</Heading><SelectField compact value={filter} onChange={(event) => setFilter(event.target.value as WalletTransactionFilter)} aria-label="资金记录类型" options={[{ value: 'all', label: '全部类型' }, { value: 'income', label: '收入' }, { value: 'expense', label: '支出' }, { value: 'pending', label: '托管中' }]} /></header><div>{filteredTransactions.slice(0, 4).map((transaction) => <WalletTransactionRow key={transaction.id} transaction={transaction} />)}{filteredTransactions.length === 0 && <p className="wallet-v2-filter-empty">暂无此类型记录</p>}</div><p className="wallet-v2-record-end">仅显示近 3 个月记录</p></section></>}
      {overviewState === 'empty' && <section className="wallet-v2-empty-overview"><span><WalletCards size={27} aria-hidden="true" /></span><Heading variant="result">暂无余额明细</Heading></section>}
      {overviewState === 'contract_required' && <section className="wallet-v2-contract-guide"><span><FileSignature size={22} aria-hidden="true" /></span><div><Heading variant="section">您有订单已完成，签约后显示明细内容</Heading><p>根据平台交易与资金结算要求，需要先完成《游戏账号回收协议》签署，签署后余额与明细内容将自动展示。</p></div></section>}
    </div>
  </main>
}

export function WalletWithdrawPage() {
  const navigate = useNavigate()
  const [snapshot] = useWalletSnapshot()
  const [amount, setAmount] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (countdown <= 0) return undefined
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [countdown])
  const validation = validateWithdrawal(amount, snapshot.availableCents)
  const expectedCents = validation.ok ? validation.cents : 0
  const chooseAmount = (cents: number) => { setAmount((Math.min(cents, snapshot.availableCents) / 100).toFixed(2)); setError('') }
  const sendCode = () => { if (countdown > 0) return; setCountdown(60); setError('') }
  const submit = () => {
    if (!validation.ok) { setError(validation.error); return }
    if (!/^\d{4,6}$/.test(code)) { setError('请输入 4–6 位短信验证码'); return }
    if (busy) return
    setBusy(true); setError('')
    window.setTimeout(() => {
      const result = walletRepository.requestWithdrawal(validation.cents)
      setBusy(false)
      if (result.ok) navigate('/wallet', { replace: true })
      else setError(result.error)
    }, 650)
  }
  return <main className="wallet-v2-page wallet-v2-withdraw">
    <WalletTopBar title="申请提现" help />
    <div className="wallet-v2-scroll">
      <section className="wallet-v2-withdraw-balance"><span><WalletCards size={18} aria-hidden="true" />可用余额</span><b>{formatWalletMoney(snapshot.availableCents)}</b><small><CircleCheck size={13} aria-hidden="true" /> 已完成实名认证</small></section>
      <section className="wallet-v2-form-card"><Heading variant="section">提现金额</Heading><label className="wallet-v2-amount"><span>¥</span><input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError('') }} placeholder="0.00" aria-label="提现金额" /></label><div className="wallet-v2-quick-amounts">{[10_000, 50_000, 100_000].map((cents) => <ChoiceChip key={cents} selected={amount === (Math.min(cents, snapshot.availableCents) / 100).toFixed(2)} onClick={() => chooseAmount(cents)}>{formatWalletMoney(cents).replace('.00', '')}</ChoiceChip>)}<ChoiceChip selected={amount === (snapshot.availableCents / 100).toFixed(2)} onClick={() => chooseAmount(snapshot.availableCents)}>全部</ChoiceChip></div>{amount && !validation.ok && <p className="wallet-v2-inline-error">{validation.error}</p>}</section>
      <section className="wallet-v2-form-card wallet-v2-account"><Heading variant="section">到账信息</Heading><div><span>到账方式</span><b>支付宝</b></div><div><span>收款账号</span><b>deepgamer_demo@alipay.com</b></div><div><span>实名姓名</span><b>玩家**</b></div><div><span>提现手续费</span><b>{formatWalletMoney(0)}</b></div><div className="total"><span>预计到账</span><b>{formatWalletMoney(expectedCents)}</b></div></section>
      <section className="wallet-v2-form-card"><Heading variant="section">安全验证</Heading><TextField className="wallet-v2-code" inputMode="numeric" value={code} maxLength={6} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '')); setError('') }} placeholder="请输入短信验证码" aria-label="短信验证码" trailing={<Button variant="ghost" size="sm" onClick={sendCode} disabled={countdown > 0}>{countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}</Button>} /><p className="wallet-v2-demo-code">原型验证码可输入任意 4–6 位数字</p></section>
      <section className="wallet-v2-withdraw-notice"><LockKeyhole size={17} aria-hidden="true" /><p>提交后进入财务审核，预计 1 个工作日内处理。本地原型不会发起真实出款。</p></section>
      {error && <p className="wallet-v2-submit-error" role="alert">{error}</p>}
      <Button className="wallet-v2-submit-layout" size="lg" fullWidth loading={busy} onClick={submit}>提交提现申请</Button>
    </div>
  </main>
}
