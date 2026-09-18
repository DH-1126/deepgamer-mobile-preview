import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { resolveTitle, TitleBlocks, type TitleProduct } from '@deepgamer/product-presentation'
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Copy, Headphones, ShieldCheck, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { formatOrderCountdown, formatOrderMoney, getOrderPrimaryMessage, getOrderStatusLabel, getOrderTimeline, getOrderWorkflowPhase, getOrderWorkflowProgress, isOrderReleaseReady, isOrderRole } from '../components/orderModel'
import { BUYER_ORDER_TABS, countTradeOrders, filterTradeOrders, getActionableTradeOrders, isTradeOrderTab, SELLER_ORDER_TABS, type TradeOrderTab } from '../components/orderHubModel'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { orderRepository } from '../repository/orderRepository'
import { messageRepository } from '../repository/messageRepository'
import type { OrderPaymentMethod, OrderRecord, OrderRole } from '../types/order'
import { assetPath } from '../components/assetPath'
import { useTitleDefinition } from '../components/titleConfigClient'
import { OrderListCard } from '../components/OrderListCard'
import { formatOrderListMoney } from '../components/orderListPresentation'
import { Button, Dialog, Heading, PageHeader, SearchField, StatusBar, Tabs, Toast } from '../components/ui'
import '../styles/orders-v2.css'

function OrderTopBar({ title, side }: { title: string; side?: ReactNode }) {
  const navigate = useNavigate()
  return <><StatusBar className="order-v2-status" /><PageHeader className="order-v2-topbar" bordered={false} title={title} left={<button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={20} aria-hidden="true" /></button>} right={side} /></>
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

function OrderEmpty({ title = '暂无订单', detail = '当前筛选条件下没有订单记录。' }: { title?: string; detail?: string }) {
  return <section className="order-v2-empty"><span aria-hidden="true">单</span><Heading as="h2" variant="result">{title}</Heading><p>{detail}</p><Link to="/game?gameCode=wzry">去逛逛</Link></section>
}

function OrderDomainTabs({ active, buyerCount, sellerCount }: { active: 'buyer' | 'seller' | 'aftersales'; buyerCount?: number; sellerCount?: number }) {
  const navigate = useNavigate()
  const routes = { buyer: '/orders?role=buyer', seller: '/orders?role=seller', aftersales: '/aftersales' }
  return <Tabs variant="underline" className="order-domain-tabs-ui" label="订单类型" panelId="order-status-panel" value={active} onValueChange={(value) => navigate(routes[value as keyof typeof routes])} items={[{ value: 'buyer', label: '买入', count: buyerCount }, { value: 'seller', label: '卖出', count: sellerCount }, { value: 'aftersales', label: '售后' }]} />
}

function orderTradeRoute(order: OrderRecord) {
  return order.conversationId
    ? `/im/${encodeURIComponent(order.conversationId)}?orderId=${encodeURIComponent(order.id)}&role=${order.role}`
    : SUPPORT_CONVERSATION_ROUTE
}

async function syncOrderConversation(order: OrderRecord) {
  if (!order.conversationId) return false
  const current = orderRepository.get(order.id)
  if (!current) return false
  return messageRepository.syncWorkflow({
    conversationId: order.conversationId,
    orderId: order.id,
    phase: current.pausedPhase ? 'paused' : getOrderWorkflowPhase(current.status),
    pausedPhase: current.pausedPhase,
    role: current.role,
  })
}

function OrderProductTitle({ order, primaryOnly = false }: { order: OrderRecord; primaryOnly?: boolean }) {
  const { definition } = useTitleDefinition(order.gameCode)
  const titleProduct = useMemo<TitleProduct>(() => ({
    id: order.productId,
    gameCode: order.gameCode,
    gameName: order.gameName,
    title: order.productTitle,
    productCode: order.productId,
    platform: order.server,
    values: order.titleValues ?? {},
    revision: order.updatedAt,
    image: order.thumbnail,
    price: order.goodsAmountCents / 100,
  }), [order])
  const result = useMemo(() => resolveTitle(definition, titleProduct, 'LIST_CARD'), [definition, titleProduct])
  if (!order.titleValues || !Object.keys(order.titleValues).length) return <strong className="order-shared-title order-product-title-fallback">{order.productTitle}</strong>
  return <TitleBlocks result={result} primaryOnly={primaryOnly} className="order-shared-title" />
}

function ProductRow({ order, compact = false }: { order: OrderRecord; compact?: boolean }) {
  return <div className={`order-product ${compact ? 'compact' : ''}`}><img src={order.thumbnail} alt={order.gameName} /><span><OrderProductTitle order={order} primaryOnly={compact} /><small>{order.gameName} · {order.server}</small><strong>{formatOrderMoney(order.goodsAmountCents)}</strong></span></div>
}

export function OrderListPage() {
  const { orders, now } = useOrderData()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [payoutOrder, setPayoutOrder] = useState<OrderRecord | null>(null)
  const closePayout = useCallback(() => setPayoutOrder(null), [])
  const query = params.get('query') ?? ''
  const [draftQuery, setDraftQuery] = useState(query)
  const role: OrderRole = isOrderRole(params.get('role')) ? params.get('role') as OrderRole : 'buyer'
  const tabs = role === 'buyer' ? BUYER_ORDER_TABS : SELLER_ORDER_TABS
  const statusParam = params.get('status')
  const status: TradeOrderTab = isTradeOrderTab(role, statusParam) ? statusParam : 'all'
  const visible = useMemo(() => filterTradeOrders(orders, role, status, query), [orders, query, role, status])
  const scenario = params.get('scenario')
  const actionable = getActionableTradeOrders(orders, role)
  const update = (key: 'status' | 'query', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  useEffect(() => setDraftQuery(query), [query])
  const submitSearch = () => update('query', draftQuery.trim())
  return <main className="order-v2-page order-list-page">
    <header className="order-list-header"><StatusBar /><div className="order-list-title"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={19} aria-hidden="true" /></button><Heading as="h1" variant="page">订单</Heading><div className="order-list-search-layout" role="search"><SearchField className="order-list-search-field" value={draftQuery} maxLength={80} onChange={(event) => setDraftQuery(event.target.value)} onClear={() => setDraftQuery('')} onSearch={submitSearch} placeholder="搜索订单" aria-label="搜索订单号、商品编号、游戏或商品" /></div><Link to={SUPPORT_CONVERSATION_ROUTE} aria-label="联系平台客服"><Headphones size={18} aria-hidden="true" /></Link></div>
      <OrderDomainTabs active={role} buyerCount={countTradeOrders(orders, 'buyer', 'all')} sellerCount={countTradeOrders(orders, 'seller', 'all')} />
      <Tabs className="order-status-tabs-ui" label="订单状态筛选" panelId="order-status-panel" value={status} onValueChange={(value) => update('status', value)} items={tabs.map((item) => ({ value: item.value, label: item.label, count: countTradeOrders(orders, role, item.value) }))} />
    </header>
    <div className="order-list-scroll" id="order-status-panel" role="tabpanel">
      {scenario !== 'error' && actionable.length > 0 && status === 'all' && !query && <section className="order-task-summary"><Heading as="h2" variant="section"><i />需要你处理 · <b>{actionable.length}</b>件</Heading><p>{actionable.map((order) => order.status === 'pending' ? `1 笔待付款，剩 ${formatOrderCountdown(order.expiresAt, now)}` : order.status === 'bind_success' ? `1 笔待确认，剩 ${formatOrderCountdown(order.actionExpiresAt, now)}` : '1 笔订单待换绑').join(' · ')}</p></section>}
      {scenario === 'error' ? <section className="order-v2-empty error"><span aria-hidden="true">!</span><Heading as="h2" variant="result">订单加载失败</Heading><p>这是本地异常场景。移除 scenario 参数即可恢复正常订单列表。</p><button type="button" onClick={() => { const next = new URLSearchParams(params); next.delete('scenario'); setParams(next, { replace: true }) }}>重新加载</button></section> : scenario === 'empty' || !visible.length ? <OrderEmpty title={query ? '没有匹配的订单' : '暂无订单'} /> : visible.map((order) => <OrderListCard key={order.id} order={order} now={now} onShowPayout={setPayoutOrder} />)}
    </div>
    <Dialog open={Boolean(payoutOrder)} title="打款明细" onClose={closePayout} actions={<Button onClick={closePayout}>我知道了</Button>}>
      {payoutOrder && <dl className="order-payout-details">
        <div><dt>打款金额</dt><dd className="order-payout-amount">{formatOrderListMoney(payoutOrder.goodsAmountCents)}</dd></div>
        <div><dt>打款状态</dt><dd>已打款</dd></div>
        <div><dt>订单号</dt><dd>{payoutOrder.id}</dd></div>
        <div><dt>打款时间</dt><dd>{new Date(payoutOrder.updatedAt).toLocaleString('zh-CN', { hour12: false })}</dd></div>
        <div><dt>交易类型</dt><dd>账号回收</dd></div>
      </dl>}
    </Dialog>
  </main>
}

function CheckoutSummary({ order }: { order: OrderRecord }) {
  return <section className="checkout-product-card"><ProductRow order={order} /><span className="checkout-wants">还有 12 人想要</span></section>
}

function PaymentMethods({ value, onChange }: { value: OrderPaymentMethod; onChange: (value: OrderPaymentMethod) => void }) {
  return <section className="payment-methods" aria-label="选择支付方式"><button type="button" aria-pressed={value === 'alipay'} onClick={() => onChange('alipay')}><i className="alipay">支</i><span>支付宝</span><b>{value === 'alipay' && <Check size={12} aria-hidden="true" />}</b></button><button type="button" aria-pressed={value === 'wechat'} onClick={() => onChange('wechat')}><i className="wechat">微</i><span>微信</span><b>{value === 'wechat' && <Check size={12} aria-hidden="true" />}</b></button></section>
}

type PaymentResult = 'success' | 'expired'

function PaymentResultOverlay({ order, result, onComplete }: { order: OrderRecord; result: PaymentResult; onComplete: () => void }) {
  useEffect(() => {
    if (result !== 'success') return
    const timer = window.setTimeout(onComplete, 1000)
    return () => window.clearTimeout(timer)
  }, [onComplete, result])
  const success = result === 'success'
  const paidAt = order.paidAt ?? order.updatedAt
  return <div className="payment-result-overlay" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="payment-result-title" className={`payment-result-dialog ${success ? 'success' : 'expired'}`}>
      <i className="payment-result-icon" aria-hidden="true">{success ? <Check size={42} strokeWidth={3} /> : <X size={46} strokeWidth={3} />}</i>
      <Heading id="payment-result-title" as="h2" variant="hero">{success ? '支付成功' : '支付失败'}</Heading>
      {success ? <>
        <p>您的订单已完成支付，平台将继续保障交易履约。</p>
        <em>交易资金已加密确认</em>
        <dl>
          <div><dt>支付金额</dt><dd>{formatOrderMoney(order.totalAmountCents)}</dd></div>
          <div><dt>订单号</dt><dd>{order.paymentReference ?? `PAY${order.id.replace(/\D/g, '')}`}</dd></div>
          <div><dt>支付时间</dt><dd>{new Date(paidAt).toLocaleString('zh-CN', { hour12: false })}</dd></div>
        </dl>
        <button type="button" onClick={onComplete}>完成（1s后自动跳转）</button>
      </> : <>
        <p>订单已过期</p>
        <em>请检查支付状态后再试</em>
        <button type="button" onClick={onComplete}>知道了</button>
      </>}
    </section>
  </div>
}

export function OrderCheckoutPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { orders, refresh } = useOrderData()
  const order = orders.find((item) => item.id === params.get('id')) ?? orders.find((item) => item.status === 'pending')
  const paymentStage = params.get('stage') === 'payment'
  const [method, setMethod] = useState<OrderPaymentMethod>('alipay')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const resultParam = params.get('result')
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  if (!order) return <main className="order-v2-page"><OrderTopBar title="订单确认" /><OrderEmpty title="订单不存在" /></main>
  const openCashier = () => {
    const next = new URLSearchParams(params)
    next.set('id', order.id)
    next.set('stage', 'payment')
    setConfirmOpen(false)
    setParams(next, { replace: true })
  }
  const returnToConfirmation = () => {
    const next = new URLSearchParams(params)
    next.delete('stage')
    setParams(next, { replace: true })
  }
  const confirmPayment = () => {
    const ok = orderRepository.pay(order.id, method); refresh(); setConfirmOpen(false)
    const next = new URLSearchParams(params)
    next.set('id', order.id); next.set('stage', 'payment')
    if (ok) { next.set('result', 'success'); setParams(next, { replace: true }) }
    else if (orderRepository.get(order.id)?.status === 'pay_expired') { next.set('result', 'expired'); setParams(next, { replace: true }) }
    else setError('订单状态已变化，请返回订单列表确认。')
  }
  const result: PaymentResult | null = resultParam === 'success' && !['pending', 'pay_expired', 'cancelled'].includes(order.status)
    ? 'success'
    : resultParam === 'expired' && order.status === 'pay_expired' ? 'expired' : null
  const finishResult = () => navigate(`/orders/${encodeURIComponent(order.id)}`, { replace: true })
  if (paymentStage) return <main className="order-v2-page checkout-page cashier-page">
    <header><OrderTopBar title="确认支付" /></header>
    <div className="checkout-scroll cashier-scroll">
      <section className="cashier-order-card"><header><b>订单信息</b><code>{order.id}</code></header><p>交易订单支付</p><strong>{formatOrderMoney(order.totalAmountCents)}</strong><small>订单号　{order.id}</small></section>
      <section className="cashier-method-card"><header><b>支付方式</b><time>剩余 {formatOrderCountdown(order.expiresAt, Date.now())}</time></header><PaymentMethods value={method} onChange={setMethod} /></section>
      <section className="cashier-note"><Heading as="h2" variant="section">支付说明</Heading><p>点击确认支付后将锁定订单并进入后续履约。当前为本地安全演示，只更新演示订单状态，不会连接支付机构、生成二维码或产生真实扣款。</p></section>
      {error && <p className="order-inline-error" role="alert">{error}</p>}
    </div>
    <footer className="cashier-footer"><button type="button" onClick={returnToConfirmation}>返回</button><button type="button" className="primary" disabled={order.status !== 'pending'} onClick={confirmPayment}>确认支付 {formatOrderMoney(order.totalAmountCents)}</button></footer>
    {result && <PaymentResultOverlay order={order} result={result} onComplete={finishResult} />}
  </main>
  return <main className="order-v2-page checkout-page">
    <header><OrderTopBar title="订单确认" /></header>
    <div className="checkout-scroll"><CheckoutSummary order={order} />
      <section className="insurance-card"><header><ShieldCheck size={15} aria-hidden="true" /><b>深度玩家 × 平安财产保险</b></header><div><span><b>包赔服务</b><small>账号被找回可获赔</small></span><button type="button">服务说明 <ChevronRight size={13} /></button></div><article><span><b>全倍包赔 <em>推荐</em></b><small>赔 100% · 最高赔付 {formatOrderMoney(order.goodsAmountCents)}</small></span><strong>{formatOrderMoney(order.insuranceAmountCents)}</strong><i><Check size={11} /></i></article></section>
      <section className="checkout-coupon"><b>优惠券</b><span>暂无可用优惠券 <ChevronRight size={13} /></span></section>
      <p className="checkout-agreement"><i><Check size={10} /></i>支付即同意 <button type="button">《购买须知》</button> 和 <button type="button">《支付须知》</button></p>
      {error && <p className="order-inline-error" role="alert">{error}</p>}
    </div>
    <footer className="checkout-footer"><span><strong>{formatOrderMoney(order.totalAmountCents)}</strong><small>明细⌃</small></span><button type="button" disabled={order.status !== 'pending'} onClick={() => setConfirmOpen(true)}>{order.status === 'pending' ? '立即支付' : getOrderStatusLabel(order.status, order.role)}</button></footer>
    <Dialog open={confirmOpen} title="风险提示" onClose={closeConfirm} showClose={false} className="order-risk-dialog-panel" actions={<><Button variant="outline" onClick={closeConfirm}>返回修改</Button><Button onClick={openCashier}>我已知晓</Button></>}><div className="order-risk-dialog"><AlertTriangle size={34} aria-hidden="true" /><p>账号交易存在被原主找回的风险。若发生找回，平台将全力协助追回账号；如无法追回，按你选择的包赔方案进行赔付。</p><div className="order-dialog-highlight"><span>当前已选 <b>全倍包赔</b></span><span>最高赔付 <b>{formatOrderMoney(order.goodsAmountCents)}</b></span></div></div></Dialog>
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
    if (!orderRepository.cancel(order.id, reason)) setError('订单状态已变化，无法取消。')
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
  return <main className="order-v2-page cancel-page"><OrderTopBar title={cancelled ? '取消结果' : '取消订单'} /><div className="cancel-page-scroll">{cancelled ? <><section className="cancel-context"><Heading as="h2" variant="result">订单已取消</Heading><p>该操作已经完成，不会产生任何扣款。</p>{error && <small role="alert">{error}</small>}</section><CheckoutSummary order={order} /></> : <section className="cancel-reason-sheet"><Heading as="h2" variant="dialog">为什么取消？</Heading><p>选择一个原因，帮助我们改进体验</p><div className="cancel-reason-list" role="radiogroup" aria-label="取消原因">{reasons.map(([label, detail]) => <button type="button" role="radio" aria-checked={reason === label} className={reason === label ? 'selected' : ''} key={label} onClick={() => setReason(label)}><span><b>{label}</b><small>{detail}</small></span><i>{reason === label && <Check size={12} strokeWidth={3} />}</i></button>)}</div><div className="cancel-risk-note">还有 <b>12 人</b>想要，该商品可能随时被其他买家买走</div>{error && <small role="alert">{error}</small>}</section>}</div><footer className="cancel-actions">{cancelled ? <><Link to="/orders?role=buyer&status=ended">返回订单</Link><Link className="primary" to="/game?gameCode=wzry">继续逛逛</Link></> : <><button type="button" className="danger" onClick={cancel}>确认取消</button><Link className="primary" to={`/orders/checkout?id=${encodeURIComponent(order.id)}`}>继续支付</Link></>}</footer></main>
}

export function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const { orders } = useOrderData()
  const order = orders.find((item) => item.id === params.get('id'))
  const navigate = useNavigate()
  const successful = order && ['paid', 'verifying', 'binding', 'signed', 'insuring', 'insured', 'bind_success', 'completed'].includes(order.status)
  if (!order) return <main className="order-v2-page"><OrderTopBar title="支付结果" /><OrderEmpty title="订单不存在" /></main>
  if (!successful && order.status !== 'pay_expired') return <main className="order-v2-page"><OrderTopBar title="支付结果" /><section className="payment-result-state error"><i>!</i><Heading as="h2" variant="result">支付未完成</Heading><p>当前订单状态：{getOrderStatusLabel(order.status, order.role)}</p><Link to={`/orders/${encodeURIComponent(order.id)}`}>查看订单</Link></section></main>
  const finish = () => navigate(`/orders/${encodeURIComponent(order.id)}`, { replace: true })
  return <main className="order-v2-page checkout-page cashier-page"><header><OrderTopBar title="确认支付" /></header><div className="checkout-scroll cashier-scroll"><section className="cashier-order-card"><p>交易订单支付</p><strong>{formatOrderMoney(order.totalAmountCents)}</strong><small>订单号　{order.id}</small></section></div><PaymentResultOverlay order={order} result={successful ? 'success' : 'expired'} onComplete={finish} /></main>
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { orders, now, refresh } = useOrderData()
  const [toast, setToast] = useState('')
  const order = orders.find((item) => item.id === id)
  if (!order) return <main className="order-v2-page"><OrderTopBar title="订单详情" /><OrderEmpty title="订单不存在" /></main>
  const hero = getOrderPrimaryMessage(order)
  const timeline = getOrderTimeline(order, now)
  const progress = getOrderWorkflowProgress(order)
  const terminal = ['pay_expired', 'cancelled', 'closed'].includes(order.status)
  const copy = async () => { try { await navigator.clipboard.writeText(order.id); setToast('订单号已复制') } catch { setToast('复制失败，请手动复制') } }
  const confirmReceipt = async () => { const success = orderRepository.confirmReceipt(order.id); if (success) await syncOrderConversation(order); setToast(success ? '已确认放款，平台将按规则结算' : '尚未进入待放款或交易已暂停'); refresh() }
  const completeBinding = async () => { const success = orderRepository.completeBinding(order.id); if (success) await syncOrderConversation(order); setToast(success ? '换绑完成，已进入协议签署完成阶段' : '订单状态已变化或交易已暂停'); refresh() }
  return <main className={`order-v2-page order-detail-page state-${order.status}`}><header><OrderTopBar title="订单详情" side={<small>{order.role === 'seller' ? '卖家视角' : '买家视角'}</small>} /></header><div className="order-detail-scroll">
    <section className={`order-detail-hero ${terminal ? 'terminal' : ''}`}>{terminal ? <><i className="order-terminal-icon" aria-hidden="true">{order.status === 'pay_expired' ? '⌛' : '×'}</i><Heading as="h2" variant="hero">{order.status === 'pay_expired' ? '支付超时，订单已关闭' : hero.title}</Heading><p>{order.status === 'pay_expired' ? '未产生费用，商品已重新开放购买' : hero.detail}</p><div><Link to={`/game?gameCode=${encodeURIComponent(order.gameCode)}`}>看看相似商品</Link><Link className="primary" to={`/game?gameCode=${encodeURIComponent(order.gameCode)}`}>重新购买</Link></div></> : <><span><b>步骤 {progress.current} / {progress.total}</b><em>{(['pending', 'verifying', 'bind_success'].includes(order.status) && order.role === 'buyer') || (order.status === 'binding' && order.role === 'seller') ? '该你了' : '等平台'}</em></span><Heading as="h2" variant="hero">{hero.title}</Heading><p>{hero.detail}</p>{order.status === 'pending' && <time>还剩 <b>{formatOrderCountdown(order.expiresAt, now)}</b></time>}{order.status === 'binding' && order.role === 'seller' && <time>换绑资料剩 <b>{formatOrderCountdown(order.actionExpiresAt, now)}</b></time>}{order.status === 'bind_success' && <time>未确认将自动放款 <b>{formatOrderCountdown(order.actionExpiresAt, now)}</b></time>}<div>{order.status === 'pending' ? <><Link to={`/payment/cancel?id=${encodeURIComponent(order.id)}`}>取消订单</Link><Link className="primary" to={`/orders/checkout?id=${encodeURIComponent(order.id)}`}>继续支付</Link></> : isOrderReleaseReady(order) && order.role === 'buyer' ? <><Link className="danger" to={`/aftersales/apply?orderId=${encodeURIComponent(order.id)}`}>验号不符</Link><button type="button" className="primary" onClick={confirmReceipt}>确认放款</button></> : order.status === 'binding' && order.role === 'seller' ? <><Link to={orderTradeRoute(order)}>进交易群</Link><button type="button" className="primary" onClick={completeBinding}>完成换绑</button></> : ['paid', 'verifying', 'binding', 'signed', 'insuring', 'insured', 'bind_success'].includes(order.status) ? <><Link to={`/aftersales/apply?orderId=${encodeURIComponent(order.id)}`}>申请客服介入</Link><Link className="dark" to={orderTradeRoute(order)}>进交易群</Link></> : <Link className="primary single" to="/orders">返回订单列表</Link>}</div></>}</section>
    {['paid', 'verifying', 'binding', 'signed', 'insuring', 'insured', 'bind_success'].includes(order.status) && <section className="order-escrow"><ShieldCheck size={15} /><span><b>{formatOrderMoney(order.totalAmountCents)}</b> 仍在平台托管，未支付给卖家。</span></section>}
    {!terminal && <section className="order-progress"><Heading as="h2" variant="section">交易进度</Heading><ol>{timeline.map((item) => <li key={item.key} className={item.state}><i /> <span><b>{item.title}</b>{item.detail && <small>{item.detail}</small>}</span></li>)}</ol></section>}
    <section className="order-detail-product"><ProductRow order={order} /><dl><div><dt>商品价</dt><dd>{formatOrderMoney(order.goodsAmountCents)}</dd></div><div><dt>包赔服务</dt><dd>{order.insuranceAmountCents ? formatOrderMoney(order.insuranceAmountCents) : '未购买'}</dd></div><div><dt>实付</dt><dd className="order-paid-amount">{formatOrderMoney(order.totalAmountCents)}</dd></div></dl><footer><span>订单号 <b>{order.id}</b></span><button type="button" onClick={copy}><Copy size={13} />复制</button></footer></section>
    <Link className="order-help" to={SUPPORT_CONVERSATION_ROUTE}><span><b>遇到问题？</b><small>卖家迟迟不换绑 · 收到的号与描述不符 · 其他</small></span><ChevronRight size={15} /></Link>
  </div><Toast message={toast} onDismiss={() => setToast('')} /></main>
}
