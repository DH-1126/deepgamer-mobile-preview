import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, Headphones, Search, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { countRecycleOrders, filterRecycleOrders, getActionableRecycleOrders, getRecycleOrderStatusLabel, isRecycleOrderTab, RECYCLE_ORDER_TABS, type RecycleOrderTab } from '../components/orderHubModel'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { recycleRepository } from '../repository/recycleRepository'
import type { RecycleOrder } from '../types/recycle'
import '../styles/orders-v2.css'

function StatusBar() {
  return <div className="order-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

function useRecycleOrders() {
  const [orders, setOrders] = useState<RecycleOrder[]>(() => recycleRepository.list())
  const refresh = useCallback(() => setOrders(recycleRepository.list()), [])
  useEffect(() => recycleRepository.subscribe(refresh), [refresh])
  return orders
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp)
}

function orderRoute(order: RecycleOrder) {
  const query = `?id=${encodeURIComponent(order.id)}`
  return ['submitted', 'inspecting', 'completed'].includes(order.stage) ? `/appraisal/loading${query}` : `/appraisal/detail${query}`
}

function RecycleOrderCard({ order }: { order: RecycleOrder }) {
  return <article className={`recycle-order-card stage-${order.stage}`}>
    <header><span><em>{getRecycleOrderStatusLabel(order)}</em>{['offered', 'materials', 'formal'].includes(order.stage) || (order.stage === 'submitted' && !order.submission) ? <b>该你了</b> : null}</span><time>{formatDate(order.updatedAt)}</time></header>
    <Link to={orderRoute(order)}>
      <div className="recycle-order-game"><i>{order.gameName.slice(0, 1)}</i><span><h2>{order.gameName} {order.server}</h2><p>{order.rank} · {order.recyclerName}</p><small>回收单号 {order.id}</small></span><strong><small>¥</small>{(order.quoteCents / 100).toFixed(2)}</strong></div>
      <footer><span>{order.stage === 'completed' ? '回收款已进入结算流程' : order.stage === 'rejected' ? '本次回收咨询已经结束' : '查看回收进度与订单详情'}</span><ChevronRight size={15} aria-hidden="true" /></footer>
    </Link>
  </article>
}

export function RecycleOrderListPage() {
  const orders = useRecycleOrders()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status: RecycleOrderTab = isRecycleOrderTab(statusParam) ? statusParam : 'all'
  const query = params.get('query') ?? ''
  const visible = useMemo(() => filterRecycleOrders(orders, status, query), [orders, query, status])
  const actionable = getActionableRecycleOrders(orders)
  const update = (key: 'status' | 'query', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  return <main className="order-v2-page order-list-page recycle-order-list-page">
    <header className="order-list-header"><StatusBar /><div className="order-list-title"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={19} aria-hidden="true" /></button><h1>我的回收</h1><form role="search" onSubmit={(event) => event.preventDefault()}><Search size={15} aria-hidden="true" /><input value={query} maxLength={80} onChange={(event) => update('query', event.target.value)} placeholder="搜索回收单" aria-label="搜索回收单号、游戏、区服、段位或回收商" />{query && <button type="button" onClick={() => update('query', '')} aria-label="清空搜索"><X size={14} /></button>}</form><Link to={SUPPORT_CONVERSATION_ROUTE} aria-label="联系平台客服"><Headphones size={18} aria-hidden="true" /></Link></div>
      <div className="order-status-tabs" role="tablist" aria-label="回收单状态筛选">{RECYCLE_ORDER_TABS.map((item) => <button type="button" role="tab" key={item.value} className={status === item.value ? 'active' : ''} aria-selected={status === item.value} onClick={() => update('status', item.value)}><span>{item.label}</span><b>{countRecycleOrders(orders, item.value)}</b></button>)}</div>
    </header>
    <div className="order-list-scroll">
      {actionable.length > 0 && status === 'all' && !query && <section className="order-task-summary"><h2><i />需要你处理 · <b>{actionable.length}</b>件</h2><p>待决定、待补资料或待确认的回收单</p></section>}
      {visible.length ? visible.map((order) => <RecycleOrderCard key={order.id} order={order} />) : <section className="order-v2-empty"><span aria-hidden="true">收</span><h2>{query ? '没有匹配的回收单' : '暂无回收单'}</h2><p>{query ? '换个订单号、游戏或回收商试试。' : '选择游戏和回收商，先咨询估价。'}</p>{!query && <Link to="/sell">开始回收</Link>}</section>}
    </div>
  </main>
}
