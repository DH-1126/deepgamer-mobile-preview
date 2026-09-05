import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Copy, Headphones, Home, Search, ShieldCheck, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { formatOrderCountdown, formatOrderMoney, getOrderPrimaryMessage, getOrderStatusLabel, getOrderTimeline, isOrderRole } from '../components/orderModel'
import { BUYER_ORDER_TABS, countTradeOrders, filterTradeOrders, getActionableTradeOrders, isTradeOrderTab, SELLER_ORDER_TABS, type TradeOrderTab } from '../components/orderHubModel'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { orderRepository } from '../repository/orderRepository'
import type { OrderPaymentMethod, OrderRecord, OrderRole } from '../types/order'
import { assetPath } from '../components/assetPath'
import '../styles/orders-v2.css'

function StatusBar() {
  return <div className="order-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

function OrderTopBar({ title, side }: { title: string; side?: ReactNode }) {
  const navigate = useNavigate()
  return <><StatusBar /><div className="order-v2-topbar"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={20} aria-hidden="true" /></button><h1>{title}</h1><span>{side}</span></div></>
}

function useOrderData() {
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try { orderRepository.expire(); return orderRepository.list() } catch { return [] }
  })
  const [now, setNow] = useState(() => Date.now())
  const refresh = useCallback(() => { try { setOrders(orderRepository.list()) } catch { setOrders([]) } }, [])
  useEffect(() => orderRepository.subscribe(refresh), [refresh])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const at = Date.now(); setNow(at)
      try { if (orderRepository.expire(at) > 0) refresh() } catch { /* keep last usable snapshot */ }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [refresh])
  return { orders, now, refresh }
}

function OrderDialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
    const focusables = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? [])]
    requestAnimationFrame(() => focusables()[0]?.focus())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const items = focusables(); if (!items.length) return
      const first = items[0]; const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); document.body.style.overflow = oldOverflow; previous?.focus() }
  }, [onClose, open])
  if (!open) return null
  return <div className="order-v2-dialog-layer"><button type="button" className="order-v2-dialog-mask" aria-label="关闭弹窗" onClick={onClose} /><section ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="order-dialog-title"><header><h2 id="order-dialog-title">{title}</h2><button type="button" onClick={onClose} aria-label="关闭"><X size={20} aria-hidden="true" /></button></header>{children}</section></div>
}

function OrderEmpty({ title = '暂无订单', detail = '当前筛选条件下没有订单记录。' }: { title?: string; detail?: string }) {
  return <section className="order-v2-empty"><span aria-hidden="true">单</span><h2>{title}</h2><p>{detail}</p><Link to="/game?gameCode=wzry">去逛逛</Link></section>
}

function OrderDomainTabs({ active, buyerCount, sellerCount }: { active: 'buyer' | 'seller' | 'recycle' | 'aftersales'; buyerCount?: number; sellerCount?: number }) {
  const items = [
    { key: 'buyer', label: '买入', count: buyerCount, to: '/orders?role=buyer' },
    { key: 'seller', label: '卖出', count: sellerCount, to: '/orders?role=seller' },
    { key: 'recycle', label: '回收', count: undefined, to: '/orders/recycle' },
    { key: 'aftersales', label: '售后', count: undefined, to: '/aftersales' },
  ] as const
  return <nav className="order-domain-tabs" aria-label="订单类型">{items.map((item) => <Link key={item.key} className={active === item.key ? 'active' : ''} aria-current={active === item.key ? 'page' : undefined} to={item.to}>{item.label}{typeof item.count === 'number' && item.count > 0 ? <b>{item.count}</b> : null}</Link>)}</nav>
}

function ProductRow({ order, compact = false }: { order: OrderRecord; compact?: boolean }) {
  return <div className={`order-product ${compact ? 'compact' : ''}`}><img src={order.thumbnail} alt={order.gameName} /><span><b>{order.productTitle}</b><small>{order.gameName} · {order.server}</small><strong>{formatOrderMoney(order.goodsAmountCents)}</strong></span></div>
}

function cardAction(order: OrderRecord) {
  if (order.status === 'pending') return <Link className="primary full" to={`/orders/checkout?id=${encodeURIComponent(order.id)}`}>去支付 <b>{formatOrderMoney(order.totalAmountCents)}</b></Link>
  if (['paid', 'verifying', 'binding'].includes(order.status)) return <><Link to={`/orders/${order.id}`}>{order.role === 'seller' ? '查看步骤' : '催一下卖家'}</Link><Link className="dark" to={`/im/${order.conversationId ?? 'trade-wzry'}`}>进交易群</Link></>
  if (order.status === 'bind_success') return <><Link className="danger" to={`/orders/${order.id}`}>验号不符</Link><Link className="primary" to={`/orders/${order.id}`}>确认收货</Link></>
  return <Link className="single" to={`/orders/${order.id}`}>查看详情</Link>
}

function OrderListCard({ order, now }: { order: OrderRecord; now: number }) {
  const countdown = order.status === 'pending' ? formatOrderCountdown(order.expiresAt, now) : order.status === 'bind_success' ? formatOrderCountdown(order.actionExpiresAt, now) : ''
  return <article className={`order-list-card state-${order.status}`}>
    <header><span><em>{getOrderStatusLabel(order.status, order.role)}</em>{['pending', 'bind_success'].includes(order.status) && <b>该你了</b>}</span>{countdown ? <time>{countdown}</time> : <small>{order.status === 'binding' ? '已 41分钟' : order.role === 'seller' ? '卖家订单' : ''}</small>}</header>
    <Link className="order-card-main" to={`/orders/${order.id}`}><ProductRow order={order} compact /></Link>
    <p>{order.status === 'pending' ? '超时未付将自动取消订单并释放该商品' : order.status === 'binding' ? (order.role === 'seller' ? '请在平台交易群内按步骤完成换绑' : '超 24 小时未换绑可申请客服介入') : order.status === 'bind_success' ? '72 小时后系统自动确认；有问题请在此之前反馈' : getOrderPrimaryMessage(order).detail}</p>
    <footer>{cardAction(order)}</footer>
  </article>
}

export function OrderListPage() {
  const { orders, now } = useOrderData()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const query = params.get('query') ?? ''
  const role: OrderRole = isOrderRole(params.get('role')) ? params.get('role') as OrderRole : 'buyer'
  const tabs = role === 'buyer' ? BUYER_ORDER_TABS : SELLER_ORDER_TABS
  const statusParam = params.get('status')
  const status: TradeOrderTab = isTradeOrderTab(role, statusParam) ? statusParam : 'all'
  const visible = useMemo(() => filterTradeOrders(orders, role, status, query), [orders, query, role, status])
  const actionable = getActionableTradeOrders(orders, role)
  const update = (key: 'status' | 'query', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  return <main className="order-v2-page order-list-page">
    <header className="order-list-header"><StatusBar /><div className="order-list-title"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={19} aria-hidden="true" /></button><h1>订单</h1><form role="search" onSubmit={(event) => event.preventDefault()}><Search size={15} aria-hidden="true" /><input value={query} maxLength={80} onChange={(event) => update('query', event.target.value)} placeholder="搜索订单" aria-label="搜索订单号、商品编号、游戏或商品" />{query && <button type="button" onClick={() => update('query', '')} aria-label="清空搜索"><X size={14} /></button>}</form><Link to={SUPPORT_CONVERSATION_ROUTE} aria-label="联系平台客服"><Headphones size={18} aria-hidden="true" /></Link></div>
      <OrderDomainTabs active={role} buyerCount={countTradeOrders(orders, 'buyer', 'all')} sellerCount={countTradeOrders(orders, 'seller', 'all')} />
      <div className="order-status-tabs" role="tablist" aria-label="订单状态筛选">{tabs.map((item) => <button type="button" role="tab" key={item.value} className={status === item.value ? 'active' : ''} aria-selected={status === item.value} onClick={() => update('status', item.value)}><span>{item.label}</span><b>{countTradeOrders(orders, role, item.value)}</b></button>)}</div>
    </header>
    <div className="order-list-scroll">
      {actionable.length > 0 && status === 'all' && !query && <section className="order-task-summary"><h2><i />需要你处理 · <b>{actionable.length}</b>件</h2><p>{actionable.map((order) => order.status === 'pending' ? `1 笔待付款，剩 ${formatOrderCountdown(order.expiresAt, now)}` : order.status === 'bind_success' ? `1 笔待确认，剩 ${formatOrderCountdown(order.actionExpiresAt, now)}` : '1 笔订单待换绑').join(' · ')}</p></section>}
      {visible.length ? visible.map((order) => <OrderListCard key={order.id} order={order} now={now} />) : <OrderEmpty title={query ? '没有匹配的订单' : '暂无订单'} />}
    </div>
  </main>
}

function CheckoutSummary({ order }: { order: OrderRecord }) {
  return <section className="checkout-product-card"><ProductRow order={order} /><span className="checkout-wants">还有 12 人想要</span></section>
}

function PaymentMethods({ value, onChange }: { value: OrderPaymentMethod; onChange: (value: OrderPaymentMethod) => void }) {
  return <section className="payment-methods" aria-label="选择支付方式"><button type="button" aria-pressed={value === 'alipay'} onClick={() => onChange('alipay')}><i className="alipay">支</i><span>支付宝</span><b>{value === 'alipay' && <Check size={12} aria-hidden="true" />}</b></button><button type="button" aria-pressed={value === 'wechat'} onClick={() => onChange('wechat')}><i className="wechat">微</i><span>微信</span><b>{value === 'wechat' && <Check size={12} aria-hidden="true" />}</b></button></section>
}

export function OrderCheckoutPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { orders, refresh } = useOrderData()
  const order = orders.find((item) => item.id === params.get('id')) ?? orders.find((item) => item.status === 'pending')
  const [method, setMethod] = useState<OrderPaymentMethod>('alipay')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  if (!order) return <main className="order-v2-page"><OrderTopBar title="订单确认" /><OrderEmpty title="订单不存在" /></main>
  const confirmPayment = () => {
    const ok = orderRepository.pay(order.id, method); refresh(); setConfirmOpen(false)
    if (ok) navigate(`/payment/success?id=${encodeURIComponent(order.id)}`, { replace: true })
    else setError('订单已过期或状态已变化，请返回订单列表确认。')
  }
  return <main className="order-v2-page checkout-page">
    <header><OrderTopBar title="订单确认" /></header>
    <div className="checkout-scroll"><CheckoutSummary order={order} />
      <section className="insurance-card"><header><ShieldCheck size={15} aria-hidden="true" /><b>深度玩家 × 平安财产保险</b></header><div><span><b>包赔服务</b><small>账号被找回可获赔</small></span><button type="button">服务说明 <ChevronRight size={13} /></button></div><article><span><b>全倍包赔 <em>推荐</em></b><small>赔 100% · 最高赔付 {formatOrderMoney(order.goodsAmountCents)}</small></span><strong>{formatOrderMoney(order.insuranceAmountCents)}</strong><i><Check size={11} /></i></article></section>
      <section className="checkout-coupon"><b>优惠券</b><span>暂无可用优惠券 <ChevronRight size={13} /></span></section>
      <PaymentMethods value={method} onChange={setMethod} />
      <p className="checkout-agreement"><i><Check size={10} /></i>支付即同意 <button type="button">《购买须知》</button> 和 <button type="button">《支付须知》</button></p>
      {error && <p className="order-inline-error" role="alert">{error}</p>}
    </div>
    <footer className="checkout-footer"><span><strong>{formatOrderMoney(order.totalAmountCents)}</strong><small>明细⌃</small></span><button type="button" disabled={order.status !== 'pending'} onClick={() => setConfirmOpen(true)}>{order.status === 'pending' ? '立即支付' : getOrderStatusLabel(order.status, order.role)}</button></footer>
    <OrderDialog open={confirmOpen} title="风险提示" onClose={closeConfirm}><div className="order-dialog-body order-risk-dialog"><AlertTriangle size={34} aria-hidden="true" /><p>账号交易存在被找回风险，请确认已经了解平台交易规则及包赔服务范围。</p><div className="order-dialog-highlight"><span>当前已选 全倍包赔</span><b>最高赔付 {formatOrderMoney(order.goodsAmountCents)}</b></div><footer><button type="button" onClick={closeConfirm}>返回修改</button><button type="button" className="primary" onClick={confirmPayment}>我已知晓</button></footer></div></OrderDialog>
  </main>
}

export function PaymentCancelPage() {
  const [params] = useSearchParams()
  const { orders, refresh } = useOrderData()
  const order = orders.find((item) => item.id === params.get('id')) ?? orders.find((item) => item.status === 'pending')
  const [error, setError] = useState('')
  const [reason, setReason] = useState('找到更合适的号')
  if (!order) return <main className="order-v2-page"><OrderTopBar title="取消订单" /><OrderEmpty title="订单不存在" /></main>
  const cancel = () => {
    if (!orderRepository.cancel(order.id)) setError('订单状态已变化，无法取消。')
    refresh()
  }
  const cancelled = order.status === 'cancelled'
  const reasons = [
    ['找到更合适的号', '价格或账号资产更符合预期'],
    ['价格太高了', '想再比较其他账号'],
    ['账号信息与描述不符', '可先联系平台同步核验'],
    ['担心交易风险', '可查看平台保障说明'],
    ['不想买了 / 其他', '本次暂不继续购买'],
  ]
  return <main className="order-v2-page cancel-page"><OrderTopBar title={cancelled ? '取消结果' : '取消订单'} /><div className="cancel-page-scroll">{cancelled ? <><section className="cancel-context"><h2>订单已取消</h2><p>该操作已经完成，不会产生任何扣款。</p>{error && <small role="alert">{error}</small>}</section><CheckoutSummary order={order} /></> : <section className="cancel-reason-sheet"><h2>为什么取消？</h2><p>选择一个原因，帮助我们改进体验</p><div className="cancel-reason-list" role="radiogroup" aria-label="取消原因">{reasons.map(([label, detail]) => <button type="button" role="radio" aria-checked={reason === label} className={reason === label ? 'selected' : ''} key={label} onClick={() => setReason(label)}><span><b>{label}</b><small>{detail}</small></span><i>{reason === label && <Check size={12} strokeWidth={3} />}</i></button>)}</div><div className="cancel-risk-note">还有 <b>12 人</b>想要，该商品可能随时被其他买家买走</div>{error && <small role="alert">{error}</small>}</section>}</div><footer className="cancel-actions">{cancelled ? <><Link to="/orders?role=buyer&status=ended">返回订单</Link><Link className="primary" to="/game?gameCode=wzry">继续逛逛</Link></> : <><button type="button" className="danger" onClick={cancel}>确认取消</button><Link className="primary" to={`/orders/checkout?id=${encodeURIComponent(order.id)}`}>继续支付</Link></>}</footer></main>
}

export function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const { orders } = useOrderData()
  const order = orders.find((item) => item.id === params.get('id'))
  const successful = order && ['paid', 'verifying', 'binding', 'bind_success', 'completed'].includes(order.status)
  if (!order) return <main className="order-v2-page"><OrderTopBar title="支付结果" /><OrderEmpty title="订单不存在" /></main>
  if (!successful) return <main className="order-v2-page"><OrderTopBar title="支付结果" /><section className="payment-result-state error"><i>!</i><h2>支付未完成</h2><p>当前订单状态：{getOrderStatusLabel(order.status, order.role)}</p><Link to={`/orders/checkout?id=${encodeURIComponent(order.id)}`}>返回订单</Link></section></main>
  return <main className="order-v2-page payment-success-page"><OrderTopBar title="支付结果" side={<Link to="/"><Home size={19} aria-hidden="true" /></Link>} /><div className="payment-result-scroll"><section className="payment-success-hero"><i><Check size={28} strokeWidth={2.8} /></i><h2>支付成功</h2><strong>{formatOrderMoney(order.totalAmountCents)}</strong><p>资金已由平台托管，验号换绑后放款给卖家</p></section><section className="payment-next"><h3><i />接下来该做什么</h3><p>请尽快进入交易群，客服会在群内协助你和卖家完成验号与换绑。全程不要在群外私下交易。</p><Link to={`/im/${order.conversationId ?? 'trade-wzry'}`}>进入交易群</Link></section><section className="payment-order-info"><dl><div><dt>商品</dt><dd>{order.gameName} {order.server}</dd></div><div><dt>订单编号</dt><dd>{order.id}</dd></div><div><dt>支付方式</dt><dd>{order.paymentMethod === 'wechat' ? '微信' : '支付宝'}</dd></div></dl></section><div className="payment-result-links"><Link to="/">回到首页</Link><Link to={`/orders/${order.id}`}>查看订单详情</Link></div></div></main>
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { orders, now } = useOrderData()
  const [toast, setToast] = useState('')
  const order = orders.find((item) => item.id === id)
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 1600); return () => window.clearTimeout(timer) }, [toast])
  if (!order) return <main className="order-v2-page"><OrderTopBar title="订单详情" /><OrderEmpty title="订单不存在" /></main>
  const hero = getOrderPrimaryMessage(order)
  const timeline = getOrderTimeline(order, now)
  const terminal = ['pay_expired', 'cancelled', 'closed'].includes(order.status)
  const copy = async () => { try { await navigator.clipboard.writeText(order.id); setToast('订单号已复制') } catch { setToast('复制失败，请手动复制') } }
  return <main className={`order-v2-page order-detail-page state-${order.status}`}><header><OrderTopBar title="订单详情" side={<small>{order.role === 'seller' ? '卖家视角' : '买家视角'}</small>} /></header><div className="order-detail-scroll">
    <section className={`order-detail-hero ${terminal ? 'terminal' : ''}`}>{terminal ? <><i className="order-terminal-icon" aria-hidden="true">{order.status === 'pay_expired' ? '⌛' : '×'}</i><h2>{order.status === 'pay_expired' ? '支付超时，订单已关闭' : hero.title}</h2><p>{order.status === 'pay_expired' ? '未产生费用，商品已重新开放购买' : hero.detail}</p><div><Link to={`/game?gameCode=${encodeURIComponent(order.gameCode)}`}>看看相似商品</Link><Link className="primary" to={`/game?gameCode=${encodeURIComponent(order.gameCode)}`}>重新购买</Link></div></> : <><span><b>步骤 {order.status === 'pending' ? '1' : order.status === 'paid' || order.status === 'verifying' ? '2' : order.status === 'binding' ? '3' : order.status === 'bind_success' ? '4' : '5'} / 5</b><em>{['pending', 'bind_success'].includes(order.status) ? '该你了' : '等对方'}</em></span><h2>{hero.title}</h2><p>{hero.detail}</p>{order.status === 'pending' && <time>还剩 <b>{formatOrderCountdown(order.expiresAt, now)}</b></time>}{order.status === 'binding' && order.role === 'seller' && <time>换绑资料剩 <b>{formatOrderCountdown(order.actionExpiresAt, now)}</b></time>}<div>{order.status === 'pending' ? <><Link to={`/payment/cancel?id=${encodeURIComponent(order.id)}`}>取消订单</Link><Link className="primary" to={`/orders/checkout?id=${encodeURIComponent(order.id)}`}>继续支付</Link></> : ['paid', 'verifying', 'binding', 'bind_success'].includes(order.status) ? <><Link to={SUPPORT_CONVERSATION_ROUTE}>申请客服介入</Link><Link className="dark" to={`/im/${order.conversationId ?? 'trade-wzry'}`}>进交易群</Link></> : <Link className="primary single" to="/orders">返回订单列表</Link>}</div></>}</section>
    {['paid', 'verifying', 'binding', 'bind_success'].includes(order.status) && <section className="order-escrow"><ShieldCheck size={15} /><span><b>{formatOrderMoney(order.totalAmountCents)}</b> 仍在平台托管，未支付给卖家。</span></section>}
    {!terminal && <section className="order-progress"><h2>交易进度</h2><ol>{timeline.map((item) => <li key={item.key} className={item.state}><i /> <span><b>{item.title}</b>{item.detail && <small>{item.detail}</small>}</span></li>)}</ol></section>}
    <section className="order-detail-product"><ProductRow order={order} /><dl><div><dt>商品价</dt><dd>{formatOrderMoney(order.goodsAmountCents)}</dd></div><div><dt>包赔服务</dt><dd>{order.insuranceAmountCents ? formatOrderMoney(order.insuranceAmountCents) : '未购买'}</dd></div><div><dt>实付</dt><dd>{formatOrderMoney(order.totalAmountCents)}</dd></div></dl><footer><span>订单号 <b>{order.id}</b></span><button type="button" onClick={copy}><Copy size={13} />复制</button></footer></section>
    <Link className="order-help" to={SUPPORT_CONVERSATION_ROUTE}><span><b>遇到问题？</b><small>卖家迟迟不换绑 · 收到的号与描述不符 · 其他</small></span><ChevronRight size={15} /></Link>
  </div>{toast && <div className="order-v2-toast" role="status">{toast}</div>}</main>
}
