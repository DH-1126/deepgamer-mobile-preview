import { useEffect, useState } from 'react'
import { ChevronLeft, CircleCheck, FileSignature, LockKeyhole, RefreshCw, WalletCards } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { formatWalletMoney, formatWalletTime, formatWalletTransactionAmount, getWalletOverviewState, getWalletStatusLabel, getWalletTotalCents, validateWithdrawal } from '../components/walletModel'
import { walletRepository } from '../repository/walletRepository'
import type { WalletSnapshot, WalletTransaction } from '../types/wallet'
import '../styles/wallet-v2.css'

function WalletStatusBar() {
  return <div className="wallet-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

function WalletTopBar({ title, help = false }: { title: string; help?: boolean }) {
  const navigate = useNavigate()
  return <><WalletStatusBar /><header className="wallet-v2-topbar"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ChevronLeft size={25} strokeWidth={2} aria-hidden="true" /></button><h1>{title}</h1>{help ? <Link to="/support">客服</Link> : <span />}</header></>
}

function useWalletSnapshot() {
  const [snapshot, setSnapshot] = useState<WalletSnapshot>(() => walletRepository.getSnapshot())
  useEffect(() => walletRepository.subscribe(() => setSnapshot(walletRepository.getSnapshot())), [])
  return [snapshot, () => setSnapshot(walletRepository.getSnapshot())] as const
}

function WalletTransactionRow({ transaction }: { transaction: WalletTransaction }) {
  const isIncome = transaction.direction === 'income'
  return <div className="wallet-v2-transaction" aria-label={`${transaction.title}，${formatWalletTransactionAmount(transaction)}，${getWalletStatusLabel(transaction.status)}`}>
    <span className="wallet-v2-transaction-copy"><b>{transaction.title}</b><small>{formatWalletTime(transaction.occurredAt, true)}</small></span>
    <span className={`wallet-v2-transaction-amount ${isIncome ? 'income' : ''}`}><b>{formatWalletTransactionAmount(transaction)}</b><small>{getWalletStatusLabel(transaction.status)}</small></span>
  </div>
}

export function WalletOverviewPage() {
  const [snapshot, refreshSnapshot] = useWalletSnapshot()
  const [refreshing, setRefreshing] = useState(false)
  const { search } = useLocation()
  const navigate = useNavigate()
  const previewState = new URLSearchParams(search).get('state')
  const zeroBalancePreview = previewState === 'empty' || previewState === 'contract'
  const displayedSnapshot = zeroBalancePreview ? { ...snapshot, availableCents: 0, pendingCents: 0, frozenCents: 0, completedOrderEarnings: previewState === 'contract' ? [{ orderId: 'RC-2608-4471', amountCents: 20_000, status: 'contract_required' as const }] : [], transactions: [] } : snapshot
  const overviewState = getWalletOverviewState(displayedSnapshot, previewState === 'contract', false)
  const switchState = () => navigate(overviewState === 'active' ? '/wallet?state=empty' : overviewState === 'empty' ? '/wallet?state=contract' : '/wallet', { replace: true })
  const refreshTransactions = () => {
    if (refreshing) return
    setRefreshing(true)
    refreshSnapshot()
    window.setTimeout(() => setRefreshing(false), 650)
  }
  return <main className="wallet-v2-page wallet-v2-overview">
    <WalletTopBar title="我的钱包" help />
    <div className="wallet-v2-scroll">
      <section className="wallet-v2-balance-card" aria-labelledby="wallet-balance-title">
        <button className="wallet-v2-balance-mark" type="button" onClick={switchState} aria-label={`切换钱包展示状态，当前为${overviewState === 'active' ? '有明细' : overviewState === 'empty' ? '无明细' : '待签约'}`}><WalletCards size={21} aria-hidden="true" /></button>
        <p id="wallet-balance-title">可用余额</p><strong>{formatWalletMoney(displayedSnapshot.availableCents)}</strong>
        <small>总资产 {formatWalletMoney(getWalletTotalCents(displayedSnapshot))}</small>
        <div>{overviewState === 'active' ? <Link to="/wallet/withdraw">提现</Link> : overviewState === 'contract_required' ? <Link to="/fulfillment/contracts/RC-2608-4471">卖家签约</Link> : <button type="button" disabled>提现</button>}</div>
      </section>

      {overviewState === 'active' && <section className="wallet-v2-recent" aria-labelledby="wallet-recent-title"><header><h2 id="wallet-recent-title">余额明细</h2><button type="button" onClick={refreshTransactions} disabled={refreshing} aria-label="刷新余额明细"><RefreshCw className={refreshing ? 'spinning' : ''} size={17} aria-hidden="true" /></button></header><div>{displayedSnapshot.transactions.slice(0, 4).map((transaction) => <WalletTransactionRow key={transaction.id} transaction={transaction} />)}</div></section>}
      {overviewState === 'empty' && <section className="wallet-v2-empty-overview"><span><WalletCards size={27} aria-hidden="true" /></span><h2>暂无余额明细</h2></section>}
      {overviewState === 'contract_required' && <section className="wallet-v2-contract-guide"><span><FileSignature size={22} aria-hidden="true" /></span><div><h2>您有订单已完成，签约后显示明细内容</h2><p>根据平台交易与资金结算要求，需要先完成《游戏账号回收协议》签署，签署后余额与明细内容将自动展示。</p></div></section>}
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
      <section className="wallet-v2-form-card"><h2>提现金额</h2><label className="wallet-v2-amount"><span>¥</span><input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError('') }} placeholder="0.00" aria-label="提现金额" /></label><div className="wallet-v2-quick-amounts">{[10_000, 50_000, 100_000].map((cents) => <button type="button" key={cents} onClick={() => chooseAmount(cents)}>{formatWalletMoney(cents).replace('.00', '')}</button>)}<button type="button" onClick={() => chooseAmount(snapshot.availableCents)}>全部</button></div>{amount && !validation.ok && <p className="wallet-v2-inline-error">{validation.error}</p>}</section>
      <section className="wallet-v2-form-card wallet-v2-account"><h2>到账信息</h2><div><span>到账方式</span><b>支付宝</b></div><div><span>收款账号</span><b>deepgamer_demo@alipay.com</b></div><div><span>实名姓名</span><b>玩家**</b></div><div><span>提现手续费</span><b>{formatWalletMoney(0)}</b></div><div className="total"><span>预计到账</span><b>{formatWalletMoney(expectedCents)}</b></div></section>
      <section className="wallet-v2-form-card"><h2>安全验证</h2><label className="wallet-v2-code"><input inputMode="numeric" value={code} maxLength={6} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '')); setError('') }} placeholder="请输入短信验证码" aria-label="短信验证码" /><button type="button" onClick={sendCode} disabled={countdown > 0}>{countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}</button></label><p className="wallet-v2-demo-code">原型验证码可输入任意 4–6 位数字</p></section>
      <section className="wallet-v2-withdraw-notice"><LockKeyhole size={17} aria-hidden="true" /><p>提交后进入财务审核，预计 1 个工作日内处理。本地原型不会发起真实出款。</p></section>
      {error && <p className="wallet-v2-submit-error" role="alert">{error}</p>}
      <button className="wallet-v2-submit" type="button" onClick={submit} disabled={busy}>{busy ? '正在提交…' : '提交提现申请'}</button>
    </div>
  </main>
}
